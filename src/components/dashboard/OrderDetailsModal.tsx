'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, ClipboardDocumentListIcon, CalendarIcon, UserIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'

interface OrderDetailsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface OrderDetail {
  id: string
  internal_order_number: string
  customer_po_number: string | null
  order_status: string
  quantity_ordered: number
  quantity_allocated: number
  due_date: string
  priority_override: number
  created_at: string
  customer_name: string
  fabric_name: string
  color: string | null
}

export default function OrderDetailsModal({ isOpen, onClose }: OrderDetailsModalProps) {
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'urgent' | 'overdue'>('all')

  useEffect(() => {
    if (isOpen) {
      loadOrderDetails()
    }
  }, [isOpen])

  const loadOrderDetails = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          customers (name),
          finished_fabrics (name)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const formattedOrders: OrderDetail[] = (data || []).map(order => ({
        id: order.id,
        internal_order_number: order.internal_order_number,
        customer_po_number: order.customer_po_number,
        order_status: order.order_status || 'pending',
        quantity_ordered: order.quantity_ordered,
        quantity_allocated: order.quantity_allocated || 0,
        due_date: order.due_date,
        priority_override: order.priority_override || 0,
        created_at: order.created_at,
        customer_name: order.customers?.name || 'Unknown Customer',
        fabric_name: order.finished_fabrics?.name || 'Unknown Fabric',
        color: order.color
      }))

      setOrders(formattedOrders)
    } catch (error) {
      console.error('Error loading order details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredOrders = () => {
    const now = new Date()
    
    switch (activeTab) {
      case 'pending':
        return orders.filter(order => order.order_status === 'pending')
      case 'urgent':
        return orders.filter(order => order.priority_override >= 5)
      case 'overdue':
        return orders.filter(order => {
          const dueDate = new Date(order.due_date)
          return dueDate < now && !['delivered', 'completed', 'cancelled'].includes(order.order_status)
        })
      default:
        return orders
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'in_production': return 'bg-indigo-100 text-indigo-800'
      case 'production_complete': return 'bg-green-100 text-green-800'
      case 'ready_for_dispatch': return 'bg-purple-100 text-purple-800'
      case 'dispatched': return 'bg-orange-100 text-orange-800'
      case 'delivered': return 'bg-emerald-100 text-emerald-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return 'text-red-600 bg-red-100'
    if (priority >= 3) return 'text-orange-600 bg-orange-100'
    return 'text-green-600 bg-green-100'
  }

  const isOverdue = (dueDate: string, status: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    return due < now && !['delivered', 'completed', 'cancelled'].includes(status)
  }

  const statusCounts = {
    pending: orders.filter(o => o.order_status === 'pending').length,
    urgent: orders.filter(o => o.priority_override >= 5).length,
    overdue: orders.filter(o => isOverdue(o.due_date, o.order_status)).length,
    total: orders.length
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-full max-w-7xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Order Details</h3>
            <p className="text-gray-600">Comprehensive order overview and status tracking</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ClipboardDocumentListIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Orders</p>
                <p className="text-2xl font-bold text-blue-900">{statusCounts.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ClipboardDocumentListIcon className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-900">{statusCounts.pending}</p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ClipboardDocumentListIcon className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-600">Urgent</p>
                <p className="text-2xl font-bold text-red-900">{statusCounts.urgent}</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CalendarIcon className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-600">Overdue</p>
                <p className="text-2xl font-bold text-orange-900">{statusCounts.overdue}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'all', label: `All Orders (${statusCounts.total})` },
              { key: 'pending', label: `Pending (${statusCounts.pending})` },
              { key: 'urgent', label: `Urgent (${statusCounts.urgent})` },
              { key: 'overdue', label: `Overdue (${statusCounts.overdue})` }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredOrders().map((order) => (
                  <tr key={order.id} className={`hover:bg-gray-50 ${isOverdue(order.due_date, order.order_status) ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{order.internal_order_number}</div>
                        {order.customer_po_number && (
                          <div className="text-sm text-gray-500">PO: {order.customer_po_number}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <div className="text-sm text-gray-900">{order.customer_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{order.fabric_name}</div>
                        {order.color && (
                          <div className="text-sm text-gray-500">Color: {order.color}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{order.quantity_ordered.toLocaleString()} m</div>
                        <div className="text-sm text-gray-500">Allocated: {order.quantity_allocated.toLocaleString()} m</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${isOverdue(order.due_date, order.order_status) ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                        {new Date(order.due_date).toLocaleDateString()}
                        {isOverdue(order.due_date, order.order_status) && (
                          <div className="text-xs text-red-500">OVERDUE</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.order_status)}`}>
                        {order.order_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(order.priority_override)}`}>
                        {order.priority_override >= 5 ? 'HIGH' : order.priority_override >= 3 ? 'MEDIUM' : 'NORMAL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {getFilteredOrders().length === 0 && !loading && (
          <div className="text-center py-12">
            <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No orders found</h3>
            <p className="mt-1 text-sm text-gray-500">No orders match the current filter.</p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
} 