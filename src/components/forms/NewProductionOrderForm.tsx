'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { logBusinessEvent } from '@/lib/utils/auditTrail'
import { numberingUtils } from '@/lib/utils/numberingUtils'

interface NewProductionOrderFormProps {
  isOpen: boolean
  onClose: () => void
  onOrderCreated: () => void
}

interface BaseFabric {
  id: string
  name: string
  gsm: number
  width_meters: number
  color: string | null
  stock_quantity: number
}

interface FinishedFabric {
  id: string
  name: string
  base_fabric_id: string | null
  gsm: number
  width_meters: number
  color: string | null
  coating_type: string | null
  stock_quantity: number
  base_fabrics?: {
    id: string
    name: string
    stock_quantity: number
    last_batch_number?: string | null
  } | null
}

interface OrderFormData {
  production_type: 'weaving' | 'coating'
  fabric_id: string
  quantity_required: number
  priority_level: number
  target_completion_date: string
  notes: string
  coating_color?: string // Color for coating operations
}

export default function NewProductionOrderForm({ isOpen, onClose, onOrderCreated }: NewProductionOrderFormProps) {
  const [baseFabrics, setBaseFabrics] = useState<BaseFabric[]>([])
  const [finishedFabrics, setFinishedFabrics] = useState<FinishedFabric[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<OrderFormData>({
    production_type: 'weaving',
    fabric_id: '',
    quantity_required: 0,
    priority_level: 1,
    target_completion_date: '',
    notes: '',
    coating_color: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [analysisResult, setAnalysisResult] = useState<{
    requiresLinkedOrder: boolean
    linkedOrderType?: 'weaving'
    baseAvailable?: number
    message: string
  } | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadFabrics()
      // Set default target date to 7 days from now
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 7)
      setFormData(prev => ({
        ...prev,
        target_completion_date: defaultDate.toISOString().split('T')[0]
      }))
    }
  }, [isOpen])

  useEffect(() => {
    if (formData.production_type === 'coating' && formData.fabric_id && formData.quantity_required > 0) {
      analyzeCoatingRequirements()
    } else {
      setAnalysisResult(null)
    }
  }, [formData.production_type, formData.fabric_id, formData.quantity_required])

  const loadFabrics = async () => {
    try {
      setLoading(true)
      
      const [baseFabricsResponse, finishedFabricsResponse] = await Promise.all([
        supabase
          .from('base_fabrics')
          .select('*')
          .order('name'),
        supabase
          .from('finished_fabrics')
          .select(`
            *,
            base_fabrics (
              id,
              name,
              stock_quantity,
              last_batch_number
            )
          `)
          .order('name')
      ])

      if (baseFabricsResponse.error) throw baseFabricsResponse.error
      if (finishedFabricsResponse.error) throw finishedFabricsResponse.error

      setBaseFabrics(baseFabricsResponse.data || [])
      setFinishedFabrics(finishedFabricsResponse.data || [])
    } catch (error) {
      console.error('Error loading fabrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeCoatingRequirements = async () => {
    const selectedFabric = finishedFabrics.find(f => f.id === formData.fabric_id)
    if (!selectedFabric || !selectedFabric.base_fabric_id) {
      setAnalysisResult({
        requiresLinkedOrder: false,
        message: 'No base fabric relationship found'
      })
      return
    }

    const baseAvailable = selectedFabric.base_fabrics?.stock_quantity || 0
    const required = formData.quantity_required

    if (baseAvailable >= required) {
      setAnalysisResult({
        requiresLinkedOrder: false,
        baseAvailable,
        message: `✅ Sufficient base fabric available (${baseAvailable}m). Can start coating immediately.`
      })
    } else {
      const shortage = required - baseAvailable
      setAnalysisResult({
        requiresLinkedOrder: true,
        linkedOrderType: 'weaving',
        baseAvailable,
        message: `⚠️ Insufficient base fabric. Available: ${baseAvailable}m, Required: ${required}m. Will create weaving order for ${shortage}m.`
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.fabric_id) {
      newErrors.fabric_id = 'Please select a fabric'
    }

    if (!formData.quantity_required || formData.quantity_required <= 0) {
      newErrors.quantity_required = 'Please enter a valid quantity'
    }

    if (!formData.target_completion_date) {
      newErrors.target_completion_date = 'Please select a target completion date'
    } else {
      const selectedDate = new Date(formData.target_completion_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (selectedDate < today) {
        newErrors.target_completion_date = 'Target date cannot be in the past'
      }
    }

    // Validate coating color for coating operations
    if (formData.production_type === 'coating' && !formData.coating_color?.trim()) {
      newErrors.coating_color = 'Please specify the coating color'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setSubmitting(true)

      if (formData.production_type === 'weaving') {
        await createWeavingOrder()
      } else {
        await createCoatingOrder()
      }

      onOrderCreated()
      onClose()
      resetForm()
    } catch (error) {
      console.error('Error creating production order:', error)
      setErrors({ submit: 'Failed to create production order. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const createWeavingOrder = async () => {
    const orderData = {
      internal_order_number: await numberingUtils.generateProductionOrderNumber('weaving'),
      production_type: 'weaving',
      customer_order_id: null, // Manual stock building order
      base_fabric_id: formData.fabric_id,
      finished_fabric_id: null,
      quantity_required: formData.quantity_required,
      quantity_produced: 0,
      production_status: 'pending',
      priority_level: formData.priority_level,
      target_completion_date: formData.target_completion_date,
      notes: formData.notes || 'Manual stock building order',
      production_sequence: 1,
      linked_production_order_id: null
    }

    const { data: response, error } = await supabase
      .from('production_orders')
      .insert([orderData])
      .select('id')
      .single()

    if (error) throw error

    // Log production order creation in audit trail
    if (response?.id) {
      const selectedFabric = baseFabrics.find(f => f.id === formData.fabric_id)
      const fabricName = selectedFabric?.name || 'Unknown Fabric'

      // Log order received
      await logBusinessEvent.productionOrder.created(response.id, {
        orderNumber: orderData.internal_order_number,
        type: 'weaving',
        fabric: fabricName,
        quantity: formData.quantity_required
      })

      // Log production planning
      await logBusinessEvent.productionOrder.planned(response.id, {
        targetDate: formData.target_completion_date,
        orderNumber: orderData.internal_order_number
      })
    }
  }

  const createCoatingOrder = async () => {
    const selectedFabric = finishedFabrics.find(f => f.id === formData.fabric_id)
    let weavingOrderId = null

    // Create linked weaving order if needed
    if (analysisResult?.requiresLinkedOrder) {
      const baseAvailable = analysisResult.baseAvailable || 0
      const shortage = formData.quantity_required - baseAvailable

      const weavingData = {
        internal_order_number: await numberingUtils.generateProductionOrderNumber('weaving'),
        production_type: 'weaving',
        customer_order_id: null,
        base_fabric_id: selectedFabric?.base_fabric_id,
        finished_fabric_id: null,
        quantity_required: shortage,
        quantity_produced: 0,
        production_status: 'pending',
        priority_level: formData.priority_level,
        target_completion_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days earlier
        notes: `Weaving for coating order - ${shortage}m base fabric needed`,
        production_sequence: 1,
        linked_production_order_id: null
      }

      const { data: weavingResponse, error: weavingError } = await supabase
        .from('production_orders')
        .insert([weavingData])
        .select('id')
        .single()

      if (weavingError) throw weavingError
      weavingOrderId = weavingResponse.id

      // Log linked weaving order creation
      if (weavingOrderId) {
        await logBusinessEvent.productionOrder.created(weavingOrderId, {
          orderNumber: weavingData.internal_order_number,
          type: 'weaving',
          fabric: selectedFabric?.name || 'Unknown Fabric',
          quantity: shortage
        })

        await logBusinessEvent.productionOrder.planned(weavingOrderId, {
          targetDate: weavingData.target_completion_date,
          orderNumber: weavingData.internal_order_number
        })
      }
    }

    // Create the coating order
    const coatingData = {
      internal_order_number: await numberingUtils.generateProductionOrderNumber('coating'),
      production_type: 'coating',
      customer_order_id: null,
      base_fabric_id: null,
      finished_fabric_id: formData.fabric_id,
      quantity_required: formData.quantity_required,
      quantity_produced: 0,
      production_status: weavingOrderId ? 'waiting_materials' : 'pending',
      priority_level: formData.priority_level,
      target_completion_date: formData.target_completion_date,
      notes: formData.notes || 'Manual coating order',
      production_sequence: weavingOrderId ? 2 : 1,
      linked_production_order_id: weavingOrderId
    }

    const { data: response, error } = await supabase
      .from('production_orders')
      .insert([coatingData])
      .select('id')
      .single()

    if (error) throw error

    // Log coating order creation
    if (response?.id) {
      await logBusinessEvent.productionOrder.created(response.id, {
        orderNumber: coatingData.internal_order_number,
        type: 'coating',
        fabric: selectedFabric?.name || 'Unknown Fabric',
        quantity: formData.quantity_required
      })

      await logBusinessEvent.productionOrder.planned(response.id, {
        targetDate: formData.target_completion_date,
        orderNumber: coatingData.internal_order_number
      })
    }
  }

  const resetForm = () => {
    setFormData({
      production_type: 'weaving',
      fabric_id: '',
      quantity_required: 0,
      priority_level: 1,
      target_completion_date: '',
      notes: '',
      coating_color: ''
    })
    setErrors({})
    setAnalysisResult(null)
  }

  const priorityOptions = [
    { value: 0, label: 'Low', color: 'text-gray-700' },
    { value: 1, label: 'Normal', color: 'text-gray-600' },
    { value: 3, label: 'High', color: 'text-orange-600' },
    { value: 5, label: 'Urgent', color: 'text-red-600' }
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-8 mx-auto p-0 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Create New Production Order</h3>
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
            {/* Production Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Production Type *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="relative">
                  <input
                    type="radio"
                    name="production_type"
                    value="weaving"
                    checked={formData.production_type === 'weaving'}
                    onChange={(e) => setFormData({ ...formData, production_type: e.target.value as 'weaving' | 'coating' })}
                    className="sr-only"
                  />
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.production_type === 'weaving' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="text-center">
                      <h4 className="font-medium text-gray-900">Weaving</h4>
                      <p className="text-sm text-gray-700 mt-1">Produce base fabric from raw materials</p>
                    </div>
                  </div>
                </label>
                
                <label className="relative">
                  <input
                    type="radio"
                    name="production_type"
                    value="coating"
                    checked={formData.production_type === 'coating'}
                    onChange={(e) => setFormData({ ...formData, production_type: e.target.value as 'weaving' | 'coating' })}
                    className="sr-only"
                  />
                  <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.production_type === 'coating' 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <div className="text-center">
                      <h4 className="font-medium text-gray-900">Coating</h4>
                      <p className="text-sm text-gray-700 mt-1">Apply coating to base fabric</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Fabric Selection */}
            <div>
              <label htmlFor="fabric_id" className="block text-sm font-medium text-gray-700 mb-2">
                {formData.production_type === 'weaving' ? 'Base Fabric' : 'Finished Fabric'} *
              </label>
              <select
                id="fabric_id"
                value={formData.fabric_id}
                onChange={(e) => setFormData({ ...formData, fabric_id: e.target.value })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.fabric_id ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select a fabric</option>
                {formData.production_type === 'weaving' 
                  ? baseFabrics.map((fabric) => (
                      <option key={fabric.id} value={fabric.id}>
                        {fabric.name} - {fabric.gsm}GSM, {fabric.width_meters}m
                        {fabric.color && `, ${fabric.color}`} (Stock: {fabric.stock_quantity}m)
                      </option>
                    ))
                  : finishedFabrics.map((fabric) => (
                      <option key={fabric.id} value={fabric.id}>
                        {fabric.name} - {fabric.gsm}GSM, {fabric.width_meters}m
                        {fabric.color && `, ${fabric.color}`}
                        {fabric.coating_type && `, ${fabric.coating_type}`} (Stock: {fabric.stock_quantity}m)
                      </option>
                    ))
                }
              </select>
              {errors.fabric_id && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.fabric_id}
                </p>
              )}
            </div>

            {/* Coating Color - Only show for coating operations */}
            {formData.production_type === 'coating' && (
              <div>
                <label htmlFor="coating_color" className="block text-sm font-medium text-gray-700 mb-2">
                  Coating Color *
                </label>
                <select
                  id="coating_color"
                  value={formData.coating_color || ''}
                  onChange={(e) => setFormData({ ...formData, coating_color: e.target.value })}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.coating_color ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select coating color</option>
                  <option value="Black">Black</option>
                  <option value="Navy Blue">Navy Blue</option>
                  <option value="Olive Green">Olive Green</option>
                  <option value="Forest Green">Forest Green</option>
                  <option value="Brown">Brown</option>
                  <option value="Grey">Grey</option>
                  <option value="White">White</option>
                  <option value="Red">Red</option>
                  <option value="Yellow">Yellow</option>
                  <option value="Orange">Orange</option>
                  <option value="Blue">Blue</option>
                  <option value="Custom">Custom Color</option>
                </select>
                {errors.coating_color && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                    {errors.coating_color}
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-700">
                  This color will be applied during the coating process
                </p>
              </div>
            )}

            {/* Quantity Required */}
            <div>
              <label htmlFor="quantity_required" className="block text-sm font-medium text-gray-700 mb-2">
                Quantity Required (meters) *
              </label>
              <input
                type="number"
                id="quantity_required"
                value={formData.quantity_required || ''}
                onChange={(e) => setFormData({ ...formData, quantity_required: parseInt(e.target.value) || 0 })}
                min="1"
                step="1"
                className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.quantity_required ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter quantity in meters"
              />
              {errors.quantity_required && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.quantity_required}
                </p>
              )}
            </div>

            {/* Analysis Result for Coating Orders */}
            {analysisResult && (
              <div className={`p-4 rounded-md border ${
                analysisResult.requiresLinkedOrder 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <p className={`text-sm ${
                  analysisResult.requiresLinkedOrder 
                    ? 'text-yellow-800' 
                    : 'text-green-800'
                }`}>
                  {analysisResult.message}
                </p>
                {analysisResult.requiresLinkedOrder && (
                  <p className="text-xs text-yellow-700 mt-1">
                    The system will automatically create a weaving order first.
                  </p>
                )}
              </div>
            )}

            {/* Priority Level */}
            <div>
              <label htmlFor="priority_level" className="block text-sm font-medium text-gray-700 mb-2">
                Priority Level
              </label>
              <select
                id="priority_level"
                value={formData.priority_level}
                onChange={(e) => setFormData({ ...formData, priority_level: parseInt(e.target.value) })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Completion Date */}
            <div>
              <label htmlFor="target_completion_date" className="block text-sm font-medium text-gray-700 mb-2">
                Target Completion Date *
              </label>
              <input
                type="date"
                id="target_completion_date"
                value={formData.target_completion_date}
                onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.target_completion_date ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.target_completion_date && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  {errors.target_completion_date}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional notes about this production order..."
              />
            </div>

            {/* Error Messages */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                  {errors.submit}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Production Order'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
} 