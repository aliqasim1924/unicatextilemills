'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, PencilIcon, EnvelopeIcon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { Customer } from '@/types/database'

interface CustomerDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  customer: Customer
  onEdit: () => void
}

interface CustomerOrder {
  id: string
  internal_order_number: string
  customer_po_number: string | null
  quantity_ordered: number
  quantity_allocated: number
  due_date: string
  order_status: string
  created_at: string
  finished_fabrics?: {
    name: string
    color: string | null
  }
}

export default function CustomerDetailsModal({ 
  isOpen, 
  onClose, 
  customer, 
  onEdit 
}: CustomerDetailsModalProps) {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  useEffect(() => {
    if (isOpen && customer) {
      loadCustomerOrders()
    }
  }, [isOpen, customer])

  const loadCustomerOrders = async () => {
    try {
      setLoadingOrders(true)
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          id,
          internal_order_number,
          customer_po_number,
          quantity_ordered,
          quantity_allocated,
          due_date,
          order_status,
          created_at,
          finished_fabrics (
            name,
            color
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading customer orders:', error)
        return
      }

      setOrders(data || [])
    } catch (error) {
      console.error('Error loading customer orders:', error)
    } finally {
      setLoadingOrders(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'ready_for_dispatch':
        return 'bg-purple-100 text-purple-800'
      case 'dispatched':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  // Calculate order statistics
  const totalOrders = orders.length
  const totalQuantityOrdered = orders.reduce((sum, order) => sum + order.quantity_ordered, 0)
  const totalQuantityAllocated = orders.reduce((sum, order) => sum + order.quantity_allocated, 0)
  const activeOrders = orders.filter(order => 
    !['completed', 'dispatched'].includes(order.order_status.toLowerCase())
  ).length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Customer Details
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={onEdit}
              className="text-blue-600 hover:text-blue-900 p-2"
              title="Edit Customer"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Information */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">{customer.name}</h4>
              
              <div className="space-y-3">
                {customer.contact_person && (
                  <div className="flex items-center text-sm">
                    <span className="font-medium text-gray-700 w-20">Contact:</span>
                    <span className="text-gray-900">{customer.contact_person}</span>
                  </div>
                )}

                {customer.email && (
                  <div className="flex items-center text-sm">
                    <EnvelopeIcon className="h-4 w-4 text-gray-500 mr-2" />
                    <a 
                      href={`mailto:${customer.email}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {customer.email}
                    </a>
                  </div>
                )}

                {customer.phone && (
                  <div className="flex items-center text-sm">
                    <PhoneIcon className="h-4 w-4 text-gray-500 mr-2" />
                    <a 
                      href={`tel:${customer.phone}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {customer.phone}
                    </a>
                  </div>
                )}

                {customer.address && (
                  <div className="flex items-start text-sm">
                    <MapPinIcon className="h-4 w-4 text-gray-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-900">{customer.address}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    <div>Customer since: {formatDate(customer.created_at || '')}</div>
                    {customer.updated_at && customer.updated_at !== customer.created_at && (
                      <div>Last updated: {formatDate(customer.updated_at)}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Order Statistics */}
            <div className="bg-white border rounded-lg p-4">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Order Statistics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">{totalOrders}</div>
                  <div className="text-sm text-blue-800">Total Orders</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded">
                  <div className="text-2xl font-bold text-yellow-600">{activeOrders}</div>
                  <div className="text-sm text-yellow-800">Active Orders</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded">
                  <div className="text-lg font-bold text-green-600">{totalQuantityOrdered.toLocaleString()}</div>
                  <div className="text-sm text-green-800">Total Ordered (m)</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded">
                  <div className="text-lg font-bold text-purple-600">{totalQuantityAllocated.toLocaleString()}</div>
                  <div className="text-sm text-purple-800">Total Allocated (m)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Order History */}
          <div className="lg:col-span-2">
            <div className="bg-white border rounded-lg">
              <div className="px-4 py-3 border-b border-gray-200">
                <h4 className="text-lg font-medium text-gray-900">Order History</h4>
              </div>
              
              <div className="p-4">
                {loadingOrders ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No orders found for this customer
                  </div>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {orders.map((order) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-gray-900">
                              Order #{order.internal_order_number}
                            </div>
                            {order.customer_po_number && (
                              <div className="text-sm text-gray-600">
                                PO: {order.customer_po_number}
                              </div>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.order_status)}`}>
                            {formatStatus(order.order_status)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600">Product:</div>
                            <div className="font-medium">
                              {order.finished_fabrics?.name || 'Unknown'}
                              {order.finished_fabrics?.color && (
                                <span className="text-gray-500"> • {order.finished_fabrics.color}</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600">Quantity:</div>
                            <div className="font-medium">
                              {order.quantity_allocated.toLocaleString()}m / {order.quantity_ordered.toLocaleString()}m ordered
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-sm text-gray-500">
                          <span>Due: {formatDate(order.due_date)}</span>
                          <span>Created: {formatDate(order.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Edit Customer
          </button>
        </div>
      </div>
    </div>
  )
} 