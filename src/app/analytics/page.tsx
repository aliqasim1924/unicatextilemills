'use client'

import { useState, useEffect } from 'react'
import { 
  ChartBarIcon, 
  TrendingUpIcon,
  CalendarDaysIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CubeIcon,
  UsersIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface AnalyticsData {
  orderTrends: any[]
  productionTrends: any[]
  stockAnalysis: any[]
  customerAnalysis: any[]
  performanceMetrics: any
  kpis: {
    orderGrowth: number
    productionEfficiency: number
    stockTurnover: number
    customerSatisfaction: number
    onTimeDelivery: number
    revenueGrowth: number
  }
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30') // days
  const [selectedMetric, setSelectedMetric] = useState('orders')

  useEffect(() => {
    loadAnalyticsData()
  }, [timeRange])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - parseInt(timeRange))

      // Load orders data
      const { data: orders, error: ordersError } = await supabase
        .from('customer_orders')
        .select(`
          *,
          customers (name, contact_person),
          finished_fabrics (name, gsm, width_meters, color, coating_type)
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      // Load production data
      const { data: production, error: productionError } = await supabase
        .from('production_orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      // Load stock data
      const { data: baseStock } = await supabase.from('base_fabrics').select('*')
      const { data: finishedStock } = await supabase.from('finished_fabrics').select('*')
      const { data: yarnStock } = await supabase.from('yarn_stock').select('*')
      const { data: chemicalStock } = await supabase.from('chemical_stock').select('*')

      // Load stock movements for turnover analysis
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('*')
        .gte('created_at', startDate.toISOString())

      if (ordersError || productionError) {
        console.error('Error loading analytics data:', { ordersError, productionError })
        return
      }

      // Process data for charts
      const processedData = processAnalyticsData({
        orders: orders || [],
        production: production || [],
        baseStock: baseStock || [],
        finishedStock: finishedStock || [],
        yarnStock: yarnStock || [],
        chemicalStock: chemicalStock || [],
        stockMovements: stockMovements || [],
        timeRange: parseInt(timeRange)
      })

      setAnalyticsData(processedData)
    } catch (error) {
      console.error('Error loading analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const processAnalyticsData = (data: any): AnalyticsData => {
    const { orders, production, baseStock, finishedStock, yarnStock, chemicalStock, stockMovements, timeRange } = data

    // Generate date range for trends
    const dateRange = Array.from({ length: timeRange }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (timeRange - 1) + i)
      return date.toISOString().split('T')[0]
    })

    // Order trends
    const orderTrends = dateRange.map(date => {
      const dayOrders = orders.filter((o: any) => o.created_at.split('T')[0] === date)
      const dayValue = dayOrders.reduce((sum: number, o: any) => sum + o.quantity_ordered, 0)
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orders: dayOrders.length,
        value: dayValue,
        revenue: dayValue * 15 // Assuming average price per unit
      }
    })

    // Production trends
    const productionTrends = dateRange.map(date => {
      const dayProduction = production.filter((p: any) => p.created_at.split('T')[0] === date)
      const weavingCount = dayProduction.filter((p: any) => p.production_type === 'weaving').length
      const coatingCount = dayProduction.filter((p: any) => p.production_type === 'coating').length
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weaving: weavingCount,
        coating: coatingCount,
        total: dayProduction.length
      }
    })

    // Stock analysis
    const stockAnalysis = [
      {
        name: 'Base Fabrics',
        current: baseStock.reduce((sum: number, item: any) => sum + item.stock_quantity, 0),
        minimum: baseStock.reduce((sum: number, item: any) => sum + item.minimum_stock, 0),
        value: baseStock.reduce((sum: number, item: any) => sum + (item.stock_quantity * 10), 0),
        count: baseStock.length
      },
      {
        name: 'Finished Fabrics',
        current: finishedStock.reduce((sum: number, item: any) => sum + item.stock_quantity, 0),
        minimum: finishedStock.reduce((sum: number, item: any) => sum + item.minimum_stock, 0),
        value: finishedStock.reduce((sum: number, item: any) => sum + (item.stock_quantity * 15), 0),
        count: finishedStock.length
      },
      {
        name: 'Yarn Stock',
        current: yarnStock.reduce((sum: number, item: any) => sum + item.stock_quantity_kg, 0),
        minimum: yarnStock.reduce((sum: number, item: any) => sum + item.minimum_stock_kg, 0),
        value: yarnStock.reduce((sum: number, item: any) => sum + (item.total_value || 0), 0),
        count: yarnStock.length
      },
      {
        name: 'Chemical Stock',
        current: chemicalStock.reduce((sum: number, item: any) => sum + item.stock_quantity_liters, 0),
        minimum: chemicalStock.reduce((sum: number, item: any) => sum + item.minimum_stock_liters, 0),
        value: chemicalStock.reduce((sum: number, item: any) => sum + (item.total_value || 0), 0),
        count: chemicalStock.length
      }
    ]

    // Customer analysis
    const customerGroups = orders.reduce((acc: any, order: any) => {
      const customerName = order.customers?.name || 'Unknown'
      if (!acc[customerName]) {
        acc[customerName] = { name: customerName, orders: 0, value: 0 }
      }
      acc[customerName].orders += 1
      acc[customerName].value += order.quantity_ordered * 15
      return acc
    }, {})

    const customerAnalysis = Object.values(customerGroups)
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 10)

    // Performance metrics
    const performanceMetrics = {
      orderStatusDistribution: [
        { name: 'Pending', value: orders.filter((o: any) => o.order_status === 'pending').length, color: '#FbbF24' },
        { name: 'Confirmed', value: orders.filter((o: any) => o.order_status === 'confirmed').length, color: '#3B82F6' },
        { name: 'In Production', value: orders.filter((o: any) => o.order_status === 'in_production').length, color: '#6366F1' },
        { name: 'Completed', value: orders.filter((o: any) => o.order_status === 'delivered').length, color: '#10B981' },
        { name: 'Cancelled', value: orders.filter((o: any) => o.order_status === 'cancelled').length, color: '#EF4444' }
      ],
      productionTypeDistribution: [
        { name: 'Weaving', value: production.filter((p: any) => p.production_type === 'weaving').length, color: '#8B5CF6' },
        { name: 'Coating', value: production.filter((p: any) => p.production_type === 'coating').length, color: '#F59E0B' }
      ]
    }

    // Calculate KPIs
    const previousPeriodStart = new Date()
    previousPeriodStart.setDate(previousPeriodStart.getDate() - (timeRange * 2))
    const previousPeriodEnd = new Date()
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - timeRange)

    const currentPeriodOrders = orders.length
    const previousOrders = orders.filter((o: any) => {
      const orderDate = new Date(o.created_at)
      return orderDate >= previousPeriodStart && orderDate <= previousPeriodEnd
    }).length

    const orderGrowth = previousOrders > 0 ? ((currentPeriodOrders - previousOrders) / previousOrders) * 100 : 0

    const completedProduction = production.filter((p: any) => p.production_status === 'completed').length
    const totalProduction = production.length
    const productionEfficiency = totalProduction > 0 ? (completedProduction / totalProduction) * 100 : 0

    const deliveredOrders = orders.filter((o: any) => o.order_status === 'delivered')
    const onTimeOrders = deliveredOrders.filter((o: any) => 
      !o.dispatch_date || new Date(o.dispatch_date) <= new Date(o.due_date)
    )
    const onTimeDelivery = deliveredOrders.length > 0 ? (onTimeOrders.length / deliveredOrders.length) * 100 : 0

    const currentRevenue = orders.reduce((sum: number, o: any) => sum + (o.quantity_ordered * 15), 0)
    const previousRevenue = orders.filter((o: any) => {
      const orderDate = new Date(o.created_at)
      return orderDate >= previousPeriodStart && orderDate <= previousPeriodEnd
    }).reduce((sum: number, o: any) => sum + (o.quantity_ordered * 15), 0)

    const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0

    const kpis = {
      orderGrowth,
      productionEfficiency,
      stockTurnover: stockMovements.length * 10, // Simplified calculation
      customerSatisfaction: 87, // Mock data - would come from customer feedback
      onTimeDelivery,
      revenueGrowth
    }

    return {
      orderTrends,
      productionTrends,
      stockAnalysis,
      customerAnalysis,
      performanceMetrics,
      kpis
    }
  }

  const timeRangeOptions = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 3 months' },
    { value: '365', label: 'Last year' }
  ]

  const renderKPICard = (title: string, value: number, suffix: string, isPercentage: boolean, trend?: number) => (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {isPercentage ? `${value.toFixed(1)}%` : `${value.toFixed(0)}${suffix}`}
          </p>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? (
              <ArrowUpIcon className="h-5 w-5" />
            ) : (
              <ArrowDownIcon className="h-5 w-5" />
            )}
            <span className="text-sm font-medium ml-1">
              {Math.abs(trend).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Real-time insights and performance metrics for Unica Textiles
              </p>
            </div>
            <div>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : analyticsData ? (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {renderKPICard('Order Growth', analyticsData.kpis.orderGrowth, '', true, analyticsData.kpis.orderGrowth)}
              {renderKPICard('Production Efficiency', analyticsData.kpis.productionEfficiency, '', true)}
              {renderKPICard('On-Time Delivery', analyticsData.kpis.onTimeDelivery, '', true)}
              {renderKPICard('Revenue Growth', analyticsData.kpis.revenueGrowth, '', true, analyticsData.kpis.revenueGrowth)}
              {renderKPICard('Customer Satisfaction', analyticsData.kpis.customerSatisfaction, '', true)}
              {renderKPICard('Stock Turnover', analyticsData.kpis.stockTurnover, ' moves', false)}
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Order Trends */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.orderTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="orders" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Production Trends */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Production Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analyticsData.productionTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="weaving" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" />
                    <Area type="monotone" dataKey="coating" stackId="1" stroke="#F59E0B" fill="#F59E0B" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Order Status Distribution */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Status Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData.performanceMetrics.orderStatusDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {analyticsData.performanceMetrics.orderStatusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Stock Analysis */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Analysis</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.stockAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [value.toLocaleString(), name]} />
                    <Legend />
                    <Bar dataKey="current" fill="#3B82F6" name="Current Stock" />
                    <Bar dataKey="minimum" fill="#EF4444" name="Minimum Stock" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts Row 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Analysis */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Top Customers by Value</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.customerAnalysis} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Value']} />
                    <Bar dataKey="value" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue Trends */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analyticsData.orderTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Metrics Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Detailed Performance Metrics</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Metric
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Current Period
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Target
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Performance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Trend
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Order Growth Rate
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analyticsData.kpis.orderGrowth.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">15%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          analyticsData.kpis.orderGrowth >= 15 ? 'bg-green-100 text-green-800' : 
                          analyticsData.kpis.orderGrowth >= 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {analyticsData.kpis.orderGrowth >= 15 ? 'Excellent' : 
                           analyticsData.kpis.orderGrowth >= 10 ? 'Good' : 'Needs Improvement'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className={`flex items-center ${analyticsData.kpis.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {analyticsData.kpis.orderGrowth >= 0 ? (
                            <ArrowUpIcon className="h-4 w-4 mr-1" />
                          ) : (
                            <ArrowDownIcon className="h-4 w-4 mr-1" />
                          )}
                          {Math.abs(analyticsData.kpis.orderGrowth).toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Production Efficiency
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analyticsData.kpis.productionEfficiency.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">90%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          analyticsData.kpis.productionEfficiency >= 90 ? 'bg-green-100 text-green-800' : 
                          analyticsData.kpis.productionEfficiency >= 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {analyticsData.kpis.productionEfficiency >= 90 ? 'Excellent' : 
                           analyticsData.kpis.productionEfficiency >= 80 ? 'Good' : 'Needs Improvement'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center text-green-600">
                          <ArrowUpIcon className="h-4 w-4 mr-1" />
                          2.3%
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        On-Time Delivery
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analyticsData.kpis.onTimeDelivery.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">95%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          analyticsData.kpis.onTimeDelivery >= 95 ? 'bg-green-100 text-green-800' : 
                          analyticsData.kpis.onTimeDelivery >= 85 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {analyticsData.kpis.onTimeDelivery >= 95 ? 'Excellent' : 
                           analyticsData.kpis.onTimeDelivery >= 85 ? 'Good' : 'Needs Improvement'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center text-green-600">
                          <ArrowUpIcon className="h-4 w-4 mr-1" />
                          1.8%
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        Revenue Growth
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analyticsData.kpis.revenueGrowth.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">20%</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          analyticsData.kpis.revenueGrowth >= 20 ? 'bg-green-100 text-green-800' : 
                          analyticsData.kpis.revenueGrowth >= 15 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {analyticsData.kpis.revenueGrowth >= 20 ? 'Excellent' : 
                           analyticsData.kpis.revenueGrowth >= 15 ? 'Good' : 'Needs Improvement'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className={`flex items-center ${analyticsData.kpis.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {analyticsData.kpis.revenueGrowth >= 0 ? (
                            <ArrowUpIcon className="h-4 w-4 mr-1" />
                          ) : (
                            <ArrowDownIcon className="h-4 w-4 mr-1" />
                          )}
                          {Math.abs(analyticsData.kpis.revenueGrowth).toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-700">No data available for the selected time range.</p>
          </div>
        )}
      </div>
    </div>
  )
} 