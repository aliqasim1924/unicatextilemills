'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { loomTrackingUtils, LoomRollData } from '@/lib/utils/loomTrackingUtils'

interface CoatingRollAllocationModalProps {
  isOpen: boolean
  onClose: () => void
  productionOrder: {
    id: string
    internal_order_number: string
    production_type: string
    quantity_required: number
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
    linked_production_order_id?: string | null
  }
  onAllocationComplete: () => void
}

interface SelectedRoll {
  loomRollId: string
  rollNumber: string
  loomNumber: string
  rollLength: number
  quantityUsed: number
  qualityGrade: string
}

export default function CoatingRollAllocationModal({
  isOpen,
  onClose,
  productionOrder,
  onAllocationComplete
}: CoatingRollAllocationModalProps) {
  const [availableRolls, setAvailableRolls] = useState<LoomRollData[]>([])
  const [selectedRolls, setSelectedRolls] = useState<SelectedRoll[]>([])
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
      const rolls = await loomTrackingUtils.getAvailableRolls(productionOrder.id)
      setAvailableRolls(rolls)
    } catch (error) {
      console.error('Error loading available rolls:', error)
      alert('Failed to load available rolls')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSelectedRolls([])
    setPin('')
    setShowPinStep(false)
    setPinError('')
  }

  const addRoll = (roll: LoomRollData) => {
    const newRoll: SelectedRoll = {
      loomRollId: roll.id,
      rollNumber: roll.rollNumber,
      loomNumber: roll.loomNumber,
      rollLength: roll.rollLength,
      quantityUsed: roll.rollLength, // Default to full roll length
      qualityGrade: roll.qualityGrade
    }
    setSelectedRolls([...selectedRolls, newRoll])
    setAvailableRolls(availableRolls.filter(r => r.id !== roll.id))
  }

  const removeRoll = (index: number) => {
    const removedRoll = selectedRolls[index]
    
    // Find the original roll to add back to available rolls
    const originalRollData: LoomRollData = {
      id: removedRoll.loomRollId,
      rollNumber: removedRoll.rollNumber,
      loomNumber: removedRoll.loomNumber,
      rollLength: removedRoll.rollLength,
      qualityGrade: removedRoll.qualityGrade
    }
    
    setAvailableRolls([...availableRolls, originalRollData])
    setSelectedRolls(selectedRolls.filter((_, i) => i !== index))
  }

  const updateRoll = (index: number, field: keyof SelectedRoll, value: any) => {
    const newRolls = [...selectedRolls]
    newRolls[index] = { ...newRolls[index], [field]: value }
    setSelectedRolls(newRolls)
  }

  const calculateTotalAllocated = () => {
    return selectedRolls.reduce((total, roll) => total + roll.quantityUsed, 0)
  }

  const validateForm = () => {
    if (selectedRolls.length === 0) {
      alert('Please select at least one roll for allocation.')
      return false
    }

    const totalAllocated = calculateTotalAllocated()
    if (totalAllocated < productionOrder.quantity_required) {
      alert(`Insufficient allocation. Required: ${productionOrder.quantity_required}m, Allocated: ${totalAllocated}m`)
      return false
    }

    // Check that no roll is over-allocated
    for (const roll of selectedRolls) {
      if (roll.quantityUsed > roll.rollLength) {
        alert(`Roll ${roll.rollNumber} cannot be allocated more than its length (${roll.rollLength}m)`)
        return false
      }
      if (roll.quantityUsed <= 0) {
        alert(`Roll ${roll.rollNumber} must have a positive allocation amount`)
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
      // Allocate the selected rolls for coating production
      await loomTrackingUtils.allocateBaseFabricRollsForCoating(
        productionOrder.id,
        selectedRolls.map(roll => ({ 
          rollId: roll.loomRollId, 
          quantityUsed: roll.quantityUsed 
        })),
        'Production Manager'
      )

      // Update production order status to in_progress
      await supabase
        .from('production_orders')
        .update({
          production_status: 'in_progress',
          actual_start_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', productionOrder.id)

      console.log('Roll allocation completed successfully:', {
        productionOrder: productionOrder.internal_order_number,
        rollsAllocated: selectedRolls.length,
        totalQuantity: calculateTotalAllocated()
      })

      onAllocationComplete()
      onClose()
    } catch (error) {
      console.error('Error allocating rolls:', error)
      alert('Failed to allocate rolls. Please try again.')
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
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Allocate Rolls for Coating Production
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
                    <p className="text-gray-900"><strong>Required Quantity:</strong> {productionOrder.quantity_required}m</p>
                    <p className="text-gray-900"><strong>Customer:</strong> {productionOrder.customer_orders?.customers?.name || 'Stock Building'}</p>
                  </div>
                  <div>
                    <p className="text-gray-900"><strong>Available Rolls:</strong> {availableRolls.length}</p>
                    <p className="text-gray-900"><strong>Selected Rolls:</strong> {selectedRolls.length}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Roll Selection */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Select Rolls for Allocation</h4>
                  
                  {/* Available Rolls */}
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-800 mb-2">Available Weaved Rolls</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {availableRolls.map((roll) => (
                        <div key={roll.id} className="p-3 border border-gray-200 rounded bg-white">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-900">{roll.rollNumber}</p>
                              <p className="text-xs text-gray-700">
                                {roll.loomNumber} • {roll.rollLength}m • Grade {roll.qualityGrade}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addRoll(roll)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Selected Rolls */}
                  <div className="mb-4">
                    <h5 className="font-medium text-gray-800 mb-2">Selected Rolls for Allocation</h5>
                    <div className="space-y-2">
                      {selectedRolls.map((roll, index) => (
                        <div key={roll.loomRollId} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm text-gray-900">{roll.rollNumber}</p>
                            <p className="text-xs text-gray-700">{roll.loomNumber} • {roll.rollLength}m available • Grade {roll.qualityGrade}</p>
                          </div>

                          <div className="w-32">
                            <label className="block text-xs font-medium text-gray-800 mb-1">
                              Quantity to Allocate (m)
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

                          <button
                            type="button"
                            onClick={() => removeRoll(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Allocation Summary */}
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <h5 className="font-medium text-green-800 mb-2">Allocation Summary</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-green-800"><strong>Required:</strong> {productionOrder.quantity_required}m</p>
                      </div>
                      <div>
                        <p className="text-green-800"><strong>Allocated:</strong> {calculateTotalAllocated()}m</p>
                      </div>
                      <div>
                        <p className="text-green-800"><strong>Balance:</strong> {calculateTotalAllocated() - productionOrder.quantity_required}m</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || selectedRolls.length === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Allocate Rolls & Start Production'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="max-w-md mx-auto">
              <h4 className="font-medium text-gray-900 mb-4">Confirm Roll Allocation</h4>
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">
                  You are about to allocate {selectedRolls.length} rolls ({calculateTotalAllocated()}m) for coating production.
                </p>
                <p className="text-sm text-blue-800">
                  This will reduce base fabric stock and start the production process.
                </p>
              </div>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enter PIN to confirm:
                  </label>
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    autoFocus
                  />
                  {pinError && (
                    <p className="mt-1 text-sm text-red-600">{pinError}</p>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowPinStep(false)}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Allocating...' : 'Confirm Allocation'}
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