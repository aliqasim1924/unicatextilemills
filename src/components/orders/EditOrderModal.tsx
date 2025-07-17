'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { logCustomerOrderAudit } from '@/lib/utils/auditTrail'
import ColorDropdown from '@/components/ui/ColorDropdown'

interface EditOrderModalProps {
  isOpen: boolean
  onClose: () => void
  orderId: string | null
  onOrderUpdated: () => void
}

interface Customer {
  id: string
  name: string
  email: string
  phone: string
}

interface FinishedFabric {
  id: string
  name: string
  color: string
  gsm: number
  stock_quantity: number
}

interface OrderForm {
  customer_id: string
  finished_fabric_id: string
  color: string
  quantity_ordered: number
  due_date: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'confirmed' | 'partially_allocated' | 'fully_allocated' | 'in_production' | 'production_complete' | 'ready_for_dispatch' | 'dispatched' | 'delivered' | 'completed' | 'cancelled'
  notes: string
  invoice_number: string
  gate_pass_number: string
  delivery_note_number: string
  dispatch_date: string
  dispatch_notes: string
}

export default function EditOrderModal({ isOpen, onClose, orderId, onOrderUpdated }: EditOrderModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [fabrics, setFabrics] = useState<FinishedFabric[]>([])
  const [formData, setFormData] = useState<OrderForm>({
    customer_id: '',
    finished_fabric_id: '',
    color: '',
    quantity_ordered: 0,
    due_date: '',
    priority: 'medium',
    status: 'pending',
    notes: '',
    invoice_number: '',
    gate_pass_number: '',
    delivery_note_number: '',
    dispatch_date: '',
    dispatch_notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [originalFormData, setOriginalFormData] = useState<OrderForm | null>(null)
  
  // PIN Authorization states
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pendingFormData, setPendingFormData] = useState<OrderForm | null>(null)

  useEffect(() => {
    if (isOpen && orderId) {
      loadData()
    }
  }, [isOpen, orderId])

  const mapPriorityFromNumber = (priorityNum: number): 'low' | 'medium' | 'high' | 'urgent' => {
    if (priorityNum >= 5) return 'urgent'
    if (priorityNum >= 3) return 'high'
    if (priorityNum >= 1) return 'medium'
    return 'low'
  }

  const mapPriorityToNumber = (priority: string): number => {
    switch (priority) {
      case 'urgent': return 5
      case 'high': return 3
      case 'medium': return 1
      case 'low': return 0
      default: return 0
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Load order details
      const { data: orderData, error: orderError } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderError) throw orderError

      // Set form data - map database fields to form fields
      const formDataObj = {
        customer_id: orderData.customer_id,
        finished_fabric_id: orderData.finished_fabric_id,
        color: orderData.color || '',
        quantity_ordered: orderData.quantity_ordered,
        due_date: orderData.due_date,
        priority: mapPriorityFromNumber(orderData.priority_override),
        status: orderData.order_status,
        notes: orderData.notes || '',
        invoice_number: orderData.invoice_number || '',
        gate_pass_number: orderData.gate_pass_number || '',
        delivery_note_number: orderData.delivery_note_number || '',
        dispatch_date: orderData.dispatch_date || '',
        dispatch_notes: orderData.dispatch_notes || ''
      }
      
      setFormData(formDataObj)
      setOriginalFormData({ ...formDataObj }) // Store original for comparison

      // Load customers and fabrics
      const [customersResponse, fabricsResponse] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('finished_fabrics').select('*').order('name')
      ])

      if (customersResponse.error) throw customersResponse.error
      if (fabricsResponse.error) throw fabricsResponse.error

      setCustomers(customersResponse.data)
      setFabrics(fabricsResponse.data)
    } catch (error) {
      console.error('Error loading order data:', error)
    } finally {
      setLoading(false)
    }
  }

  const logOrderFieldChanges = async (updatedData: OrderForm) => {
    if (!originalFormData || !orderId) return

    try {
      const fieldMappings = {
        customer_id: 'Customer',
        finished_fabric_id: 'Product',
        color: 'Color',
        quantity_ordered: 'Quantity',
        due_date: 'Due Date',
        priority: 'Priority',
        status: 'Status',
        notes: 'Notes',
        invoice_number: 'Invoice Number',
        gate_pass_number: 'Gate Pass Number',
        delivery_note_number: 'Delivery Note Number',
        dispatch_date: 'Dispatch Date',
        dispatch_notes: 'Dispatch Notes'
      }

      const changedFields = []

      // Compare each field
      for (const [key, value] of Object.entries(updatedData)) {
        const originalValue = originalFormData[key as keyof OrderForm]
        if (originalValue !== value && key in fieldMappings) {
          changedFields.push({
            field: key,
            fieldName: fieldMappings[key as keyof typeof fieldMappings],
            oldValue: originalValue?.toString() || '',
            newValue: value?.toString() || ''
          })
        }
      }

      // Log each changed field
      for (const change of changedFields) {
        await logCustomerOrderAudit(orderId, {
          action_type: 'field_updated',
          field_changed: change.field,
          old_value: change.oldValue,
          new_value: change.newValue,
          change_description: `${change.fieldName} updated from "${change.oldValue}" to "${change.newValue}"`,
          changed_by: 'User',
          change_reason: 'Order information updated via edit form'
        })
      }

      // Log summary if multiple fields changed
      if (changedFields.length > 1) {
        await logCustomerOrderAudit(orderId, {
          action_type: 'bulk_update',
          change_description: `Order updated: ${changedFields.length} fields modified (${changedFields.map(f => f.fieldName).join(', ')})`,
          changed_by: 'User',
          change_reason: 'Multiple field updates via edit form'
        })
      }
    } catch (error) {
      console.error('Error logging field changes:', error)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.customer_id) {
      newErrors.customer_id = 'Please select a customer'
    }

    if (!formData.finished_fabric_id) {
      newErrors.finished_fabric_id = 'Please select a product'
    }

    if (!formData.color.trim()) {
      newErrors.color = 'Please specify the color for this order'
    }

    if (!formData.quantity_ordered || formData.quantity_ordered <= 0) {
      newErrors.quantity_ordered = 'Please enter a valid quantity'
    }

    if (!formData.due_date) {
      newErrors.due_date = 'Please select a due date'
    } else {
      const selectedDate = new Date(formData.due_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (selectedDate < today) {
        newErrors.due_date = 'Due date cannot be in the past'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    // Store form data and show PIN modal for authorization
    setPendingFormData(formData)
    setShowPinModal(true)
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (pin !== '0000') {
      setPinError('Invalid PIN. Please try again.')
      return
    }

    if (!pendingFormData) return

    setSaving(true)
    setShowPinModal(false)
    setPinError('')
    setPin('')

    try {
      console.log('Updating order with data:', pendingFormData)
      
      const { error } = await supabase
        .from('customer_orders')
        .update({
          customer_id: pendingFormData.customer_id,
          finished_fabric_id: pendingFormData.finished_fabric_id,
          color: pendingFormData.color || null,
          quantity_ordered: pendingFormData.quantity_ordered,
          due_date: pendingFormData.due_date,
          priority_override: mapPriorityToNumber(pendingFormData.priority),
          order_status: pendingFormData.status,
          notes: pendingFormData.notes,
          invoice_number: pendingFormData.invoice_number || null,
          gate_pass_number: pendingFormData.gate_pass_number || null,
          delivery_note_number: pendingFormData.delivery_note_number || null,
          dispatch_date: pendingFormData.dispatch_date || null,
          dispatch_notes: pendingFormData.dispatch_notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      console.log('Order updated successfully')
      
      // Log field changes in audit trail
      await logOrderFieldChanges(pendingFormData)
      
      onOrderUpdated()
      onClose()
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Failed to update order. Please try again.')
    } finally {
      setSaving(false)
      setPendingFormData(null)
    }
  }

  const handlePinCancel = () => {
    setShowPinModal(false)
    setPinError('')
    setPin('')
    setPendingFormData(null)
  }

  const selectedFabric = fabrics.find(f => f.id === formData.finished_fabric_id)

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" />
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white shadow-xl sm:my-8 sm:w-full sm:max-w-2xl">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Edit Order
                    </Dialog.Title>
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
                      <p className="mt-2 text-sm text-gray-700">Loading order...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Customer Selection */}
                      <div>
                        <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700 mb-2">
                          Customer *
                        </label>
                        <select
                          id="customer_id"
                          value={formData.customer_id}
                          onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select a customer</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                            </option>
                          ))}
                        </select>
                        {errors.customer_id && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                            {errors.customer_id}
                          </p>
                        )}
                      </div>

                      {/* Product Selection */}
                      <div>
                        <label htmlFor="finished_fabric_id" className="block text-sm font-medium text-gray-700 mb-2">
                          Product *
                        </label>
                        <select
                          id="finished_fabric_id"
                          value={formData.finished_fabric_id}
                          onChange={(e) => setFormData({ ...formData, finished_fabric_id: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select a product</option>
                          {fabrics.map((fabric) => (
                            <option key={fabric.id} value={fabric.id}>
                              {fabric.name} - {fabric.color} ({fabric.stock_quantity}m available)
                            </option>
                          ))}
                        </select>
                        {errors.finished_fabric_id && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                            {errors.finished_fabric_id}
                          </p>
                        )}
                      </div>

                      {/* Color Specification */}
                      <div>
                        <ColorDropdown
                          id="color"
                          value={formData.color}
                          onChange={(value) => setFormData({ ...formData, color: value })}
                          label="Color"
                          placeholder="Select a color"
                          error={errors.color}
                          required={true}
                          helperText="Specify the exact color required for this order."
                        />
                      </div>

                      {/* Quantity and Due Date */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="quantity_ordered" className="block text-sm font-medium text-gray-700 mb-2">
                            Quantity (meters) *
                          </label>
                          <input
                            type="number"
                            id="quantity_ordered"
                            min="1"
                            step="0.01"
                            value={formData.quantity_ordered}
                            onChange={(e) => setFormData({ ...formData, quantity_ordered: parseFloat(e.target.value) || 0 })}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          {errors.quantity_ordered && (
                            <p className="mt-1 text-sm text-red-600 flex items-center">
                              <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                              {errors.quantity_ordered}
                            </p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-2">
                            Due Date *
                          </label>
                          <input
                            type="date"
                            id="due_date"
                            value={formData.due_date}
                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                          {errors.due_date && (
                            <p className="mt-1 text-sm text-red-600 flex items-center">
                              <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                              {errors.due_date}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Priority and Status */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                            Priority
                          </label>
                          <select
                            id="priority"
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                            Status
                          </label>
                          <select
                            id="status"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="partially_allocated">Partially Allocated</option>
                            <option value="fully_allocated">Fully Allocated</option>
                            <option value="in_production">In Production</option>
                            <option value="production_complete">Production Complete</option>
                            <option value="ready_for_dispatch">Ready for Dispatch</option>
                            <option value="dispatched">Dispatched</option>
                            <option value="delivered">Delivered</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                          Notes
                        </label>
                        <textarea
                          id="notes"
                          rows={3}
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Any additional notes..."
                        />
                      </div>

                      {/* Dispatch Information - Only show for relevant statuses */}
                      {['ready_for_dispatch', 'dispatched', 'delivered', 'completed'].includes(formData.status) && (
                        <div className="border-t border-gray-200 pt-6">
                          <h4 className="text-lg font-medium text-gray-900 mb-4">Dispatch Information</h4>
                          
                          {/* Document Numbers */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <label htmlFor="invoice_number" className="block text-sm font-medium text-gray-700 mb-2">
                                Invoice Number
                              </label>
                              <input
                                type="text"
                                id="invoice_number"
                                value={formData.invoice_number}
                                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="SAGE PASTEL Invoice #"
                              />
                            </div>

                            <div>
                              <label htmlFor="gate_pass_number" className="block text-sm font-medium text-gray-700 mb-2">
                                Gate Pass Number
                              </label>
                              <input
                                type="text"
                                id="gate_pass_number"
                                value={formData.gate_pass_number}
                                onChange={(e) => setFormData({ ...formData, gate_pass_number: e.target.value })}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Gate Pass #"
                              />
                            </div>

                            <div>
                              <label htmlFor="delivery_note_number" className="block text-sm font-medium text-gray-700 mb-2">
                                Delivery Note Number
                              </label>
                              <input
                                type="text"
                                id="delivery_note_number"
                                value={formData.delivery_note_number}
                                onChange={(e) => setFormData({ ...formData, delivery_note_number: e.target.value })}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Delivery Note #"
                              />
                            </div>
                          </div>

                          {/* Dispatch Date */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label htmlFor="dispatch_date" className="block text-sm font-medium text-gray-700 mb-2">
                                Dispatch Date
                              </label>
                              <input
                                type="date"
                                id="dispatch_date"
                                value={formData.dispatch_date}
                                onChange={(e) => setFormData({ ...formData, dispatch_date: e.target.value })}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>

                          {/* Dispatch Notes */}
                          <div>
                            <label htmlFor="dispatch_notes" className="block text-sm font-medium text-gray-700 mb-2">
                              Dispatch Notes
                            </label>
                            <textarea
                              id="dispatch_notes"
                              rows={3}
                              value={formData.dispatch_notes}
                              onChange={(e) => setFormData({ ...formData, dispatch_notes: e.target.value })}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Additional dispatch information..."
                            />
                          </div>
                        </div>
                      )}

                      {/* Stock Warning */}
                      {selectedFabric && formData.quantity_ordered > selectedFabric.stock_quantity && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                          <div className="flex">
                            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
                            <div>
                              <p className="text-sm text-yellow-800">
                                <strong>Stock Warning:</strong> Requested quantity ({formData.quantity_ordered}m) exceeds available stock ({selectedFabric.stock_quantity}m).
                              </p>
                              <p className="text-xs text-yellow-700 mt-1">
                                Additional production will be required.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="submit"
                    disabled={saving || loading}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>

      {/* PIN Authorization Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Authorization Required</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please enter your PIN to authorize order changes.
            </p>
            <form onSubmit={handlePinSubmit}>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                maxLength={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-lg tracking-widest text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
              {pinError && (
                <p className="mt-2 text-sm text-red-600 text-center">{pinError}</p>
              )}
              <div className="flex space-x-3 mt-4">
                <button
                  type="button"
                  onClick={handlePinCancel}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!pin || saving}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Transition.Root>
  )
} 