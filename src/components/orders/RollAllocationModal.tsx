'use client'

import { useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { 
  XMarkIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
  CubeIcon,
  TagIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { logBusinessEvent } from '@/lib/utils/auditTrail'

interface FabricRoll {
  id: string
  roll_number: string
  roll_length: number
  remaining_length: number
  quality_grade: 'A' | 'B' | 'C'
  roll_status: 'available' | 'allocated' | 'partially_allocated'
  roll_type: 'full_50m' | 'short' | 'wastage'
  fabric_id: string
  fabric_type: 'base_fabric' | 'finished_fabric'
  batch_id?: string
  customer_color?: string
  created_at: string
  production_batches?: {
    batch_number: string
  }
}

interface Order {
  id: string
  internal_order_number: string
  customer_po_number: string | null
  quantity_ordered: number
  quantity_allocated: number
  order_status: string
  finished_fabric_id: string
  customers?: {
    name: string
  }
  finished_fabrics?: {
    name: string
    color: string
    stock_quantity: number
    gsm: number
    width_meters: number
  }
  customer_order_items?: Array<{
    id: string
    color: string
    quantity_ordered: number
    quantity_allocated: number
    finished_fabric_id: string
  }>
}

interface RollAllocationModalProps {
  isOpen: boolean
  onClose: () => void
  onAllocationComplete: () => void
  selectedOrder?: Order | null
}

interface SelectedRoll {
  rollId: string
  rollNumber: string
  availableLength: number
  allocatedLength: number
  qualityGrade: 'A' | 'B' | 'C'
}

export default function RollAllocationModal({ 
  isOpen, 
  onClose, 
  onAllocationComplete,
  selectedOrder 
}: RollAllocationModalProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [fabricRolls, setFabricRolls] = useState<FabricRoll[]>([])
  const [selectedRolls, setSelectedRolls] = useState<SelectedRoll[]>([])
  const [currentOrder, setCurrentOrder] = useState<Order | null>(selectedOrder || null)
  const [loading, setLoading] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [allocating, setAllocating] = useState(false)
  const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C'>('A')

  useEffect(() => {
    if (isOpen) {
      loadOrders()
      if (currentOrder) {
        loadFabricRolls(currentOrder.finished_fabric_id)
      }
    }
  }, [isOpen, currentOrder])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('customer_orders')
        .select(`
          *,
          customers (name),
          finished_fabrics (name, color, stock_quantity),
          customer_order_items (
            id,
            color,
            quantity_ordered,
            quantity_allocated,
            finished_fabric_id
          )
        `)
        .in('order_status', ['confirmed', 'partially_allocated', 'in_production', 'production_complete'])
        .order('created_at', { ascending: true })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFabricRolls = async (fabricId: string) => {
    try {
      setLoading(true)
      
      // Determine the color to filter by
      let targetColor = 'Natural'
      if (currentOrder?.customer_order_items && currentOrder.customer_order_items.length > 0) {
        const itemNeedingAllocation = currentOrder.customer_order_items.find(item => 
          item.quantity_allocated < item.quantity_ordered
        )
        if (itemNeedingAllocation) {
          targetColor = itemNeedingAllocation.color
        }
      } else if (currentOrder?.finished_fabrics?.color) {
        targetColor = currentOrder.finished_fabrics.color
      }
      
      const { data, error } = await supabase
        .from('fabric_rolls')
        .select(`
          *,
          production_batches (batch_number)
        `)
        .eq('fabric_type', 'finished_fabric')
        .eq('fabric_id', fabricId)
        .eq('roll_status', 'available')
        .eq('customer_color', targetColor)
        .order('quality_grade', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      setFabricRolls(data || [])
    } catch (error) {
      console.error('Error loading fabric rolls:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOrderSelect = (order: Order) => {
    setCurrentOrder(order)
    setSelectedRolls([])
    // Load fabric rolls after setting current order so we can filter by color
    setTimeout(() => {
      loadFabricRolls(order.finished_fabric_id)
    }, 100)
  }

  const handleRollSelect = (roll: FabricRoll) => {
    const existingIndex = selectedRolls.findIndex(r => r.rollId === roll.id)
    
    if (existingIndex >= 0) {
      // Remove selection
      setSelectedRolls(selectedRolls.filter(r => r.rollId !== roll.id))
    } else {
      // Add selection
      const maxAllocation = Math.min(
        roll.remaining_length,
        currentOrder ? currentOrder.quantity_ordered - currentOrder.quantity_allocated - getTotalAllocated() : 0
      )
      
      if (maxAllocation > 0) {
        setSelectedRolls([...selectedRolls, {
          rollId: roll.id,
          rollNumber: roll.roll_number,
          availableLength: roll.remaining_length,
          allocatedLength: maxAllocation,
          qualityGrade: roll.quality_grade
        }])
      }
    }
  }

  const updateRollAllocation = (rollId: string, newAllocation: number) => {
    setSelectedRolls(selectedRolls.map(roll => 
      roll.rollId === rollId 
        ? { ...roll, allocatedLength: Math.min(newAllocation, roll.availableLength) }
        : roll
    ))
  }

  const getTotalAllocated = () => {
    return selectedRolls.reduce((total, roll) => total + roll.allocatedLength, 0)
  }

  const getRemainingToAllocate = () => {
    if (!currentOrder) return 0
    return currentOrder.quantity_ordered - currentOrder.quantity_allocated - getTotalAllocated()
  }

  const handleAllocate = () => {
    if (!currentOrder || selectedRolls.length === 0) return
    setShowPinModal(true)
  }

  const processAllocation = async () => {
    if (!currentOrder || selectedRolls.length === 0) return

    const correctPin = '0000'
    if (pin !== correctPin) {
      alert('Invalid PIN. Please try again.')
      setPin('')
      return
    }

    try {
      setAllocating(true)
      const totalAllocated = getTotalAllocated()
      
      // Determine the order item to allocate to
      let orderItemId = null
      if (currentOrder.customer_order_items && currentOrder.customer_order_items.length > 0) {
        const itemNeedingAllocation = currentOrder.customer_order_items.find(item => 
          item.quantity_allocated < item.quantity_ordered
        )
        if (itemNeedingAllocation) {
          orderItemId = itemNeedingAllocation.id
        }
      }
      
      // Update each selected roll
      for (const selectedRoll of selectedRolls) {
        const roll = fabricRolls.find(r => r.id === selectedRoll.rollId)
        if (!roll) continue

        const newRemainingLength = roll.remaining_length - selectedRoll.allocatedLength
        const newStatus = newRemainingLength === 0 ? 'allocated' : 'partially_allocated'

        // Update QR code with enriched data
        const enrichedQrData = {
          type: 'fabric_roll',
          rollNumber: roll.roll_number,
          batchId: roll.batch_id,
          fabricType: roll.fabric_type,
          fabricId: roll.fabric_id,
          rollLength: roll.roll_length,
          qrGeneratedAt: new Date().toISOString(),
          productionPurpose: 'customer_order',
          customerOrderId: currentOrder.id,
          customerOrderNumber: currentOrder.internal_order_number,
          customerName: currentOrder.customers?.name,
          color: roll.customer_color || 'Natural',
          allocationStatus: `Allocated to ${currentOrder.customers?.name || 'Customer Order'}`,
          detailsUrl: `${process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app'}/api/rolls/${roll.id}`,
          additionalData: {
            rollId: roll.id
          }
        }

        const { data: updatedRoll, error: rollUpdateError } = await supabase
          .from('fabric_rolls')
          .update({
            remaining_length: newRemainingLength,
            roll_status: newStatus,
            customer_order_id: currentOrder.id,
            customer_order_item_id: orderItemId,
            qr_code: JSON.stringify(enrichedQrData),
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedRoll.rollId)
          .select()
          .single();
        if (rollUpdateError) {
          // Optionally, keep a single error log for production
          console.error('Error updating roll status during allocation:', rollUpdateError.message || rollUpdateError);
        } else {
          console.log(`Successfully updated roll ${selectedRoll.rollNumber} to status: ${newStatus}, remaining: ${newRemainingLength}m`);
        }

        // Log allocation event
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            fabric_type: 'finished_fabric',
            fabric_id: currentOrder.finished_fabric_id,
            movement_type: 'allocation',
            quantity: -selectedRoll.allocatedLength,
            reference_id: currentOrder.id,
            reference_type: 'customer_order',
            notes: `Manual roll allocation: ${selectedRoll.rollNumber} (${selectedRoll.qualityGrade} grade)`,
            created_at: new Date().toISOString()
          })
        if (movementError) {
          console.error('Error logging stock movement during allocation:', movementError)
          alert('Error logging stock movement during allocation. Please check logs.')
        }
      }

      // Update the specific order item if we have one
      if (orderItemId) {
        const itemNeedingAllocation = currentOrder.customer_order_items?.find(item => 
          item.quantity_allocated < item.quantity_ordered
        )
        if (itemNeedingAllocation) {
          const newItemAllocated = itemNeedingAllocation.quantity_allocated + totalAllocated
          await supabase
            .from('customer_order_items')
            .update({
              quantity_allocated: newItemAllocated,
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderItemId)
        }
      }

      // Update customer order - use the correct workflow statuses
      const newTotalAllocated = currentOrder.quantity_allocated + totalAllocated
      const newStatus = newTotalAllocated >= currentOrder.quantity_ordered ? 'fully_allocated' : 'partially_allocated'

      await supabase
        .from('customer_orders')
        .update({
          quantity_allocated: newTotalAllocated,
          order_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentOrder.id)

      // Update finished fabric stock quantity
      const { data: currentFabric } = await supabase
        .from('finished_fabrics')
        .select('stock_quantity')
        .eq('id', currentOrder.finished_fabric_id)
        .single()

      if (currentFabric) {
        const newStock = Math.max(0, currentFabric.stock_quantity - totalAllocated)
        await supabase
          .from('finished_fabrics')
          .update({
            stock_quantity: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentOrder.finished_fabric_id)
      }

      // Log packing list in audit trail with detailed roll information
      const allocatedRollsData = selectedRolls.map(sr => {
        const roll = fabricRolls.find(r => r.id === sr.rollId)
        return {
          rollNumber: roll?.roll_number || 'Unknown',
          length: sr.allocatedLength,
          gsm: currentOrder.finished_fabrics?.gsm || 400, // Default to 400 if not available
          width: currentOrder.finished_fabrics?.width_meters || 1.8 // Default to 1.8m if not available
        }
      })
      
      // Get target color from order items or finished fabric
      let targetColor = 'Natural'
      if (currentOrder.customer_order_items && currentOrder.customer_order_items.length > 0) {
        const itemNeedingAllocation = currentOrder.customer_order_items.find(item => 
          item.quantity_allocated < item.quantity_ordered
        )
        if (itemNeedingAllocation) {
          targetColor = itemNeedingAllocation.color
        }
      } else if (currentOrder.finished_fabrics?.color) {
        targetColor = currentOrder.finished_fabrics.color
      }
      
      await logBusinessEvent.customerOrder.packingListGenerated(currentOrder.id, {
        rolls: allocatedRollsData,
        totalQuantity: totalAllocated,
        color: targetColor,
        allocationType: 'manual'
      })

      // Reset and reload
      setShowPinModal(false)
      setPin('')
      setSelectedRolls([])
      loadOrders()
      if (currentOrder) {
        loadFabricRolls(currentOrder.finished_fabric_id)
      }
      onAllocationComplete()

    } catch (error) {
      console.error('Error processing allocation:', error)
      alert('Error processing allocation. Please try again.')
    } finally {
      setAllocating(false)
    }
  }

  const filteredRolls = fabricRolls.filter(roll => roll.quality_grade === activeTab)

  const getGradeColor = (grade: 'A' | 'B' | 'C') => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-50'
      case 'B': return 'text-yellow-600 bg-yellow-50'
      case 'C': return 'text-red-600 bg-red-50'
    }
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex justify-between items-center mb-6">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Roll-Level Stock Allocation
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Orders List */}
                    <div className="lg:col-span-1">
                      <h4 className="font-medium text-gray-900 mb-3">Select Order</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {orders.map((order) => (
                          <div
                            key={order.id}
                            onClick={() => handleOrderSelect(order)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              currentOrder?.id === order.id
                                ? 'bg-blue-50 border-2 border-blue-200'
                                : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <div className="text-sm font-medium text-gray-900">
                              {order.internal_order_number}
                            </div>
                            <div className="text-xs text-gray-600">
                              {order.customers?.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {order.quantity_allocated}/{order.quantity_ordered}m
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rolls Selection */}
                    <div className="lg:col-span-2">
                      {currentOrder ? (
                        <>
                          <div className="mb-4">
                            <h4 className="font-medium text-gray-900 mb-2">
                              Available Rolls - {currentOrder.finished_fabrics?.name}
                            </h4>
                            <div className="text-sm text-gray-600">
                              Remaining to allocate: {getRemainingToAllocate()}m
                            </div>
                          </div>

                          {/* Grade Tabs */}
                          <div className="mb-4 flex space-x-1 bg-gray-100 p-1 rounded-lg">
                            {(['A', 'B', 'C'] as const).map((grade) => (
                              <button
                                key={grade}
                                onClick={() => setActiveTab(grade)}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                  activeTab === grade
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                Grade {grade} ({fabricRolls.filter(r => r.quality_grade === grade).length})
                              </button>
                            ))}
                          </div>

                          {/* Rolls List */}
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {filteredRolls.map((roll) => {
                              const isSelected = selectedRolls.some(r => r.rollId === roll.id)
                              const selectedRoll = selectedRolls.find(r => r.rollId === roll.id)
                              
                              return (
                                <div
                                  key={roll.id}
                                  className={`p-3 rounded-lg border transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 border-blue-200'
                                      : 'bg-white border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleRollSelect(roll)}
                                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                      />
                                      <div>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-sm font-medium text-gray-900">
                                            {roll.roll_number}
                                          </span>
                                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getGradeColor(roll.quality_grade)}`}>
                                            {roll.quality_grade}
                                          </span>
                                        </div>
                                        <div className="text-xs text-gray-600">
                                          {roll.remaining_length}m • {roll.roll_type.replace('_', ' ')}
                                        </div>
                                        {roll.production_batches?.batch_number && (
                                          <div className="text-xs text-gray-500">
                                            Batch: {roll.production_batches.batch_number}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {isSelected && selectedRoll && (
                                      <div className="flex items-center space-x-2">
                                        <input
                                          type="number"
                                          value={selectedRoll.allocatedLength}
                                          onChange={(e) => updateRollAllocation(
                                            roll.id, 
                                            Math.max(0, parseInt(e.target.value) || 0)
                                          )}
                                          max={roll.remaining_length}
                                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                        />
                                        <span className="text-xs text-gray-600">m</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Allocation Summary */}
                          {selectedRolls.length > 0 && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                              <h5 className="font-medium text-gray-900 mb-2">Allocation Summary</h5>
                              <div className="space-y-1 text-sm">
                                {selectedRolls.map((roll) => (
                                  <div key={roll.rollId} className="flex justify-between">
                                    <span className="text-gray-800">{roll.rollNumber} ({roll.qualityGrade})</span>
                                    <span className="text-gray-800 font-medium">{roll.allocatedLength}m</span>
                                  </div>
                                ))}
                                <div className="border-t pt-1 font-medium">
                                  <div className="flex justify-between">
                                    <span className="text-gray-900">Total</span>
                                    <span className="text-gray-900 font-semibold">{getTotalAllocated()}m</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="mt-6 flex justify-end space-x-3">
                            <button
                              onClick={onClose}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAllocate}
                              disabled={selectedRolls.length === 0 || getTotalAllocated() === 0}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                            >
                              Allocate Selected Rolls
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-12">
                          <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">Select an order</h3>
                          <p className="mt-1 text-sm text-gray-700">
                            Choose an order from the list to view available rolls.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* PIN Authorization Modal */}
      <Transition appear show={showPinModal} as={Fragment}>
        <Dialog as="div" className="relative z-20" onClose={() => setShowPinModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center mb-4">
                    <LockClosedIcon className="h-6 w-6 text-yellow-500 mr-2" />
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Authorization Required
                    </Dialog.Title>
                  </div>

                  {currentOrder && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Roll Allocation Summary</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Order: {currentOrder.internal_order_number}</div>
                        <div>Customer: {currentOrder.customers?.name}</div>
                        <div>Total Rolls: {selectedRolls.length}</div>
                        <div>Total Quantity: {getTotalAllocated()}m</div>
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter PIN to authorize allocation
                    </label>
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                      placeholder="Enter PIN"
                      maxLength={4}
                    />
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowPinModal(false)
                        setPin('')
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={processAllocation}
                      disabled={!pin || allocating}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                    >
                      {allocating ? 'Allocating...' : 'Confirm Allocation'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
} 