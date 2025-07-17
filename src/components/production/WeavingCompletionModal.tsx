'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { loomTrackingUtils, LoomProductionDetail } from '@/lib/utils/loomTrackingUtils'

interface Loom {
  id: string
  loom_number: string
  loom_name: string
  status: string
}

interface WeavingCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  productionOrder: {
    id: string
    internal_order_number: string
    production_type: string
    quantity_required: number
    quantity_produced: number
    base_fabric_id: string | null
    customer_orders?: {
      internal_order_number: string
      customers: {
        name: string
      }
    } | null
    base_fabrics?: {
      name: string
    } | null
  }
  onCompleted: () => void
}

interface LoomRollDetail {
  rollLength: number
  qualityGrade: 'A' | 'B' | 'C'
  qualityNotes?: string
}

interface LoomFormData {
  loomId: string
  loomNumber: string
  plannedQuantity: number
  actualQuantity: number
  rollDetails: LoomRollDetail[]
  productionStartTime: string
  productionEndTime: string
  qualityNotes?: string
  issuesEncountered?: string
}

export default function WeavingCompletionModal({
  isOpen,
  onClose,
  productionOrder,
  onCompleted
}: WeavingCompletionModalProps) {
  const [looms, setLooms] = useState<Loom[]>([])
  const [loomData, setLoomData] = useState<LoomFormData[]>([])
  const [actualQuantity, setActualQuantity] = useState(productionOrder.quantity_required)
  const [incompleteReason, setIncompleteReason] = useState('')
  const [balanceStatus, setBalanceStatus] = useState<'in_production' | 'cancelled' | 'completed'>('completed')
  const [completionNotes, setCompletionNotes] = useState('')
  const [completedBy, setCompletedBy] = useState('Production Manager')
  const [loading, setLoading] = useState(false)
  const [pin, setPin] = useState('')
  const [showPinStep, setShowPinStep] = useState(false)
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadLooms()
      resetForm()
    }
  }, [isOpen])

  const loadLooms = async () => {
    try {
      const { data, error } = await supabase
        .from('looms')
        .select('*')
        .eq('status', 'active')
        .eq('loom_type', 'weaving')
        .order('loom_number', { ascending: true })

      if (error) {
        console.error('Error loading looms:', error)
        return
      }

      // Sort numerically in JavaScript to handle proper ordering
      const sortedLooms = (data || []).sort((a, b) => {
        const numA = parseInt(a.loom_number, 10)
        const numB = parseInt(b.loom_number, 10)
        return numA - numB
      })

      setLooms(sortedLooms)
    } catch (error) {
      console.error('Error loading looms:', error)
    }
  }

  const resetForm = () => {
    setLoomData([])
    setActualQuantity(productionOrder.quantity_required)
    setIncompleteReason('')
    setBalanceStatus('completed')
    setCompletionNotes('')
    setCompletedBy('Production Manager')
    setPin('')
    setShowPinStep(false)
    setPinError('')
  }

  const addLoom = () => {
    const newLoom: LoomFormData = {
      loomId: '',
      loomNumber: '',
      plannedQuantity: 0,
      actualQuantity: 0,
      rollDetails: [{ rollLength: 0, qualityGrade: 'A' }],
      productionStartTime: new Date().toISOString().slice(0, 16),
      productionEndTime: new Date().toISOString().slice(0, 16),
      qualityNotes: '',
      issuesEncountered: ''
    }
    setLoomData([...loomData, newLoom])
  }

  const removeLoom = (index: number) => {
    const newLoomData = loomData.filter((_, i) => i !== index)
    setLoomData(newLoomData)
  }

  const updateLoom = (index: number, field: keyof LoomFormData, value: any) => {
    const newLoomData = [...loomData]
    newLoomData[index] = { ...newLoomData[index], [field]: value }
    
    // Update loom number when loom is selected
    if (field === 'loomId') {
      const selectedLoom = looms.find(l => l.id === value)
      if (selectedLoom) {
        newLoomData[index].loomNumber = selectedLoom.loom_number
      }
    }
    
    setLoomData(newLoomData)
  }

  const addRoll = (loomIndex: number) => {
    const newLoomData = [...loomData]
    newLoomData[loomIndex].rollDetails.push({
      rollLength: 0,
      qualityGrade: 'A'
    })
    setLoomData(newLoomData)
  }

  const removeRoll = (loomIndex: number, rollIndex: number) => {
    const newLoomData = [...loomData]
    newLoomData[loomIndex].rollDetails = newLoomData[loomIndex].rollDetails.filter(
      (_, i) => i !== rollIndex
    )
    setLoomData(newLoomData)
  }

  const updateRoll = (loomIndex: number, rollIndex: number, field: keyof LoomRollDetail, value: any) => {
    const newLoomData = [...loomData]
    newLoomData[loomIndex].rollDetails[rollIndex] = {
      ...newLoomData[loomIndex].rollDetails[rollIndex],
      [field]: value
    }
    setLoomData(newLoomData)
  }

  const calculateTotalQuantity = () => {
    return loomData.reduce((total, loom) => total + loom.actualQuantity, 0)
  }

  const calculateTotalRolls = () => {
    return loomData.reduce((total, loom) => total + loom.rollDetails.length, 0)
  }

  const validateForm = () => {
    if (loomData.length === 0) {
      alert('Please add at least one loom.')
      return false
    }

    for (let i = 0; i < loomData.length; i++) {
      const loom = loomData[i]
      if (!loom.loomId) {
        alert(`Please select a loom for Loom ${i + 1}.`)
        return false
      }
      if (loom.actualQuantity <= 0) {
        alert(`Please enter actual quantity for Loom ${i + 1}.`)
        return false
      }
      if (loom.rollDetails.length === 0) {
        alert(`Please add at least one roll for Loom ${i + 1}.`)
        return false
      }
      
      for (let j = 0; j < loom.rollDetails.length; j++) {
        const roll = loom.rollDetails[j]
        if (roll.rollLength <= 0) {
          alert(`Please enter roll length for Roll ${j + 1} of Loom ${i + 1}.`)
          return false
        }
      }
    }

    const totalQuantity = calculateTotalQuantity()
    if (totalQuantity !== actualQuantity) {
      alert(`Total loom quantities (${totalQuantity}m) must equal actual quantity (${actualQuantity}m).`)
      return false
    }

    if (actualQuantity < productionOrder.quantity_required && !incompleteReason) {
      alert('Please provide a reason for incomplete production.')
      return false
    }

    return true
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setShowPinStep(true)
  }

  const updateLinkedProductionOrders = async (completedOrderId: string) => {
    try {
      // Find coating orders that are linked to this weaving order
      const { data: linkedOrders, error: fetchError } = await supabase
        .from('production_orders')
        .select('*')
        .eq('linked_production_order_id', completedOrderId)
        .eq('production_status', 'waiting_materials')

      if (fetchError) {
        console.error('Error fetching linked orders:', fetchError)
        return
      }

      if (linkedOrders && linkedOrders.length > 0) {
        // Update linked orders from 'waiting_materials' to 'pending'
        const { error: updateError } = await supabase
          .from('production_orders')
          .update({ 
            production_status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('linked_production_order_id', completedOrderId)
          .eq('production_status', 'waiting_materials')

        if (updateError) {
          console.error('Error updating linked orders:', updateError)
          return
        }

        console.log(`Updated ${linkedOrders.length} linked coating orders to pending status`)
      }
    } catch (error) {
      console.error('Error updating linked production orders:', error)
    }
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (pin !== '0000') {
      setPinError('Invalid PIN. Please try again.')
      return
    }

    setLoading(true)
    setPinError('')

    try {
      // Transform form data to match the expected interface
      const loomDetails: LoomProductionDetail[] = loomData.map(loom => ({
        loomId: loom.loomId,
        loomNumber: loom.loomNumber,
        plannedQuantity: loom.plannedQuantity,
        actualQuantity: loom.actualQuantity,
        rollsProduced: loom.rollDetails.length,
        rollDetails: loom.rollDetails,
        productionStartTime: loom.productionStartTime,
        productionEndTime: loom.productionEndTime,
        qualityNotes: loom.qualityNotes,
        issuesEncountered: loom.issuesEncountered
      }))

      const completionData = {
        productionOrderId: productionOrder.id,
        productionType: 'weaving' as const,
        plannedQuantity: productionOrder.quantity_required,
        actualQuantity: actualQuantity,
        completionNotes: completionNotes,
        completedBy: completedBy,
        loomDetails: loomDetails,
        incompleteReason: actualQuantity < productionOrder.quantity_required ? incompleteReason : undefined,
        balanceStatus: balanceStatus
      }

      // Complete weaving production with loom tracking
      const result = await loomTrackingUtils.completeWeavingProduction(completionData)

      // Update production order status
      await supabase
        .from('production_orders')
        .update({
          production_status: 'completed',
          quantity_produced: actualQuantity,
          actual_end_date: new Date().toISOString(),
          notes: completionNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', productionOrder.id)

      // Update base fabric stock
      if (productionOrder.base_fabric_id) {
        const { data: currentStock } = await supabase
          .from('base_fabrics')
          .select('stock_quantity')
          .eq('id', productionOrder.base_fabric_id)
          .single()

        const newStock = (currentStock?.stock_quantity || 0) + actualQuantity

        await supabase
          .from('base_fabrics')
          .update({
            stock_quantity: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', productionOrder.base_fabric_id)

        // Record stock movement
        await supabase
          .from('stock_movements')
          .insert({
            fabric_type: 'base_fabric',
            fabric_id: productionOrder.base_fabric_id,
            movement_type: 'production_in',
            quantity: actualQuantity,
            reference_id: productionOrder.id,
            reference_type: 'production_order',
            notes: `Weaving production completed - Batch ${result.batchNumber}`,
            created_at: new Date().toISOString()
          })
      }

      console.log('Weaving production completed successfully:', {
        batchNumber: result.batchNumber,
        loomRollsCreated: result.loomRolls.length,
        totalQuantity: actualQuantity
      })

      // Update linked coating orders from 'waiting_materials' to 'pending'
      await updateLinkedProductionOrders(productionOrder.id)

      onCompleted()
      onClose()
    } catch (error) {
      console.error('Error completing weaving production:', error)
      alert('Failed to complete weaving production. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Complete Weaving Production
            </h3>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Production Order Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Production Order Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-900"><strong>Order:</strong> {productionOrder.internal_order_number}</p>
                <p className="text-gray-900"><strong>Fabric:</strong> {productionOrder.base_fabrics?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-900"><strong>Planned Quantity:</strong> {productionOrder.quantity_required}m</p>
                <p className="text-gray-900"><strong>Customer:</strong> {productionOrder.customer_orders?.customers?.name || 'Stock Building'}</p>
              </div>
              <div>
                <p className="text-gray-900"><strong>Total Looms:</strong> {loomData.length}</p>
                <p className="text-gray-900"><strong>Total Rolls:</strong> {calculateTotalRolls()}</p>
              </div>
            </div>
          </div>

          {!showPinStep ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Actual Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Actual Quantity Produced (meters)
                </label>
                <input
                  type="number"
                  value={actualQuantity}
                  onChange={(e) => setActualQuantity(Number(e.target.value))}
                  min="0"
                  max={productionOrder.quantity_required}
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Incomplete Production Reason */}
              {actualQuantity < productionOrder.quantity_required && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Incomplete Production
                    </label>
                    <textarea
                      value={incompleteReason}
                      onChange={(e) => setIncompleteReason(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Explain why the full quantity was not produced..."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Balance Status
                    </label>
                    <select
                      value={balanceStatus}
                      onChange={(e) => setBalanceStatus(e.target.value as 'in_production' | 'cancelled' | 'completed')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="completed">Completed (no balance)</option>
                      <option value="in_production">Balance still in production</option>
                      <option value="cancelled">Balance cancelled</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Loom Details */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Loom Production Details</h4>
                  <button
                    type="button"
                    onClick={addLoom}
                    className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Loom
                  </button>
                </div>

                <div className="space-y-6">
                  {loomData.map((loom, loomIndex) => (
                    <div key={loomIndex} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-medium text-gray-900">Loom {loomIndex + 1}</h5>
                        <button
                          type="button"
                          onClick={() => removeLoom(loomIndex)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Select Loom
                          </label>
                          <select
                            value={loom.loomId}
                            onChange={(e) => updateLoom(loomIndex, 'loomId', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="">Select a loom...</option>
                            {looms.map(l => (
                              <option key={l.id} value={l.id}>
                                {l.loom_number} - {l.loom_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Planned Quantity (m)
                          </label>
                          <input
                            type="number"
                            value={loom.plannedQuantity}
                            onChange={(e) => updateLoom(loomIndex, 'plannedQuantity', Number(e.target.value))}
                            min="0"
                            step="0.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Actual Quantity (m)
                          </label>
                          <input
                            type="number"
                            value={loom.actualQuantity}
                            onChange={(e) => updateLoom(loomIndex, 'actualQuantity', Number(e.target.value))}
                            min="0"
                            step="0.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Production Start
                          </label>
                          <input
                            type="datetime-local"
                            value={loom.productionStartTime}
                            onChange={(e) => updateLoom(loomIndex, 'productionStartTime', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Production End
                          </label>
                          <input
                            type="datetime-local"
                            value={loom.productionEndTime}
                            onChange={(e) => updateLoom(loomIndex, 'productionEndTime', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </div>

                      {/* Roll Details */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h6 className="font-medium text-gray-900">Roll Details</h6>
                          <button
                            type="button"
                            onClick={() => addRoll(loomIndex)}
                            className="flex items-center px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <PlusIcon className="h-3 w-3 mr-1" />
                            Add Roll
                          </button>
                        </div>

                        <div className="space-y-2">
                          {loom.rollDetails.map((roll, rollIndex) => (
                            <div key={rollIndex} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Roll {rollIndex + 1} Length (m)
                                </label>
                                <input
                                  type="number"
                                  value={roll.rollLength}
                                  onChange={(e) => updateRoll(loomIndex, rollIndex, 'rollLength', Number(e.target.value))}
                                  min="0"
                                  step="0.1"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  required
                                />
                              </div>

                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Quality Grade
                                </label>
                                <select
                                  value={roll.qualityGrade}
                                  onChange={(e) => updateRoll(loomIndex, rollIndex, 'qualityGrade', e.target.value as 'A' | 'B' | 'C')}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="A">A Grade</option>
                                  <option value="B">B Grade</option>
                                  <option value="C">C Grade</option>
                                </select>
                              </div>

                              <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Quality Notes
                                </label>
                                <input
                                  type="text"
                                  value={roll.qualityNotes || ''}
                                  onChange={(e) => updateRoll(loomIndex, rollIndex, 'qualityNotes', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Optional notes..."
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => removeRoll(loomIndex, rollIndex)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Loom Notes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quality Notes
                          </label>
                          <textarea
                            value={loom.qualityNotes || ''}
                            onChange={(e) => updateLoom(loomIndex, 'qualityNotes', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Quality observations..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Issues Encountered
                          </label>
                          <textarea
                            value={loom.issuesEncountered || ''}
                            onChange={(e) => updateLoom(loomIndex, 'issuesEncountered', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Any issues or problems..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Production Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700">Total Looms:</p>
                    <p className="font-semibold text-blue-900">{loomData.length}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Total Rolls:</p>
                    <p className="font-semibold text-blue-900">{calculateTotalRolls()}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Total Quantity:</p>
                    <p className="font-semibold text-blue-900">{calculateTotalQuantity()}m</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Completion Rate:</p>
                    <p className="font-semibold text-blue-900">
                      {((actualQuantity / productionOrder.quantity_required) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Completion Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Notes
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="General notes about the production completion..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completed By
                  </label>
                  <input
                    type="text"
                    value={completedBy}
                    onChange={(e) => setCompletedBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Proceed to PIN Verification
                </button>
              </div>
            </form>
          ) : (
            // PIN Verification Step
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-2">PIN Verification Required</h4>
                <p className="text-sm text-gray-600">
                  Please enter your PIN to complete the weaving production.
                </p>
              </div>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-600 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter PIN"
                    maxLength={4}
                    autoComplete="new-password"
                    autoFocus
                  />
                  {pinError && (
                    <p className="mt-2 text-sm text-red-600 text-center">{pinError}</p>
                  )}
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowPinStep(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={!pin || loading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Completing...' : 'Complete Production'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 