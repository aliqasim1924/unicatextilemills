'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { loomTrackingUtils, LoomRollData } from '@/lib/utils/loomTrackingUtils'

interface CoatingCompletionModalProps {
  isOpen: boolean
  onClose: () => void
  productionOrder: {
    id: string
    internal_order_number: string
    production_type: string
    quantity_required: number
    quantity_produced: number
    finished_fabric_id: string | null
    customer_orders?: {
      internal_order_number: string
      customers: {
        name: string
      }
    } | null
    finished_fabrics?: {
      name: string
    } | null
    linked_production_order_id?: string | null // Added for linking
  }
  onCompleted: () => void
}

interface SelectedRoll {
  loomRollId: string
  rollNumber: string
  loomNumber: string
  rollLength: number
  quantityUsed: number
  processingOrder: number
}

interface IndividualRoll {
  id: string
  rollNumber: string
  rollLength: number
  qualityNotes?: string
}

export default function CoatingCompletionModal({
  isOpen,
  onClose,
  productionOrder,
  onCompleted
}: CoatingCompletionModalProps) {
  const [availableRolls, setAvailableRolls] = useState<LoomRollData[]>([])
  const [selectedRolls, setSelectedRolls] = useState<SelectedRoll[]>([])
  const [actualQuantity, setActualQuantity] = useState(productionOrder.quantity_required)
  
  // Output grading
  const [aGrade50mRolls, setAGrade50mRolls] = useState(0)
  const [aGradeShortRolls, setAGradeShortRolls] = useState<IndividualRoll[]>([])
  const [bcGradeRolls, setBcGradeRolls] = useState<IndividualRoll[]>([])
  
  const [completionNotes, setCompletionNotes] = useState('')
  const [completedBy, setCompletedBy] = useState('Production Manager')
  const [loading, setLoading] = useState(false)
  const [pin, setPin] = useState('')
  const [showPinStep, setShowPinStep] = useState(false)
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadAvailableRolls()
      resetForm()
    }
  }, [isOpen, productionOrder.id])

  const loadAvailableRolls = async () => {
    try {
      setLoading(true)
      // Load rolls that have already been allocated for this coating production
      // Use the coating_roll_inputs table to find which rolls are allocated to this production order
      const { data, error } = await supabase
        .from('coating_roll_inputs')
        .select(`
          quantity_used,
          loom_rolls!inner (
            *,
            loom_production_details!inner (
              production_start_time,
              production_end_time,
              looms (loom_number),
              production_orders!inner (
                id,
                production_batches (
                  batch_number
                )
              )
            )
          )
        `)
        .eq('production_order_id', productionOrder.id)
        .order('created_at', { ascending: true })

      if (error) {
        throw new Error(`Failed to load allocated rolls: ${error.message}`)
      }

      // Transform the data to match the expected format
      const transformedRolls = data?.map(rollInput => {
        const roll = Array.isArray(rollInput.loom_rolls) ? rollInput.loom_rolls[0] : rollInput.loom_rolls
        return {
          id: roll?.id || '',
          rollNumber: roll?.roll_number || '',
          loomNumber: roll?.loom_production_details?.looms?.loom_number || 'Unknown',
          rollLength: roll?.roll_length || 0,
          qualityGrade: roll?.quality_grade || 'A',
          productionStartTime: roll?.loom_production_details?.production_start_time || '',
          productionEndTime: roll?.loom_production_details?.production_end_time || '',
          batchNumber: roll?.loom_production_details?.production_orders?.production_batches?.[0]?.batch_number || '',
          productionOrderId: roll?.loom_production_details?.production_orders?.id || '',
          quantityUsed: rollInput.quantity_used
        }
      }) || []

      // Automatically treat allocated rolls as selected for processing
      const selectedRollsData = transformedRolls.map((roll, index) => ({
        loomRollId: roll.id,
        rollNumber: roll.rollNumber,
        loomNumber: roll.loomNumber,
        rollLength: roll.rollLength,
        quantityUsed: roll.quantityUsed || roll.rollLength,
        processingOrder: index + 1
      }))

      setSelectedRolls(selectedRollsData)
      setAvailableRolls([]) // No available rolls since they're all allocated
    } catch (error) {
      console.error('Error loading allocated rolls:', error)
      alert('Failed to load allocated rolls')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedRolls([])
    setActualQuantity(productionOrder.quantity_required)
    setAGrade50mRolls(0)
    setAGradeShortRolls([])
    setBcGradeRolls([])
    setCompletionNotes('')
    setCompletedBy('Production Manager')
    setPin('')
    setShowPinStep(false)
    setPinError('')
  }

  // Note: addRoll and removeRoll functions removed as rolls are now pre-allocated

  const updateRoll = (index: number, field: keyof SelectedRoll, value: any) => {
    const newRolls = [...selectedRolls]
    newRolls[index] = { ...newRolls[index], [field]: value }
    setSelectedRolls(newRolls)
  }

  const moveRoll = (index: number, direction: 'up' | 'down') => {
    const newRolls = [...selectedRolls]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex >= 0 && targetIndex < newRolls.length) {
      // Swap rolls
      const temp = newRolls[index]
      newRolls[index] = newRolls[targetIndex]
      newRolls[targetIndex] = temp
      
      // Update processing order
      newRolls[index].processingOrder = index + 1
      newRolls[targetIndex].processingOrder = targetIndex + 1
      
      setSelectedRolls(newRolls)
    }
  }

  const calculateTotalInput = () => {
    return selectedRolls.reduce((total, roll) => total + roll.quantityUsed, 0)
  }

  const calculateAGradeShortTotal = () => {
    return aGradeShortRolls.reduce((total, roll) => total + roll.rollLength, 0)
  }

  const calculateBCGradeTotal = () => {
    return bcGradeRolls.reduce((total, roll) => total + roll.rollLength, 0)
  }

  const calculateTotalOutput = () => {
    return (aGrade50mRolls * 50) + calculateAGradeShortTotal() + calculateBCGradeTotal()
  }

  const calculateRemainingBalance = () => {
    const totalInput = calculateTotalInput()
    const aGrade50mTotal = aGrade50mRolls * 50
    return totalInput - aGrade50mTotal
  }

  const calculateWastagePercentage = () => {
    const totalInput = calculateTotalInput()
    if (totalInput === 0) return 0
    return (calculateBCGradeTotal() / totalInput) * 100
  }

  const addAGradeShortRoll = () => {
    const newRoll: IndividualRoll = {
      id: `a-short-${Date.now()}`,
      rollNumber: `A-SHORT-${aGradeShortRolls.length + 1}`,
      rollLength: 0,
      qualityNotes: ''
    }
    setAGradeShortRolls([...aGradeShortRolls, newRoll])
  }

  const removeAGradeShortRoll = (index: number) => {
    setAGradeShortRolls(aGradeShortRolls.filter((_, i) => i !== index))
  }

  const updateAGradeShortRoll = (index: number, field: keyof IndividualRoll, value: any) => {
    const newRolls = [...aGradeShortRolls]
    newRolls[index] = { ...newRolls[index], [field]: value }
    setAGradeShortRolls(newRolls)
  }

  const addBCGradeRoll = () => {
    const newRoll: IndividualRoll = {
      id: `bc-${Date.now()}`,
      rollNumber: `BC-${bcGradeRolls.length + 1}`,
      rollLength: 0,
      qualityNotes: ''
    }
    setBcGradeRolls([...bcGradeRolls, newRoll])
  }

  const removeBCGradeRoll = (index: number) => {
    setBcGradeRolls(bcGradeRolls.filter((_, i) => i !== index))
  }

  const updateBCGradeRoll = (index: number, field: keyof IndividualRoll, value: any) => {
    const newRolls = [...bcGradeRolls]
    newRolls[index] = { ...newRolls[index], [field]: value }
    setBcGradeRolls(newRolls)
  }

  const validateForm = () => {
    if (selectedRolls.length === 0) {
      alert('Please select at least one roll for processing.')
      return false
    }

    const totalInput = calculateTotalInput()
    const totalOutput = calculateTotalOutput()

    if (Math.abs(totalInput - totalOutput) > 0.1) {
      alert(`Total input (${totalInput}m) must equal total output (${totalOutput}m).`)
      return false
    }

    if (aGrade50mRolls < 0) {
      alert('A grade 50m roll quantities cannot be negative.')
      return false
    }

    // Validate A grade short rolls
    for (const roll of aGradeShortRolls) {
      if (roll.rollLength <= 0) {
        alert(`A grade short roll ${roll.rollNumber} must have a positive length.`)
        return false
      }
    }

    // Validate B/C grade rolls
    for (const roll of bcGradeRolls) {
      if (roll.rollLength <= 0) {
        alert(`B/C grade roll ${roll.rollNumber} must have a positive length.`)
        return false
      }
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

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (pin !== '0000') {
      setPinError('Invalid PIN. Please try again.')
      return
    }

    setLoading(true)
    setPinError('')

    try {
      // Roll allocation should have already happened at production start
      // Continue with production completion
      const completionData = {
        productionOrderId: productionOrder.id,
        productionType: 'coating' as const,
        plannedQuantity: productionOrder.quantity_required,
        actualQuantity: actualQuantity,
        completionNotes: completionNotes,
        completedBy: completedBy,
        inputRolls: selectedRolls.map(roll => ({
          loomRollId: roll.loomRollId,
          quantityUsed: roll.quantityUsed,
          processingOrder: roll.processingOrder
        })),
        aGrade50mRolls: aGrade50mRolls,
        aGradeShortRolls: aGradeShortRolls,
        bcGradeRolls: bcGradeRolls,
        wastageQuantity: calculateBCGradeTotal()
      }

      // Complete coating production with individual roll details
      const result = await loomTrackingUtils.completeCoatingProductionWithIndividualRolls(completionData)

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

      // Stock updates are handled by completeCoatingProductionWithIndividualRolls
      // No manual stock update needed here

      // Update selected loom rolls to 'used' status
      for (const roll of selectedRolls) {
        await supabase
          .from('loom_rolls')
          .update({
            roll_status: 'used',
            updated_at: new Date().toISOString()
          })
          .eq('id', roll.loomRollId)
      }

              console.log('Coating production completed successfully:', {
          batchNumber: result.batchNumber,
          finalRollsCreated: result.finalRolls.length,
          aGradeRolls: aGrade50mRolls + aGradeShortRolls.length,
          bcGradeRolls: bcGradeRolls.length,
          wastageQuantity: calculateBCGradeTotal(), // Auto-calculated from B/C grade rolls
          wastagePercentage: calculateWastagePercentage().toFixed(1)
        })

      onCompleted()
      onClose()
    } catch (error) {
      console.error('Error completing coating production:', error)
      alert('Failed to complete coating production. Please try again.')
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
              Complete Coating Production
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
          {!showPinStep ? (
            <>
              {/* Production Order Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Production Order Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-900"><strong>Order:</strong> {productionOrder.internal_order_number}</p>
                    <p className="text-gray-900"><strong>Fabric:</strong> {productionOrder.finished_fabrics?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-900"><strong>Planned Quantity:</strong> {productionOrder.quantity_required}m</p>
                    <p className="text-gray-900"><strong>Customer:</strong> {productionOrder.customer_orders?.customers?.name || 'Stock Building'}</p>
                  </div>
                  <div>
                    <p className="text-gray-900"><strong>Allocated Rolls:</strong> {selectedRolls.length}</p>
                    <p className="text-gray-900"><strong>Total Allocated Quantity:</strong> {selectedRolls.reduce((sum, roll) => sum + roll.quantityUsed, 0)}m</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Roll Selection */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Pre-allocated Rolls for Processing</h4>
                  
                  {/* Pre-allocated Rolls Info */}
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-800 mb-2">Pre-allocated Weaved Rolls</h5>
                    <div className="p-3 border border-gray-200 rounded-lg bg-green-50">
                      <p className="text-sm text-green-800">
                        ✓ All required rolls have been pre-allocated during production start.
                        They are automatically selected for processing below.
                      </p>
                    </div>
                  </div>

                  {/* Selected Rolls */}
                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">Allocated Rolls for Processing (Processing Order)</h5>
                    <div className="space-y-2">
                      {selectedRolls.map((roll, index) => (
                        <div key={roll.loomRollId} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-blue-900">#{roll.processingOrder}</span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => moveRoll(index, 'up')}
                                disabled={index === 0}
                                className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveRoll(index, 'down')}
                                disabled={index === selectedRolls.length - 1}
                                className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                              >
                                ↓
                              </button>
                            </div>
                          </div>

                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-900">{roll.rollNumber}</p>
                            <p className="text-xs text-gray-700">{roll.loomNumber} • {roll.rollLength}m available</p>
                          </div>

                          <div className="w-32">
                            <label className="block text-xs font-medium text-gray-800 mb-1">
                              Quantity Used (m)
                            </label>
                            <input
                              type="number"
                              value={roll.quantityUsed}
                              onChange={(e) => updateRoll(index, 'quantityUsed', Number(e.target.value))}
                              min="0"
                              max={roll.rollLength}
                              step="0.1"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              required
                            />
                          </div>

                          <div className="text-xs text-gray-500">
                            Pre-allocated
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Production Output */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Production Output</h4>
                  
                  {/* A Grade 50m Rolls */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      A Grade 50m Rolls
                    </label>
                    <input
                      type="number"
                      value={aGrade50mRolls}
                      onChange={(e) => setAGrade50mRolls(Number(e.target.value))}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-700 mt-1">
                      Total: {aGrade50mRolls * 50}m
                    </p>
                  </div>

                  {/* Balance Display */}
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                    <h5 className="font-medium text-yellow-800 mb-2">Remaining Balance to Allocate</h5>
                    <p className="text-yellow-800">
                      Total Input: {calculateTotalInput()}m | A Grade 50m Used: {aGrade50mRolls * 50}m | Balance: {calculateRemainingBalance()}m
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      * Allocate remaining balance as A Grade Short Rolls or B/C Grade Rolls (wastage)
                    </p>
                  </div>

                  {/* A Grade Short Rolls */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-800">
                        A Grade Short Rolls
                      </label>
                      <button
                        type="button"
                        onClick={addAGradeShortRoll}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        <PlusIcon className="h-4 w-4 inline mr-1" />
                        Add Roll
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {aGradeShortRolls.map((roll, index) => (
                        <div key={roll.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={roll.rollNumber}
                              onChange={(e) => updateAGradeShortRoll(index, 'rollNumber', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500"
                              placeholder="Roll Number"
                            />
                          </div>
                          <div className="w-32">
                            <input
                              type="number"
                              value={roll.rollLength}
                              onChange={(e) => updateAGradeShortRoll(index, 'rollLength', Number(e.target.value))}
                              min="0"
                              step="0.1"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500"
                              placeholder="Length (m)"
                              required
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={roll.qualityNotes || ''}
                              onChange={(e) => updateAGradeShortRoll(index, 'qualityNotes', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500"
                              placeholder="Quality Notes"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAGradeShortRoll(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-700 mt-1">
                      Total: {calculateAGradeShortTotal()}m
                    </p>
                  </div>

                  {/* B/C Grade Rolls */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-800">
                        B/C Grade Rolls (Wastage)
                      </label>
                      <button
                        type="button"
                        onClick={addBCGradeRoll}
                        className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                      >
                        <PlusIcon className="h-4 w-4 inline mr-1" />
                        Add Roll
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {bcGradeRolls.map((roll, index) => (
                        <div key={roll.id} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={roll.rollNumber}
                              onChange={(e) => updateBCGradeRoll(index, 'rollNumber', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                              placeholder="Roll Number"
                            />
                          </div>
                          <div className="w-32">
                            <input
                              type="number"
                              value={roll.rollLength}
                              onChange={(e) => updateBCGradeRoll(index, 'rollLength', Number(e.target.value))}
                              min="0"
                              step="0.1"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                              placeholder="Length (m)"
                              required
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={roll.qualityNotes || ''}
                              onChange={(e) => updateBCGradeRoll(index, 'qualityNotes', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-1 focus:ring-orange-500"
                              placeholder="Quality Notes"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBCGradeRoll(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-700 mt-1">
                      Total: {calculateBCGradeTotal()}m (counted as wastage)
                    </p>
                  </div>

                  {/* Wastage Summary */}
                  <div className="mb-4 p-3 bg-red-50 rounded-lg">
                    <h5 className="font-medium text-red-800 mb-2">Wastage Summary</h5>
                    <p className="text-red-800">
                      Total Wastage: {calculateBCGradeTotal()}m ({calculateWastagePercentage().toFixed(1)}% of input)
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      * All B/C grade rolls are automatically counted as wastage
                    </p>
                  </div>
                </div>

                {/* Production Summary */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Production Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-blue-800">Total Input:</p>
                      <p className="font-semibold text-blue-900">{calculateTotalInput()}m</p>
                    </div>
                    <div>
                      <p className="text-blue-800">Total Output:</p>
                      <p className="font-semibold text-blue-900">{calculateTotalOutput()}m</p>
                    </div>
                    <div>
                      <p className="text-blue-800">A Grade Output:</p>
                      <p className="font-semibold text-blue-900">{(aGrade50mRolls * 50) + calculateAGradeShortTotal()}m</p>
                    </div>
                    <div>
                      <p className="text-blue-800">Wastage (B/C Grade):</p>
                      <p className="font-semibold text-blue-900">{calculateBCGradeTotal()}m ({calculateWastagePercentage().toFixed(1)}%)</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    * Wastage is automatically calculated from B/C grade rolls
                  </p>
                </div>

                {/* Completion Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Completion Notes
                    </label>
                    <textarea
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="General notes about the production completion..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Completed By
                    </label>
                    <input
                      type="text"
                      value={completedBy}
                      onChange={(e) => setCompletedBy(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            </>
          ) : (
            // PIN Verification Step
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <h4 className="text-lg font-medium text-gray-900 mb-2">PIN Verification Required</h4>
                <p className="text-sm text-gray-700">
                  Please enter your PIN to complete the coating production.
                </p>
              </div>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter PIN"
                    maxLength={4}
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