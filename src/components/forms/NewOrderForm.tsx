'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { logBusinessEvent, generateOrderAuditDescription } from '@/lib/utils/auditTrail'

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

interface NewOrderFormProps {
  isOpen: boolean
  onClose: () => void
  onOrderCreated: () => void
}

interface OrderFormData {
  customer_id: string
  finished_fabric_id: string
  color: string
  quantity_ordered: number
  due_date: string
  customer_po_number: string
  priority_override: number
  notes: string
}

interface AllocationPlan {
  stock_allocated: number
  production_required: number
  needs_coating_production: boolean
  needs_weaving_production: boolean
  base_fabric_available: number
  base_fabric_required: number
}

export default function NewOrderForm({ isOpen, onClose, onOrderCreated }: NewOrderFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [fabrics, setFabrics] = useState<FinishedFabric[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState<OrderFormData>({
    customer_id: '',
    finished_fabric_id: '',
    color: '',
    quantity_ordered: 0,
    due_date: '',
    customer_po_number: '',
    priority_override: 0,
    notes: ''
  })

  // Load customers and fabrics when modal opens
  useEffect(() => {
    if (isOpen) {
      loadFormData()
      // Reset form when opening
      setFormData({
        customer_id: '',
        finished_fabric_id: '',
        color: '',
        quantity_ordered: 0,
        due_date: '',
        customer_po_number: '',
        priority_override: 0,
        notes: ''
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

      console.log('Raw fabric data from Supabase:', fabricsData)

      setCustomers(customersData || [])
      
      // Process fabric data to handle the base_fabrics relationship
      const processedFabrics = (fabricsData || []).map(fabric => {
        const processed = {
          ...fabric,
          stock_quantity: Number(fabric.stock_quantity) || 0, // Ensure it's a number
          base_fabrics: fabric.base_fabrics 
            ? {
                ...fabric.base_fabrics,
                stock_quantity: Number(fabric.base_fabrics.stock_quantity) || 0 // Ensure it's a number
              }
            : null
        }
        console.log(`Processed fabric ${fabric.name}:`, {
          finished_stock: fabric.stock_quantity,
          finished_stock_type: typeof fabric.stock_quantity,
          processed_finished_stock: processed.stock_quantity,
          processed_finished_stock_type: typeof processed.stock_quantity,
          base_fabric_link: fabric.base_fabric_id,
          raw_base_fabrics: fabric.base_fabrics,
          processed_base_fabric: processed.base_fabrics
        })
        return processed
      })
      
      console.log('Final processed fabrics:', processedFabrics)
      setFabrics(processedFabrics)
    } catch (error) {
      console.error('Error loading form data:', error)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
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



    // Note: We now allow orders higher than stock - production orders will be created automatically

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const calculateAllocationPlan = (fabric: FinishedFabric, orderQuantity: number): AllocationPlan => {
    const availableStock = fabric.stock_quantity
    const stockAllocated = Math.min(orderQuantity, availableStock)
    const productionRequired = Math.max(0, orderQuantity - availableStock)
    
    console.log('=== ALLOCATION CALCULATION ===')
    console.log('Fabric:', fabric.name)
    console.log('Order Quantity:', orderQuantity)
    console.log('Finished Fabric Stock:', availableStock)
    console.log('Stock Allocated:', stockAllocated)
    console.log('Production Required:', productionRequired)
    console.log('Base Fabric Data:', fabric.base_fabrics)
    
    let baseFabricAvailable = 0
    let needsWeavingProduction = false
    let baseFabricShortage = 0
    
    if (productionRequired > 0 && fabric.base_fabrics) {
      baseFabricAvailable = fabric.base_fabrics.stock_quantity
      baseFabricShortage = Math.max(0, productionRequired - baseFabricAvailable)
      needsWeavingProduction = baseFabricShortage > 0
      
      console.log('Base Fabric Available:', baseFabricAvailable)
      console.log('Base Fabric Shortage:', baseFabricShortage)
      console.log('Needs Weaving Production:', needsWeavingProduction)
    } else if (productionRequired > 0) {
      needsWeavingProduction = true // No base fabric linked
      baseFabricShortage = productionRequired
      console.log('No base fabric linked - needs weaving for full amount:', baseFabricShortage)
    }
    
    const result = {
      stock_allocated: stockAllocated,
      production_required: productionRequired,
      needs_coating_production: productionRequired > 0,
      needs_weaving_production: needsWeavingProduction,
      base_fabric_available: baseFabricAvailable,
      base_fabric_required: baseFabricShortage // Only the shortage amount
    }
    
    console.log('Final Allocation Plan:', result)
    console.log('=== END ALLOCATION CALCULATION ===')
    
    return result
  }

  const generateOrderNumber = (): string => {
    const today = new Date()
    const year = today.getFullYear().toString().slice(-2)
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `ORD${year}${month}${day}${random}`
  }

  const createProductionOrders = async (orderId: string, fabric: FinishedFabric, allocationPlan: AllocationPlan) => {
    let weavingOrderId = null

    // Step 1: Create weaving production order if needed (only for base fabric shortage)
    if (allocationPlan.needs_weaving_production) {
      const weavingOrder = {
        internal_order_number: `${generateOrderNumber()}-W`,
        production_type: 'weaving',
        customer_order_id: orderId,
        base_fabric_id: fabric.base_fabric_id,
        quantity_required: allocationPlan.base_fabric_required, // Only the shortage amount
        quantity_produced: 0,
        production_status: 'pending',
        priority_level: formData.priority_override,
        target_completion_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
        notes: `Weaving production for customer order - ${allocationPlan.base_fabric_required}m base fabric shortage`,
        production_sequence: 1
      }

      const { data: weavingResponse, error: weavingError } = await supabase
        .from('production_orders')
        .insert([weavingOrder])
        .select('id')
        .single()

      if (weavingError) {
        throw new Error(`Failed to create weaving production order: ${weavingError.message}`)
      }

      weavingOrderId = weavingResponse.id
    }

    // Step 2: Create coating production order if needed
    if (allocationPlan.needs_coating_production) {
      const coatingOrder = {
        internal_order_number: `${generateOrderNumber()}-C`,
        production_type: 'coating',
        customer_order_id: orderId,
        finished_fabric_id: fabric.id,
        quantity_required: allocationPlan.production_required, // Full production required
        quantity_produced: 0,
        production_status: allocationPlan.needs_weaving_production ? 'waiting_materials' : 'pending',
        priority_level: formData.priority_override,
        target_completion_date: new Date(Date.now() + (allocationPlan.needs_weaving_production ? 14 : 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `Coating production for customer order - ${allocationPlan.production_required}m finished fabric needed (${allocationPlan.base_fabric_available}m base fabric available)`,
        production_sequence: 2,
        linked_production_order_id: weavingOrderId // Link to weaving order if exists
      }

      const { error: coatingError } = await supabase
        .from('production_orders')
        .insert([coatingOrder])

      if (coatingError) {
        throw new Error(`Failed to create coating production order: ${coatingError.message}`)
      }
    }

    return { weavingOrderId, hasWeaving: allocationPlan.needs_weaving_production, hasCoating: allocationPlan.needs_coating_production }
  }

  const updateStockQuantities = async (fabric: FinishedFabric, allocationPlan: AllocationPlan) => {
    if (allocationPlan.stock_allocated > 0) {
      // Update finished fabric stock
      const { error } = await supabase
        .from('finished_fabrics')
        .update({ 
          stock_quantity: fabric.stock_quantity - allocationPlan.stock_allocated 
        })
        .eq('id', fabric.id)

      if (error) {
        throw new Error(`Failed to update stock: ${error.message}`)
      }

      // Log stock movement
      await supabase
        .from('stock_movements')
        .insert([{
          fabric_type: 'finished_fabric',
          fabric_id: fabric.id,
          movement_type: 'allocation',
          quantity: -allocationPlan.stock_allocated,
          reference_type: 'customer_order',
          notes: 'Stock allocated to customer order'
        }])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      setSubmitting(true)

      const selectedFabric = fabrics.find(f => f.id === formData.finished_fabric_id)
      if (!selectedFabric) {
        setErrors({ submit: 'Selected product not found. Please refresh and try again.' })
        return
      }

      // Calculate allocation plan
      let allocationPlan = calculateAllocationPlan(selectedFabric, formData.quantity_ordered)
      
      const orderData = {
        customer_id: formData.customer_id,
        finished_fabric_id: formData.finished_fabric_id,
        color: formData.color.trim(),
        quantity_ordered: formData.quantity_ordered,
        due_date: formData.due_date,
        customer_po_number: formData.customer_po_number,
        priority_override: formData.priority_override,
        notes: formData.notes,
        internal_order_number: generateOrderNumber(),
        order_status: 'pending',
        quantity_allocated: allocationPlan.stock_allocated
      }

      // Create the customer order
      const { data: orderResponse, error: orderError } = await supabase
        .from('customer_orders')
        .insert([orderData])
        .select('id')
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
        setErrors({ submit: 'Failed to create order. Please try again.' })
        return
      }

      const orderId = orderResponse.id

      // Log order creation in audit trail
      const selectedCustomer = customers.find(c => c.id === formData.customer_id)
      await logBusinessEvent.customerOrder.created(orderId, {
        orderNumber: orderData.internal_order_number,
        customer: selectedCustomer?.name || 'Unknown Customer',
        fabric: selectedFabric.name,
        quantity: formData.quantity_ordered
      })

      // Log initial allocation if stock was allocated
      if (allocationPlan.stock_allocated > 0) {
        await logBusinessEvent.customerOrder.stockAllocated(orderId, {
          quantity: allocationPlan.stock_allocated,
          remaining: allocationPlan.production_required,
          allocationDate: new Date().toISOString()
        })
      }

      // Update stock quantities
      await updateStockQuantities(selectedFabric, allocationPlan)

      // Create production orders if needed
      await createProductionOrders(orderId, selectedFabric, allocationPlan)

      // Success! Close modal and refresh orders
      onOrderCreated()
      onClose()
    } catch (error) {
      console.error('Error creating order:', error)
      setErrors({ submit: 'Failed to create order. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedFabric = fabrics.find(f => f.id === formData.finished_fabric_id)
  const currentAllocationPlan = selectedFabric && formData.quantity_ordered > 0 
    ? calculateAllocationPlan(selectedFabric, formData.quantity_ordered) 
    : null

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-8 mx-auto p-0 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Create New Order</h3>
          <button
            onClick={onClose}
                              className="text-gray-600 hover:text-gray-800 focus:outline-none"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading form data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Customer Selection */}
            <div>
              <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700 mb-2">
                Customer *
              </label>
              <select
                id="customer_id"
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.customer_id ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.contact_person && `(${customer.contact_person})`}
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
                className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.finished_fabric_id ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select a product</option>
                {fabrics.map((fabric) => (
                  <option key={fabric.id} value={fabric.id}>
                    {fabric.name} - {fabric.gsm}GSM, {fabric.width_meters}m
                    {fabric.color && `, ${fabric.color}`}
                    {fabric.coating_type && `, ${fabric.coating_type}`}
                  </option>
                ))}
              </select>
              {errors.finished_fabric_id && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.finished_fabric_id}
                </p>
              )}
              
              {/* Stock Information */}
              {selectedFabric && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Available Stock:</span>
                    <span className={`font-medium ${
                      selectedFabric.stock_quantity <= selectedFabric.minimum_stock 
                        ? 'text-red-600' 
                        : 'text-green-600'
                    }`}>
                      {selectedFabric.stock_quantity} meters
                    </span>
                  </div>
                  {selectedFabric.stock_quantity <= selectedFabric.minimum_stock && (
                    <div className="mt-1 flex items-center text-sm text-red-600">
                      <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                      Low stock warning
                    </div>
                  )}
                  
                  {/* Base Fabric Information */}
                  {selectedFabric.base_fabrics && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Base Fabric ({selectedFabric.base_fabrics.name}):</span>
                        <span className="font-medium text-blue-600">
                          {selectedFabric.base_fabrics.stock_quantity} meters
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Allocation Plan Preview */}
              {currentAllocationPlan && (
                <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Allocation Plan</h4>
                  
                                      <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Stock Allocated:</span>
                        <span className="font-medium text-blue-900">{currentAllocationPlan.stock_allocated} meters</span>
                      </div>
                      
                      {currentAllocationPlan.production_required > 0 && (
                        <div className="flex justify-between">
                          <span className="text-blue-700">Production Required:</span>
                          <span className="font-medium text-blue-900">{currentAllocationPlan.production_required} meters</span>
                        </div>
                      )}
                      
                      {currentAllocationPlan.needs_coating_production && (
                        <div className="flex items-center text-orange-700">
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          <span>Coating production order will be created</span>
                        </div>
                      )}
                      
                      {currentAllocationPlan.needs_weaving_production && (
                        <div className="flex items-center text-orange-700">
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          <span>Weaving production order will be created</span>
                        </div>
                      )}
                      
                      {currentAllocationPlan.production_required === 0 && (
                        <div className="flex items-center text-green-700">
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          <span>Order can be fulfilled from current stock</span>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* Color Specification */}
            <div>
              <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-2">
                Color *
              </label>
              <input
                type="text"
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.color ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., Navy Blue, Forest Green, Black, etc."
              />
              {errors.color && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.color}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-700">
                Specify the exact color required for this order. The coating production will use this color specification.
              </p>
            </div>

            {/* Quantity and Customer PO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="quantity_ordered" className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity (meters) *
                </label>
                <input
                  type="number"
                  id="quantity_ordered"
                  min="0"
                  step="0.01"
                  value={formData.quantity_ordered || ''}
                  onChange={(e) => setFormData({ ...formData, quantity_ordered: parseFloat(e.target.value) || 0 })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.quantity_ordered ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {errors.quantity_ordered && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                    {errors.quantity_ordered}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="customer_po_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Customer PO Number
                </label>
                <input
                  type="text"
                  id="customer_po_number"
                  value={formData.customer_po_number}
                  onChange={(e) => setFormData({ ...formData, customer_po_number: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter PO number"
                />
              </div>
            </div>

            {/* Due Date and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  id="due_date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.due_date ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.due_date && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                    {errors.due_date}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="priority_override" className="block text-sm font-medium text-gray-700 mb-2">
                  Priority Level
                </label>
                <select
                  id="priority_override"
                  value={formData.priority_override}
                  onChange={(e) => setFormData({ ...formData, priority_override: parseInt(e.target.value) })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={0}>Normal</option>
                  <option value={3}>Medium Priority</option>
                  <option value={5}>High Priority</option>
                  <option value={8}>Urgent</option>
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
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any additional notes or special instructions..."
              />
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.submit}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
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
                className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  submitting
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4 mr-2 inline-block" />
                    Create Order
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
} 