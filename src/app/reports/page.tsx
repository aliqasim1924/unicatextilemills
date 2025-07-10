'use client'

import { useState, useEffect } from 'react'
import { 
  DocumentChartBarIcon, 
  ChartBarIcon, 
  CubeIcon, 
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  PrinterIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { generateReportPDF } from '@/components/pdf/generators/PDFGenerator'

interface ReportData {
  orders: any[]
  production: any[]
  stock: any[]
  customers: any[]
  summary: {
    totalOrders: number
    totalProduction: number
    totalCustomers: number
    totalStockValue: number
    pendingOrders: number
    inProgressProduction: number
    lowStock: number
    overdueOrders: number
  }
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState('overview')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [filters, setFilters] = useState({
    customer: '',
    status: 'all',
    priority: 'all'
  })

  useEffect(() => {
    loadReportData()
  }, [dateRange, filters])

  const loadReportData = async () => {
    try {
      setLoading(true)
      
      // Load orders data
      const { data: orders, error: ordersError } = await supabase
        .from('customer_orders')
        .select(`
          *,
          customers (name, contact_person),
          finished_fabrics (name, gsm, width_meters, color, coating_type)
        `)
        .gte('created_at', dateRange.startDate)
        .lte('created_at', dateRange.endDate + 'T23:59:59')
        .order('created_at', { ascending: false })

      // Load production data
      const { data: production, error: productionError } = await supabase
        .from('production_orders')
        .select(`
          *,
          customer_orders (internal_order_number, customers (name)),
          base_fabrics (name, gsm, width_meters),
          finished_fabrics (name, gsm, width_meters, color, coating_type)
        `)
        .gte('created_at', dateRange.startDate)
        .lte('created_at', dateRange.endDate + 'T23:59:59')
        .order('created_at', { ascending: false })

      // Load stock data
      const { data: baseStock, error: baseStockError } = await supabase
        .from('base_fabrics')
        .select('*')
        .order('name')

      const { data: finishedStock, error: finishedStockError } = await supabase
        .from('finished_fabrics')
        .select('*')
        .order('name')

      const { data: yarnStock, error: yarnStockError } = await supabase
        .from('yarn_stock')
        .select('*')
        .order('yarn_type')

      const { data: chemicalStock, error: chemicalStockError } = await supabase
        .from('chemical_stock')
        .select('*')
        .order('chemical_name')

      // Load customers data
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name')

      if (ordersError || productionError || baseStockError || finishedStockError || customersError) {
        console.error('Error loading report data:', { ordersError, productionError, baseStockError, finishedStockError, customersError })
        return
      }

      // Calculate summary statistics
      const totalOrders = orders?.length || 0
      const totalProduction = production?.length || 0
      const totalCustomers = customers?.length || 0
      const pendingOrders = orders?.filter(o => o.order_status === 'pending').length || 0
      const inProgressProduction = production?.filter(p => p.production_status === 'in_progress').length || 0
      const overdueOrders = orders?.filter(o => 
        o.order_status !== 'delivered' && 
        o.order_status !== 'cancelled' && 
        new Date(o.due_date) < new Date()
      ).length || 0

      // Calculate stock values and low stock items
      const baseStockValue = baseStock?.reduce((sum, item) => sum + (item.stock_quantity * 10), 0) || 0 // Assuming avg price of 10
      const finishedStockValue = finishedStock?.reduce((sum, item) => sum + (item.stock_quantity * 15), 0) || 0 // Assuming avg price of 15
      const yarnStockValue = yarnStock?.reduce((sum, item) => sum + (item.total_value || 0), 0) || 0
      const chemicalStockValue = chemicalStock?.reduce((sum, item) => sum + (item.total_value || 0), 0) || 0
      const totalStockValue = baseStockValue + finishedStockValue + yarnStockValue + chemicalStockValue

      const lowStock = [
        ...(baseStock?.filter(item => item.stock_quantity <= item.minimum_stock) || []),
        ...(finishedStock?.filter(item => item.stock_quantity <= item.minimum_stock) || []),
        ...(yarnStock?.filter(item => item.stock_quantity_kg <= item.minimum_stock_kg) || []),
        ...(chemicalStock?.filter(item => item.stock_quantity_liters <= item.minimum_stock_liters) || [])
      ].length

      const allStock = [
        ...(baseStock?.map(item => ({ ...item, type: 'base_fabric' })) || []),
        ...(finishedStock?.map(item => ({ ...item, type: 'finished_fabric' })) || []),
        ...(yarnStock?.map(item => ({ ...item, type: 'yarn' })) || []),
        ...(chemicalStock?.map(item => ({ ...item, type: 'chemical' })) || [])
      ]

      setReportData({
        orders: orders || [],
        production: production || [],
        stock: allStock,
        customers: customers || [],
        summary: {
          totalOrders,
          totalProduction,
          totalCustomers,
          totalStockValue,
          pendingOrders,
          inProgressProduction,
          lowStock,
          overdueOrders
        }
      })
    } catch (error) {
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const reportCategories = [
    {
      id: 'overview',
      name: 'Overview',
      icon: DocumentChartBarIcon,
      description: 'Key business metrics and summary'
    },
    {
      id: 'orders',
      name: 'Orders Report',
      icon: ClipboardDocumentListIcon,
      description: 'Customer orders analysis'
    },
    {
      id: 'production',
      name: 'Production Report',
      icon: ChartBarIcon,
      description: 'Production performance metrics'
    },
    {
      id: 'stock',
      name: 'Stock Report',
      icon: CubeIcon,
      description: 'Inventory levels and valuation'
    },
    {
      id: 'performance',
      name: 'Performance Report',
      icon: CalendarDaysIcon,
      description: 'Efficiency and delivery metrics'
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'in_production':
        return 'bg-indigo-100 text-indigo-800'
      case 'production_complete':
        return 'bg-green-100 text-green-800'
      case 'ready_for_dispatch':
        return 'bg-purple-100 text-purple-800'
      case 'dispatched':
        return 'bg-orange-100 text-orange-800'
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const exportToPDF = async (reportType: string) => {
    if (!reportData) return

    try {
      const pdfData = {
        reportType,
        dateRange,
        summary: reportData.summary,
        data: reportData[reportType as keyof ReportData] || []
      }

      await generateReportPDF(pdfData)
    } catch (error) {
      console.error('Error generating PDF:', error)
    }
  }

  const renderOverviewReport = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClipboardDocumentListIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{reportData?.summary.totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Production Orders</p>
              <p className="text-2xl font-bold text-gray-900">{reportData?.summary.totalProduction}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CubeIcon className="h-8 w-8 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Stock Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${reportData?.summary.totalStockValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CalendarDaysIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Customers</p>
              <p className="text-2xl font-bold text-gray-900">{reportData?.summary.totalCustomers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClipboardDocumentListIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-yellow-800">Pending Orders</p>
              <p className="text-2xl font-bold text-yellow-900">{reportData?.summary.pendingOrders}</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-800">In Progress</p>
              <p className="text-2xl font-bold text-blue-900">{reportData?.summary.inProgressProduction}</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CubeIcon className="h-8 w-8 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-red-800">Low Stock Items</p>
              <p className="text-2xl font-bold text-red-900">{reportData?.summary.lowStock}</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CalendarDaysIcon className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-orange-800">Overdue Orders</p>
              <p className="text-2xl font-bold text-orange-900">{reportData?.summary.overdueOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Order Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData?.orders.slice(0, 10).map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.internal_order_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.customers?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.order_status)}`}>
                      {order.order_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(order.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.quantity_ordered.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderOrdersReport = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Orders Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Order Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData?.orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.internal_order_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.customers?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.finished_fabrics?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.order_status)}`}>
                      {order.order_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.quantity_ordered.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(order.due_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.priority_override || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderProductionReport = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Production Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Order Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Required
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Produced
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Target Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData?.production.map((prod) => (
                <tr key={prod.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {prod.internal_order_number || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {prod.production_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(prod.production_status)}`}>
                      {prod.production_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {prod.quantity_required.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {prod.quantity_produced.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {prod.quantity_required > 0 ? 
                      Math.round((prod.quantity_produced / prod.quantity_required) * 100) : 0}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {prod.target_completion_date ? 
                      new Date(prod.target_completion_date).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderStockReport = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Stock Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Item Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Minimum Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData?.stock.map((item) => {
                const currentStock = item.type === 'yarn' ? item.stock_quantity_kg : 
                                   item.type === 'chemical' ? item.stock_quantity_liters : 
                                   item.stock_quantity
                const minStock = item.type === 'yarn' ? item.minimum_stock_kg : 
                                item.type === 'chemical' ? item.minimum_stock_liters : 
                                item.minimum_stock
                const isLowStock = currentStock <= minStock
                const value = item.total_value || (currentStock * (item.type === 'yarn' ? item.unit_cost_per_kg : item.type === 'chemical' ? item.unit_cost_per_liter : 10))

                return (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.name || item.yarn_type || item.chemical_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {currentStock.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {minStock.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        isLowStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {isLowStock ? 'Low Stock' : 'Normal'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${value?.toLocaleString() || 'N/A'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderPerformanceReport = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">On-Time Delivery</h4>
          <div className="text-3xl font-bold text-green-600">
            {reportData?.orders && reportData.orders.length > 0 ? 
              Math.round(
                (reportData.orders.filter(o => 
                  o.order_status === 'delivered' && 
                  new Date(o.dispatch_date || o.due_date) <= new Date(o.due_date)
                ).length / reportData.orders.filter(o => o.order_status === 'delivered').length) * 100
              ) : 0
            }%
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Production Efficiency</h4>
          <div className="text-3xl font-bold text-blue-600">
            {reportData?.production && reportData.production.length > 0 ? 
              Math.round(
                (reportData.production.filter(p => p.production_status === 'completed').length / reportData.production.length) * 100
              ) : 0
            }%
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Order Fulfillment</h4>
          <div className="text-3xl font-bold text-purple-600">
            {reportData?.orders && reportData.orders.length > 0 ? 
              Math.round(
                (reportData.orders.filter(o => o.order_status === 'delivered').length / reportData.orders.length) * 100
              ) : 0
            }%
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Orders by Status</h4>
              <div className="space-y-2">
                {['pending', 'confirmed', 'in_production', 'delivered'].map(status => {
                  const count = reportData?.orders ? reportData.orders.filter(o => o.order_status === status).length : 0
                  const percentage = reportData?.orders && reportData.orders.length > 0 ? (count / reportData.orders.length) * 100 : 0
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{status.replace('_', ' ')}</span>
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 mr-2">{count}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Production by Type</h4>
              <div className="space-y-2">
                {['weaving', 'coating'].map(type => {
                  const count = reportData?.production ? reportData.production.filter(p => p.production_type === type).length : 0
                  const percentage = reportData?.production && reportData.production.length > 0 ? (count / reportData.production.length) * 100 : 0
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{type}</span>
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900 mr-2">{count}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="mt-2 text-gray-600">
            Comprehensive business reports and performance metrics for Unica Textiles
          </p>
        </div>

        {/* Controls */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => exportToPDF(activeReport)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Export PDF
              </button>
            </div>
          </div>
        </div>

        {/* Report Categories */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {reportCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveReport(category.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  activeReport === category.id
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <category.icon className="h-8 w-8 mx-auto mb-2" />
                <h3 className="font-medium">{category.name}</h3>
                <p className="text-xs text-gray-700 mt-1">{category.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Report Content */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div>
            {activeReport === 'overview' && renderOverviewReport()}
            {activeReport === 'orders' && renderOrdersReport()}
            {activeReport === 'production' && renderProductionReport()}
            {activeReport === 'stock' && renderStockReport()}
            {activeReport === 'performance' && renderPerformanceReport()}
          </div>
        )}
      </div>
    </div>
  )
} 