'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { logBusinessEvent } from '@/lib/utils/auditTrail'
import { numberingUtils } from '@/lib/utils/numberingUtils'
import ColorDropdown from '@/components/ui/ColorDropdown'

interface Customer {
  id: string
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
}

interface FinishedFabric {
  id: string
  name: string
  gsm: number
  width_meters: number
  color: string | null
  coating_type: string | null
  stock_quantity: number
  minimum_stock: number
  base_fabric_id: string | null
  base_fabrics?: {
    id: string
    name: string
    stock_quantity: number
  } | null
}

interface OrderItem {
  id: string // temporary ID for managing the form
  finished_fabric_id: string
  color: string
  quantity_ordered: number
  unit_price?: number
  notes?: string
}

interface NewOrderFormProps {
  isOpen: boolean
  onClose: () => void
  onOrderCreated: () => void
}

interface OrderFormData {
  customer_id: string
  due_date: string
  customer_po_number: string
  priority_override: number
  notes: string
  order_items: OrderItem[]
}

interface AllocationPlan {
  order_item_id: string
  stock_allocated: number
  production_required: number
  needs_coating_production: boolean
  needs_weaving_production: boolean
  base_fabric_available: number
  base_fabric_required: number
}

export default function NewOrderFormMultiColor({ isOpen, onClose, onOrderCreated }: NewOrderFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [fabrics, setFabrics] = useState<FinishedFabric[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState<OrderFormData>({
    customer_id: '',
    due_date: '',
    customer_po_number: '',
    priority_override: 0,
    notes: '',
    order_items: [{
      id: crypto.randomUUID(),
      finished_fabric_id: '',
      color: '',
      quantity_ordered: 0
    }]
  })

  // Load customers and fabrics when modal opens
  useEffect(() => {
    if (isOpen) {
      loadFormData()
      // Reset form when opening
      setFormData({
        customer_id: '',
        due_date: '',
        customer_po_number: '',
        priority_override: 0,
        notes: '',
        order_items: [{
          id: crypto.randomUUID(),
          finished_fabric_id: '',
          color: '',
          quantity_ordered: 0
        }]
      })
      setErrors({})
    }
  }, [isOpen])

  const loadFormData = async () => {
    try {
      setLoading(true)
      
      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, contact_person, email, phone')
        .order('name')

      if (customersError) {
        console.error('Error loading customers:', customersError)
        return
      }

      // Load finished fabrics with stock info and base fabric relationship
      const { data: fabricsData, error: fabricsError } = await supabase
        .from('finished_fabrics')
        .select(`
          *,
          base_fabrics!base_fabric_id (
            id, 
            name, 
            stock_quantity
          )
        `)
        .order('name')

      if (fabricsError) {
        console.error('Error loading fabrics:', fabricsError)
        return
      }

      setCustomers(customersData || [])
      setFabrics(fabricsData || [])
    } catch (error) {
      console.error('Error loading form data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addOrderItem = () => {
    setFormData(prev => ({
      ...prev,
      order_items: [
        ...prev.order_items,
        {
          id: crypto.randomUUID(),
          finished_fabric_id: '',
          color: '',
          quantity_ordered: 0
        }
      ]
    }))
  }

  const removeOrderItem = (itemId: string) => {
    if (formData.order_items.length > 1) {
      setFormData(prev => ({
        ...prev,
        order_items: prev.order_items.filter(item => item.id !== itemId)
      }))
    }
  }

  const updateOrderItem = (itemId: string, updates: Partial<OrderItem>) => {
    setFormData(prev => ({
      ...prev,
      order_items: prev.order_items.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      )
    }))
  }

  const handleInputChange = (field: keyof Omit<OrderFormData, 'order_items'>, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate basic fields
    if (!formData.customer_id) {
      newErrors.customer_id = 'Customer is required'
    }
    if (!formData.due_date) {
      newErrors.due_date = 'Due date is required'
    }

    // Validate order items
    if (formData.order_items.length === 0) {
      newErrors.order_items = 'At least one order item is required'
    }

    formData.order_items.forEach((item, index) => {
      if (!item.finished_fabric_id) {
        newErrors[`item_${index}_fabric`] = 'Fabric is required'
      }
      if (!item.color) {
        newErrors[`item_${index}_color`] = 'Color is required'
      }
      if (!item.quantity_ordered || item.quantity_ordered <= 0) {
        newErrors[`item_${index}_quantity`] = 'Quantity must be greater than 0'
      }
    })

    // Check for duplicate fabric/color combinations
    const combinations = new Set()
    formData.order_items.forEach((item, index) => {
      const combo = `${item.finished_fabric_id}-${item.color}`
      if (combinations.has(combo)) {
        newErrors[`item_${index}_duplicate`] = 'Duplicate fabric/color combination'
      }
      combinations.add(combo)
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const calculateTotalQuantity = (): number => {
    return formData.order_items.reduce((total, item) => total + (item.quantity_ordered || 0), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      // Generate internal order number
      const internalOrderNumber = await numberingUtils.generateOrderNumber()
      
      // Create customer order
      const { data: customerOrder, error: orderError } = await supabase
        .from('customer_orders')
        .insert({
          internal_order_number: internalOrderNumber,
          customer_po_number: formData.customer_po_number,
          customer_id: formData.customer_id,
          finished_fabric_id: formData.order_items[0]?.finished_fabric_id || null, // Keep for backward compatibility
          quantity_ordered: calculateTotalQuantity(),
          quantity_allocated: 0,
          due_date: formData.due_date,
          order_status: 'pending',
          priority_override: formData.priority_override,
          notes: formData.notes,
          color: formData.order_items[0]?.color || null // Keep for backward compatibility
        })
        .select()
        .single()

      if (orderError) {
        throw new Error(`Failed to create customer order: ${orderError.message}`)
      }

      // Create customer order items
      const orderItemsToInsert = formData.order_items.map(item => ({
        customer_order_id: customerOrder.id,
        finished_fabric_id: item.finished_fabric_id,
        color: item.color,
        quantity_ordered: item.quantity_ordered,
        quantity_allocated: 0,
        unit_price: item.unit_price,
        notes: item.notes
      }))

      const { error: itemsError } = await supabase
        .from('customer_order_items')
        .insert(orderItemsToInsert)

      if (itemsError) {
        throw new Error(`Failed to create order items: ${itemsError.message}`)
      }

      // Log business event
      await logBusinessEvent.customerOrder.created(customerOrder.id, {
        orderNumber: internalOrderNumber,
        customer: customers.find(c => c.id === formData.customer_id)?.name || 'Unknown Customer',
        fabric: `Multi-color order (${formData.order_items.length} items)`,
        quantity: calculateTotalQuantity()
      })

      onOrderCreated()
      onClose()
    } catch (error) {
      console.error('Error creating order:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Unknown error occurred' })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedFabric = formData.order_items[0]?.finished_fabric_id 
    ? fabrics.find(f => f.id === formData.order_items[0].finished_fabric_id)
    : null

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Create New Customer Order</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading form data...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Order Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Order Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Customer Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer *
                    </label>
                    <select
                      value={formData.customer_id}
                      onChange={(e) => handleInputChange('customer_id', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.customer_id ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                    {errors.customer_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.customer_id}</p>
                    )}
                  </div>

                  {/* Customer PO Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer PO Number
                    </label>
                    <input
                      type="text"
                      value={formData.customer_po_number}
                      onChange={(e) => handleInputChange('customer_po_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter customer PO number"
                    />
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date *
                    </label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => handleInputChange('due_date', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.due_date ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors.due_date && (
                      <p className="mt-1 text-sm text-red-600">{errors.due_date}</p>
                    )}
                  </div>

                  {/* Priority Override */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority Override
                    </label>
                    <select
                      value={formData.priority_override}
                      onChange={(e) => handleInputChange('priority_override', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={0}>Normal Priority</option>
                      <option value={1}>High Priority</option>
                      <option value={2}>Urgent Priority</option>
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter any special instructions or notes"
                  />
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-gray-900">Order Items</h4>
                  <button
                    type="button"
                    onClick={addOrderItem}
                    className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Item
                  </button>
                </div>

                {errors.order_items && (
                  <p className="mb-4 text-sm text-red-600">{errors.order_items}</p>
                )}

                <div className="space-y-4">
                  {formData.order_items.map((item, index) => (
                    <div key={item.id} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-md font-medium text-gray-800">Item {index + 1}</h5>
                        {formData.order_items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeOrderItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Finished Fabric */}
                        <div className="md:col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Finished Fabric *
                          </label>
                          <select
                            value={item.finished_fabric_id}
                            onChange={(e) => updateOrderItem(item.id, { finished_fabric_id: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              errors[`item_${index}_fabric`] ? 'border-red-300' : 'border-gray-300'
                            }`}
                          >
                            <option value="">Select Fabric</option>
                            {fabrics.map((fabric) => (
                              <option key={fabric.id} value={fabric.id}>
                                {fabric.name}
                              </option>
                            ))}
                          </select>
                          {errors[`item_${index}_fabric`] && (
                            <p className="mt-1 text-sm text-red-600">{errors[`item_${index}_fabric`]}</p>
                          )}
                        </div>

                        {/* Color */}
                        <div className="md:col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Color *
                          </label>
                          <ColorDropdown
                            value={item.color}
                            onChange={(color) => updateOrderItem(item.id, { color })}
                            className={`w-full ${
                              errors[`item_${index}_color`] ? 'border-red-300' : 'border-gray-300'
                            }`}
                          />
                          {errors[`item_${index}_color`] && (
                            <p className="mt-1 text-sm text-red-600">{errors[`item_${index}_color`]}</p>
                          )}
                        </div>

                        {/* Quantity */}
                        <div className="md:col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity (meters) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity_ordered || ''}
                            onChange={(e) => updateOrderItem(item.id, { quantity_ordered: parseFloat(e.target.value) || 0 })}
                            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              errors[`item_${index}_quantity`] ? 'border-red-300' : 'border-gray-300'
                            }`}
                            placeholder="0.00"
                          />
                          {errors[`item_${index}_quantity`] && (
                            <p className="mt-1 text-sm text-red-600">{errors[`item_${index}_quantity`]}</p>
                          )}
                        </div>

                        {/* Unit Price (Optional) */}
                        <div className="md:col-span-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Unit Price (Optional)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price || ''}
                            onChange={(e) => updateOrderItem(item.id, { unit_price: parseFloat(e.target.value) || undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Item Notes */}
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Item Notes
                        </label>
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => updateOrderItem(item.id, { notes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Any specific notes for this item"
                        />
                      </div>

                      {errors[`item_${index}_duplicate`] && (
                        <p className="mt-2 text-sm text-red-600">{errors[`item_${index}_duplicate`]}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Order Summary */}
                <div className="mt-6 bg-gray-100 p-4 rounded-lg">
                  <h5 className="text-md font-medium text-gray-800 mb-2">Order Summary</h5>
                  <div className="text-sm text-gray-600">
                    <p>Total Items: {formData.order_items.length}</p>
                    <p>Total Quantity: {calculateTotalQuantity().toFixed(2)} meters</p>
                    <p>Colors: {formData.order_items.map(item => item.color).filter(Boolean).join(', ') || 'None selected'}</p>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {submitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  {submitting ? 'Creating Order...' : 'Create Order'}
                </button>
              </div>

              {errors.submit && (
                <div className="flex items-center p-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded-md">
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  {errors.submit}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
} 