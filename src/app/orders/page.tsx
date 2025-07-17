'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import NewOrderFormMultiColor from '@/components/forms/NewOrderFormMultiColor'
import OrderDetailsModal from '@/components/orders/OrderDetailsModal'
import EditOrderModal from '@/components/orders/EditOrderModal'
import PDFGenerator from '@/components/pdf/generators/PDFGenerator'
import ExpandableCustomerOrderRow from '@/components/tables/ExpandableCustomerOrderRow'

interface CustomerOrder {
  id: string
  internal_order_number: string
  customer_po_number: string | null
  customer_id: string
  finished_fabric_id: string
  color: string | null
  quantity_ordered: number
  quantity_allocated: number
  due_date: string
  order_status: string
  priority_override: number
  notes: string | null
  created_at: string
  updated_at: string
  // Relations
  customers?: {
    name: string
    contact_person: string | null
  }
  finished_fabrics?: {
    name: string
    gsm: number
    width_meters: number
    color: string | null
    coating_type: string | null
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  
  // Delete functionality states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeletePinModal, setShowDeletePinModal] = useState(false)
  const [deletePin, setDeletePin] = useState('')
  const [deletePinError, setDeletePinError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<CustomerOrder | null>(null)

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          customers (
            name,
            contact_person
          ),
          finished_fabrics (
            name,
            gsm,
            width_meters,
            color,
            coating_type
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading orders:', error)
        return
      }

      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.internal_order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customers?.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || order.order_status === statusFilter
    
    return matchesSearch && matchesStatus
  })



  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId)
    setShowDetailsModal(true)
  }

  const handleEditOrder = (orderId: string) => {
    setSelectedOrderId(orderId)
    setShowEditModal(true)
  }

  const handleCloseModals = () => {
    setShowDetailsModal(false)
    setShowEditModal(false)
    setSelectedOrderId(null)
  }

  const handleOrderUpdated = () => {
    loadOrders()
    handleCloseModals()
  }

  const handleDeleteOrder = (order: CustomerOrder) => {
    setOrderToDelete(order)
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    setShowDeleteModal(false)
    setShowDeletePinModal(true)
  }

  const handleDeletePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (deletePin !== '0000') {
      setDeletePinError('Invalid PIN. Please try again.')
      return
    }

    if (!orderToDelete) return

    setDeleting(true)
    try {
      // Delete related production orders first
      const { error: productionError } = await supabase
        .from('production_orders')
        .delete()
        .eq('customer_order_id', orderToDelete.id)

      if (productionError) {
        console.error('Error deleting production orders:', productionError)
      }

      // Delete the customer order
      const { error: orderError } = await supabase
        .from('customer_orders')
        .delete()
        .eq('id', orderToDelete.id)

      if (orderError) throw orderError

      // Reload orders
      loadOrders()
      handleDeleteCancel()
    } catch (error) {
      console.error('Error deleting order:', error)
      alert('Failed to delete order. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
    setShowDeletePinModal(false)
    setDeletePin('')
    setDeletePinError('')
    setOrderToDelete(null)
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
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Orders</h1>
          <p className="mt-2 text-gray-600">Manage and track all customer orders</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <PDFGenerator
            type="customer-orders-report"
            buttonText="Orders Report"
            buttonClassName="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          />
          <button
            onClick={() => setShowNewOrderModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Order
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-6 py-4">
          <div className="sm:flex sm:items-center sm:justify-between">
            <div className="flex-1 flex items-center space-x-4">
              {/* Search */}
              <div className="flex-1 max-w-lg">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-600" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-600 focus:outline-none focus:placeholder-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search orders..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-2">
                <FunnelIcon className="h-5 w-5 text-gray-600" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in_production">In Production</option>
                  <option value="production_complete">Production Complete</option>
                  <option value="ready_for_dispatch">Ready for Dispatch</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="mt-4 sm:mt-0 flex items-center space-x-4 text-sm text-gray-700">
              <span>Total: {filteredOrders.length}</span>
              <span>Pending: {filteredOrders.filter(o => o.order_status === 'pending').length}</span>
              <span>In Production: {filteredOrders.filter(o => ['confirmed', 'in_production'].includes(o.order_status)).length}</span>
              <span>Ready: {filteredOrders.filter(o => ['production_complete', 'ready_for_dispatch'].includes(o.order_status)).length}</span>
              <span>Delivered: {filteredOrders.filter(o => o.order_status === 'delivered').length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
            <p className="text-gray-700 mb-6">
              {orders.length === 0 
                ? "You haven't created any orders yet. Create your first order to get started."
                : "No orders match your current search and filter criteria."
              }
            </p>
            {orders.length === 0 && (
              <button
                onClick={() => setShowNewOrderModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Create First Order
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Order Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Allocation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <ExpandableCustomerOrderRow
                    key={order.id}
                    order={order}
                    onView={handleViewOrder}
                    onEdit={handleEditOrder}
                    onDelete={handleDeleteOrder}
                    onOrderUpdated={loadOrders}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Order Form */}
              <NewOrderFormMultiColor
        isOpen={showNewOrderModal}
        onClose={() => setShowNewOrderModal(false)}
        onOrderCreated={loadOrders}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showDetailsModal}
        onClose={handleCloseModals}
        orderId={selectedOrderId}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={showEditModal}
        onClose={handleCloseModals}
        orderId={selectedOrderId}
        onOrderUpdated={handleOrderUpdated}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-sm mx-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Delete Order</h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              Are you sure you want to delete order <strong>{orderToDelete.internal_order_number}</strong>?
              This action cannot be undone and will also delete any related production orders.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete PIN Authorization Modal */}
      {showDeletePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Authorization Required</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please enter your PIN to authorize order deletion.
            </p>
            <form onSubmit={handleDeletePinSubmit}>
              <input
                type="password"
                value={deletePin}
                onChange={(e) => setDeletePin(e.target.value)}
                placeholder="Enter PIN"
                maxLength={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-lg tracking-widest text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
              {deletePinError && (
                <p className="mt-2 text-sm text-red-600 text-center">{deletePinError}</p>
              )}
              <div className="flex space-x-3 mt-4">
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!deletePin || deleting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 