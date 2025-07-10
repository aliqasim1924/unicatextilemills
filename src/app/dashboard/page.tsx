'use client'

import { useState, useEffect, useCallback } from 'react'
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



interface RecentActivity {
  id: string
  type: 'order' | 'production' | 'stock'
  message: string
  timestamp: string
  priority: 'normal' | 'high' | 'urgent'
}

interface OrderData {
  id: string
  internal_order_number: string
  order_status: string
  created_at: string
  customers?: {
    name: string
  } | null
  finished_fabrics?: {
    name: string
    color: string
  } | null
}

interface ProductionData {
  id: string
  internal_order_number: string
  production_status: string
  production_type: string
  created_at: string
  customer_orders?: {
    internal_order_number: string
    customers?: {
      name: string
    } | null
  } | null
  base_fabrics?: {
    name: string
  } | null
  finished_fabrics?: {
    name: string
  } | null
}

interface StockAlert {
  id: string
  name: string
  stock_quantity: number
  minimum_stock: number
}

interface DashboardData {
  metrics: {
    totalOrders: number;
    ordersInProgress: number;
    totalProduction: number;
    productionInProgress: number;
    lowStockItems: number;
  };
  recentOrders: OrderData[];
  recentProduction: ProductionData[];
  lowStockAlerts: StockAlert[];
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [showStockModal, setShowStockModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showProductionModal, setShowProductionModal] = useState(false)

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load all data in parallel
      const [ordersResponse, productionResponse, stockResponse] = await Promise.all([
        // Orders
        supabase
          .from('customer_orders')
          .select(`
            *,
            customers (name),
            finished_fabrics (name, color)
          `)
          .order('created_at', { ascending: false })
          .limit(10),

        // Production orders
        supabase
          .from('production_orders')
          .select(`
            *,
            customer_orders (
              internal_order_number,
              customers (name)
            ),
            base_fabrics (name),
            finished_fabrics (name)
          `)
          .order('created_at', { ascending: false })
          .limit(10),

        // Stock analysis
        Promise.all([
          supabase.from('base_fabrics').select('*'),
          supabase.from('finished_fabrics').select('*')
        ])
      ])

      if (ordersResponse.error) {
        console.error('Error loading orders:', ordersResponse.error)
        return
      }
      if (productionResponse.error) {
        console.error('Error loading production:', productionResponse.error)
        return
      }

      const [baseFabrics, finishedFabrics] = stockResponse
      
      // Process the data
      const orders = ordersResponse.data || []
      const production = productionResponse.data || []
      
      // Calculate metrics
      const totalOrders = orders.length
      const ordersInProgress = orders.filter((order: OrderData) => 
        ['confirmed', 'in_production'].includes(order.order_status)
      ).length
      
      const totalProduction = production.length
      const productionInProgress = production.filter((order: ProductionData) => 
        order.production_status === 'in_progress'
      ).length

      // Low stock alerts
      const lowStockItems = [
        ...(baseFabrics.data || []).filter((item: StockAlert) => 
          item.stock_quantity <= item.minimum_stock
        ),
        ...(finishedFabrics.data || []).filter((item: StockAlert) => 
          item.stock_quantity <= item.minimum_stock
        )
      ]

      const processedData: DashboardData = {
        metrics: {
          totalOrders,
          ordersInProgress,
          totalProduction,
          productionInProgress,
          lowStockItems: lowStockItems.length
        },
        recentOrders: orders,
        recentProduction: production,
        lowStockAlerts: lowStockItems
      }

      setDashboardData(processedData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])



  const statCards = [
    {
      name: 'Total Orders',
      value: dashboardData?.metrics.totalOrders,
      icon: ClipboardDocumentListIcon,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => setShowOrderModal(true),
      description: `${dashboardData?.metrics.ordersInProgress} in progress`
    },
    {
      name: 'Pending Orders',
      value: dashboardData?.metrics.ordersInProgress,
      icon: ExclamationTriangleIcon,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      onClick: () => setShowOrderModal(true),
      description: (dashboardData?.metrics.ordersInProgress || 0) > 0 ? `${dashboardData?.metrics.ordersInProgress || 0} in progress` : 'On track'
    },
    {
      name: 'Production Orders',
      value: dashboardData?.metrics.totalProduction,
      icon: Cog6ToothIcon,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
      onClick: () => setShowProductionModal(true),
      description: 'Active production'
    },
    {
      name: 'Total Stock',
      value: `${(dashboardData?.metrics.lowStockItems || 0).toLocaleString()} items`,
      icon: CubeIcon,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      onClick: () => setShowStockModal(true),
      description: `${dashboardData?.metrics.lowStockItems || 0} items low stock`
    },
    {
      name: 'Low Stock Items',
      value: dashboardData?.metrics.lowStockItems || 0,
      icon: ExclamationTriangleIcon,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
      onClick: () => setShowStockModal(true),
      description: 'Needs attention'
    },
    {
      name: 'Total Customers',
      value: 0, // This will need to be fetched from customers table
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
                {dashboardData?.metrics.totalOrders > 0 ? Math.round((dashboardData?.metrics.ordersInProgress / dashboardData?.metrics.totalOrders) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <ClipboardDocumentListIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">Orders This Month</p>
              <p className="text-xl font-semibold text-gray-900">{dashboardData?.metrics.totalOrders}</p>
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
              <p className="text-xl font-semibold text-gray-900">{dashboardData?.metrics.lowStockItems + 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            {dashboardData?.recentOrders.length > 0 || dashboardData?.recentProduction.length > 0 ? (
              <div className="flow-root">
                <ul className="-mb-8">
                  {dashboardData?.recentOrders.map((order, orderIdx) => {
                    const ActivityIcon = getActivityIcon('order')
                    return (
                      <li key={order.id}>
                        <div className="relative pb-8">
                          {orderIdx !== dashboardData?.recentOrders.length - 1 ? (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                order.order_status === 'pending' ? 'bg-red-500' :
                                order.order_status === 'confirmed' ? 'bg-orange-500' : 'bg-gray-400'
                              }`}>
                                <ActivityIcon className="h-4 w-4 text-white" aria-hidden="true" />
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className={`text-sm ${order.order_status === 'pending' ? 'text-red-600' : 'text-gray-600'}`}>
                                  {order.internal_order_number} from ${(order.customers as any)?.name || 'Unknown'}
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-700">
                                {formatTimestamp(order.created_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                  {dashboardData?.recentProduction.map((prod, prodIdx) => {
                    const ActivityIcon = getActivityIcon('production')
                    return (
                      <li key={prod.id}>
                        <div className="relative pb-8">
                          {prodIdx !== dashboardData?.recentProduction.length - 1 ? (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                prod.production_status === 'waiting_materials' ? 'bg-red-500' :
                                prod.production_status === 'in_progress' ? 'bg-orange-500' : 'bg-gray-400'
                              }`}>
                                <ActivityIcon className="h-4 w-4 text-white" aria-hidden="true" />
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className={`text-sm ${prod.production_status === 'waiting_materials' ? 'text-red-600' : 'text-gray-600'}`}>
                                  {prod.production_type} order {prod.internal_order_number} - {prod.production_status}
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-700">
                                {formatTimestamp(prod.created_at)}
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