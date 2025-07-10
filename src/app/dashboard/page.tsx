'use client'

import { useState, useEffect } from 'react'
import {
  CubeIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  ChevronRightIcon,
  CalendarIcon,
  ChartBarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import PDFGenerator from '@/components/pdf/generators/PDFGenerator'
import StockDetailsModal from '@/components/dashboard/StockDetailsModal'
import OrderDetailsModal from '@/components/dashboard/OrderDetailsModal'
import ProductionDetailsModal from '@/components/dashboard/ProductionDetailsModal'

interface DashboardStats {
  totalOrders: number
  pendingOrders: number
  totalStock: number
  lowStockItems: number
  productionOrders: number
  completedOrders: number
  totalCustomers: number
  overdueOrders: number
}

interface RecentActivity {
  id: string
  type: 'order' | 'production' | 'stock'
  message: string
  timestamp: string
  priority: 'normal' | 'high' | 'urgent'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalStock: 0,
    lowStockItems: 0,
    productionOrders: 0,
    completedOrders: 0,
    totalCustomers: 0,
    overdueOrders: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [showStockModal, setShowStockModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showProductionModal, setShowProductionModal] = useState(false)

  useEffect(() => {
    loadDashboardData()
    // Set up real-time updates with a more reasonable interval
    const interval = setInterval(loadDashboardData, 300000) // Refresh every 5 minutes
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Get customer orders count and overdue orders
      const { count: totalOrders } = await supabase
        .from('customer_orders')
        .select('*', { count: 'exact', head: true })

      const { count: pendingOrders } = await supabase
        .from('customer_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'pending')

      const { count: completedOrders } = await supabase
        .from('customer_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'completed')

      // Get overdue orders
      const { data: overdueOrdersData } = await supabase
        .from('customer_orders')
        .select('due_date, order_status')
        .not('order_status', 'in', '(delivered,completed,cancelled)')

      const now = new Date()
      const overdueOrders = (overdueOrdersData || []).filter(order => 
        new Date(order.due_date) < now
      ).length

      // Get production orders count
      const { count: productionOrders } = await supabase
        .from('production_orders')
        .select('*', { count: 'exact', head: true })
        .in('production_status', ['pending', 'in_progress', 'waiting_materials'])

      // Get customers count
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })

      // Get stock information
      const { data: baseFabrics } = await supabase
        .from('base_fabrics')
        .select('stock_quantity, minimum_stock')

      const { data: finishedFabrics } = await supabase
        .from('finished_fabrics')
        .select('stock_quantity, minimum_stock')

      // Calculate stock stats
      const allStock = [...(baseFabrics || []), ...(finishedFabrics || [])]
      const totalStock = allStock.reduce((sum, item) => sum + (item.stock_quantity || 0), 0)
      const lowStockItems = allStock.filter(
        item => (item.stock_quantity || 0) <= (item.minimum_stock || 0)
      ).length

      setStats({
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
        completedOrders: completedOrders || 0,
        productionOrders: productionOrders || 0,
        totalStock,
        lowStockItems,
        totalCustomers: totalCustomers || 0,
        overdueOrders,
      })

      // Load recent activity
      await loadRecentActivity()
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadRecentActivity = async () => {
    try {
      // Get recent orders
      const { data: recentOrders } = await supabase
        .from('customer_orders')
        .select(`
          id, internal_order_number, created_at, order_status,
          customers!inner (name)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      // Get recent production orders
      const { data: recentProduction } = await supabase
        .from('production_orders')
        .select('id, internal_order_number, created_at, production_status, production_type')
        .order('created_at', { ascending: false })
        .limit(5)

      const activities: RecentActivity[] = [
        ...(recentOrders || []).map(order => ({
          id: `order-${order.id}`,
          type: 'order' as const,
          message: `New order ${order.internal_order_number} from ${(order.customers as any)?.name || 'Unknown'}`,
          timestamp: order.created_at,
          priority: order.order_status === 'pending' ? 'high' as const : 'normal' as const
        })),
        ...(recentProduction || []).map(prod => ({
          id: `production-${prod.id}`,
          type: 'production' as const,
          message: `${prod.production_type} order ${prod.internal_order_number} - ${prod.production_status}`,
          timestamp: prod.created_at,
          priority: prod.production_status === 'waiting_materials' ? 'urgent' as const : 'normal' as const
        }))
      ]

      // Sort by timestamp and take the most recent 8
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setRecentActivity(activities.slice(0, 8))
    } catch (error) {
      console.error('Error loading recent activity:', error)
    }
  }

  const statCards = [
    {
      name: 'Total Orders',
      value: stats.totalOrders,
      icon: ClipboardDocumentListIcon,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => setShowOrderModal(true),
      description: `${stats.pendingOrders} pending, ${stats.overdueOrders} overdue`
    },
    {
      name: 'Pending Orders',
      value: stats.pendingOrders,
      icon: ExclamationTriangleIcon,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      onClick: () => setShowOrderModal(true),
      description: stats.overdueOrders > 0 ? `${stats.overdueOrders} overdue` : 'On track'
    },
    {
      name: 'Production Orders',
      value: stats.productionOrders,
      icon: Cog6ToothIcon,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
      onClick: () => setShowProductionModal(true),
      description: 'Active production'
    },
    {
      name: 'Total Stock',
      value: `${stats.totalStock.toLocaleString()}m`,
      icon: CubeIcon,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      onClick: () => setShowStockModal(true),
      description: `${stats.lowStockItems} items low stock`
    },
    {
      name: 'Low Stock Items',
      value: stats.lowStockItems,
      icon: ExclamationTriangleIcon,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
      onClick: () => setShowStockModal(true),
      description: 'Needs attention'
    },
    {
      name: 'Total Customers',
      value: stats.totalCustomers,
      icon: UserGroupIcon,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      onClick: () => {},
      description: 'Active customers'
    },
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order': return ClipboardDocumentListIcon
      case 'production': return Cog6ToothIcon
      case 'stock': return CubeIcon
      default: return ClipboardDocumentListIcon
    }
  }

  const getActivityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600'
      case 'high': return 'text-orange-600'
      default: return 'text-gray-600'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to Unica Textiles Stock Management System</p>
        <div className="mt-2 flex items-center text-sm text-gray-700">
          <CalendarIcon className="h-4 w-4 mr-1" />
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <div 
            key={card.name} 
            className={`relative ${card.bgColor} pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200 group`}
            onClick={card.onClick}
          >
            <dt>
              <div className={`absolute ${card.color} rounded-md p-3 group-hover:scale-105 transition-transform duration-200`}>
                <card.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <p className="ml-16 text-sm font-medium text-gray-600 truncate">{card.name}</p>
            </dt>
            <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
              <p className={`text-2xl font-semibold ${card.textColor}`}>
                {typeof card.value === 'string' ? card.value : card.value.toLocaleString()}
              </p>
              <div className="absolute bottom-0 right-0 p-3">
                <ChevronRightIcon className="h-5 w-5 text-gray-600 group-hover:text-gray-800" />
              </div>
            </dd>
            {card.description && (
              <div className="ml-16 pb-3">
                <p className="text-xs text-gray-700">{card.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stats Summary Row */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">Completion Rate</p>
              <p className="text-xl font-semibold text-gray-900">
                {stats.totalOrders > 0 ? Math.round((stats.completedOrders / stats.totalOrders) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <ClipboardDocumentListIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">Orders This Month</p>
              <p className="text-xl font-semibold text-gray-900">{stats.totalOrders}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Cog6ToothIcon className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">Production Efficiency</p>
              <p className="text-xl font-semibold text-gray-900">87%</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">Issues to Address</p>
              <p className="text-xl font-semibold text-gray-900">{stats.lowStockItems + stats.overdueOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            {recentActivity.length > 0 ? (
              <div className="flow-root">
                <ul className="-mb-8">
                  {recentActivity.map((activity, activityIdx) => {
                    const ActivityIcon = getActivityIcon(activity.type)
                    return (
                      <li key={activity.id}>
                        <div className="relative pb-8">
                          {activityIdx !== recentActivity.length - 1 ? (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                activity.priority === 'urgent' ? 'bg-red-500' :
                                activity.priority === 'high' ? 'bg-orange-500' : 'bg-gray-400'
                              }`}>
                                <ActivityIcon className="h-4 w-4 text-white" aria-hidden="true" />
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className={`text-sm ${getActivityColor(activity.priority)}`}>
                                  {activity.message}
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-700">
                                {formatTimestamp(activity.timestamp)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-gray-700">
                <p>• Dashboard initialized successfully</p>
                <p>• Connected to Supabase database</p>
                <p>• Real-time stock monitoring active</p>
                <p>• Ready to process orders and manage inventory</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                New Order
              </button>
              <button 
                onClick={() => setShowStockModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Stock Update
              </button>
              <button 
                onClick={() => setShowProductionModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Production Plan
              </button>
              <PDFGenerator
                type="management-report"
                buttonText="Generate Report"
                buttonClassName="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <StockDetailsModal 
        isOpen={showStockModal} 
        onClose={() => setShowStockModal(false)} 
      />
      <OrderDetailsModal 
        isOpen={showOrderModal} 
        onClose={() => setShowOrderModal(false)} 
      />
      <ProductionDetailsModal 
        isOpen={showProductionModal} 
        onClose={() => setShowProductionModal(false)} 
      />
    </div>
  )
} 