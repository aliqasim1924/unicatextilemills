'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ClockIcon, UserIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'

interface OrderDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string | null
}

interface OrderDetails {
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
  customer: {
    name: string
    email: string
    phone: string
  }
  finished_fabric: {
    name: string
    color: string
    gsm: number
    stock_quantity: number
    base_fabric: {
      name: string
      stock_quantity: number
    } | null
  }
}

export default function OrderDetailsModal({ isOpen, onClose, orderId }: OrderDetailsModalProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails()
    }
  }, [isOpen, orderId])

  const fetchOrderDetails = async () => {
    if (!orderId) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          customer:customers(*),
          finished_fabric:finished_fabrics(
            *,
            base_fabric:base_fabrics(*)
          )
        `)
        .eq('id', orderId)
        .single()

      if (error) throw error
      setOrder(data)
    } catch (error) {
      console.error('Error fetching order details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'in_production': return 'bg-purple-100 text-purple-800'
      case 'ready': return 'bg-green-100 text-green-800'
      case 'shipped': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return 'bg-red-100 text-red-800'
    if (priority >= 3) return 'bg-orange-100 text-orange-800'
    if (priority >= 1) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" />
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white shadow-xl sm:my-8 sm:w-full sm:max-w-4xl">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-8 w-8 text-blue-600 mr-3" />
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Order Details
                    </Dialog.Title>
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-600 hover:text-gray-800"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-sm text-gray-700">Loading order details...</p>
                  </div>
                ) : order ? (
                  <div className="space-y-6 max-h-96 overflow-y-auto">
                    {/* Order Header */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Order Number</h4>
                          <p className="mt-1 text-lg font-semibold text-gray-900">{order.internal_order_number}</p>
                          {order.customer_po_number && (
                            <p className="text-sm text-gray-700">PO: {order.customer_po_number}</p>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Status</h4>
                          <div className="mt-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.order_status)}`}>
                              {order.order_status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">Priority</h4>
                          <div className="mt-1">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(order.priority_override)}`}>
                              {order.priority_override === 0 ? 'NORMAL' : `HIGH (${order.priority_override})`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Customer Information */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        <UserIcon className="h-5 w-5 text-gray-600 mr-2" />
                        <h4 className="text-sm font-medium text-gray-900">Customer Information</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Name</p>
                          <p className="mt-1 text-sm text-gray-900">{order.customer.name}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Email</p>
                          <p className="mt-1 text-sm text-gray-900">{order.customer.email}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Phone</p>
                          <p className="mt-1 text-sm text-gray-900">{order.customer.phone}</p>
                        </div>
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Product & Quantity</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Finished Fabric</p>
                          <p className="mt-1 text-sm text-gray-900">{order.finished_fabric.name}</p>
                          <p className="text-xs text-gray-700">
                            {order.color && `${order.color} • `}{order.finished_fabric.gsm}GSM
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Base Fabric</p>
                          <p className="mt-1 text-sm text-gray-900">{order.finished_fabric.base_fabric?.name || 'N/A'}</p>
                          <p className="text-xs text-gray-700">
                            Stock: {order.finished_fabric.base_fabric?.stock_quantity || 0} meters
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Due Date</p>
                          <p className="mt-1 text-sm text-gray-900 flex items-center">
                            <ClockIcon className="h-4 w-4 mr-1" />
                            {formatDate(order.due_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Current Stock</p>
                          <p className="mt-1 text-sm text-gray-900">{order.finished_fabric.stock_quantity} meters</p>
                        </div>
                      </div>
                    </div>

                    {/* Allocation Details */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Allocation Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Quantity Ordered</p>
                          <p className="mt-1 text-lg font-semibold text-blue-700">
                            {order.quantity_ordered} meters
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Quantity Allocated</p>
                          <p className="mt-1 text-lg font-semibold text-green-700">
                            {order.quantity_allocated} meters
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Current Stock</p>
                          <p className="mt-1 text-sm text-gray-900">
                            {order.finished_fabric.stock_quantity} meters available
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Remaining</p>
                          <p className="mt-1 text-sm text-orange-700 font-semibold">
                            {order.quantity_ordered - order.quantity_allocated} meters
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Notes</h4>
                        <p className="text-sm text-gray-600">{order.notes}</p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                        <div>
                          <span className="font-medium">Created:</span> {formatDate(order.created_at)}
                        </div>
                        <div>
                          <span className="font-medium">Last Updated:</span> {formatDate(order.updated_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-700">Order not found</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
} 