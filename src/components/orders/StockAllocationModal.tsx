'use client'

import { useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { 
  XMarkIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import RollAllocationModal from './RollAllocationModal'

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
  }
  customer_order_items?: Array<{
    id: string
    color: string
    quantity_ordered: number
    quantity_allocated: number
    finished_fabric_id: string
  }>
}

interface StockAllocationModalProps {
  isOpen: boolean
  onClose: () => void
  onAllocationComplete: () => void
}

export default function StockAllocationModal({ 
  isOpen, 
  onClose, 
  onAllocationComplete 
}: StockAllocationModalProps) {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [allocatingOrderId, setAllocatingOrderId] = useState<string | null>(null)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [allocationAmount, setAllocationAmount] = useState<number>(0)
  const [showRollAllocationModal, setShowRollAllocationModal] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadPendingOrders()
    }
  }, [isOpen])

  const loadPendingOrders = async () => {
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
        .in('order_status', ['pending', 'partially_allocated', 'confirmed', 'awaiting_production', 'in_production', 'production_complete'])
        .order('created_at', { ascending: true })

      if (error) throw error
      setPendingOrders(data || [])
    } catch (error) {
      console.error('Error loading pending orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAllocateStock = (order: Order) => {
    // For multi-color orders, we need to check each order item
    if (order.customer_order_items && order.customer_order_items.length > 0) {
      // Find the order item that needs allocation
      const itemNeedingAllocation = order.customer_order_items.find(item => 
        item.quantity_allocated < item.quantity_ordered
      )
      
      if (itemNeedingAllocation) {
        const availableStock = order.finished_fabrics?.stock_quantity || 0
        const remainingQuantity = itemNeedingAllocation.quantity_ordered - itemNeedingAllocation.quantity_allocated
        const maxAllocation = Math.min(availableStock, remainingQuantity)
        
        setSelectedOrder(order)
        setAllocationAmount(maxAllocation)
        setShowPinModal(true)
      }
    } else {
      // Fallback for single-color orders
      const availableStock = order.finished_fabrics?.stock_quantity || 0
      const remainingQuantity = order.quantity_ordered - order.quantity_allocated
      const maxAllocation = Math.min(availableStock, remainingQuantity)
      
      setSelectedOrder(order)
      setAllocationAmount(maxAllocation)
      setShowPinModal(true)
    }
  }

  const processAllocation = async () => {
    if (!selectedOrder || allocationAmount <= 0) return

    const correctPin = '0000'
    if (pin !== correctPin) {
      alert('Invalid PIN. Please try again.')
      setPin('')
      return
    }

    try {
      setAllocatingOrderId(selectedOrder.id)
      let allocationLeft = allocationAmount;
      
      // Determine the color to allocate - use order item color if available
      let targetColor = selectedOrder.finished_fabrics?.color || 'Natural'
      let orderItemId = null
      
      console.log('Allocation debug - Order items:', selectedOrder.customer_order_items);
      
      if (selectedOrder.customer_order_items && selectedOrder.customer_order_items.length > 0) {
        const itemNeedingAllocation = selectedOrder.customer_order_items.find(item => 
          item.quantity_allocated < item.quantity_ordered
        )
        if (itemNeedingAllocation) {
          targetColor = itemNeedingAllocation.color
          orderItemId = itemNeedingAllocation.id
          console.log('Allocation debug - Found item needing allocation:', itemNeedingAllocation);
          console.log('Allocation debug - Target color:', targetColor);
        }
      }
      
      console.log('Allocation debug - Final target color:', targetColor);
      
      // 1. Fetch available rolls for this finished fabric and color (FIFO)
      console.log('Allocation debug - Fetching rolls for fabric_id:', selectedOrder.finished_fabric_id, 'color:', targetColor);
      
      const { data: availableRolls, error: rollsError } = await supabase
        .from('fabric_rolls')
        .select('*')
        .eq('fabric_id', selectedOrder.finished_fabric_id)
        .eq('fabric_type', 'finished_fabric')
        .eq('roll_status', 'available')
        .gt('remaining_length', 0)
        .eq('customer_color', targetColor)
        .order('created_at', { ascending: true });
      if (rollsError) throw rollsError;
      
      console.log('Allocation debug - Available rolls found:', availableRolls?.length || 0);
      if (availableRolls && availableRolls.length > 0) {
        console.log('Allocation debug - First roll details:', {
          id: availableRolls[0].id,
          roll_number: availableRolls[0].roll_number,
          customer_color: availableRolls[0].customer_color,
          remaining_length: availableRolls[0].remaining_length
        });
      }
      
      if (!availableRolls || availableRolls.length === 0) throw new Error(`No available rolls found for color: ${targetColor}`);
      // 2. Allocate rolls
      for (const roll of availableRolls) {
        if (allocationLeft <= 0) break;
        const allocFromThisRoll = Math.min(roll.remaining_length, allocationLeft);
        const newRemaining = roll.remaining_length - allocFromThisRoll;
        const newStatus = newRemaining === 0 ? 'allocated' : 'partially_allocated';
        const { error: rollUpdateError } = await supabase
          .from('fabric_rolls')
          .update({
            remaining_length: newRemaining,
            roll_status: newStatus,
            customer_order_id: selectedOrder.id,
            customer_order_item_id: orderItemId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', roll.id);
        if (rollUpdateError) {
          // Optionally, keep a single error log for production
          console.error('Error updating roll status during allocation:', rollUpdateError.message || rollUpdateError);
        } else {
          console.log(`Successfully updated roll ${roll.roll_number} to status: ${newStatus}, remaining: ${newRemaining}m`);
        }
        // Log stock movement for this roll
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            fabric_type: 'finished_fabric',
            fabric_id: selectedOrder.finished_fabric_id,
            movement_type: 'allocation',
            quantity: -allocFromThisRoll,
            reference_id: selectedOrder.id,
            reference_type: 'customer_order',
            notes: `Quick Allocate: Roll ${roll.roll_number}`,
            created_at: new Date().toISOString(),
          });
        if (movementError) {
          // Optionally, keep a single error log for production
          console.error('Error logging stock movement during allocation:', movementError.message || movementError);
        }
        allocationLeft -= allocFromThisRoll;
      }
      // 3. Update order allocation summary
      const newTotalAllocated = selectedOrder.quantity_allocated + allocationAmount;
      
      // Update the specific order item if we have one
      if (orderItemId) {
        const itemNeedingAllocation = selectedOrder.customer_order_items?.find(item => 
          item.quantity_allocated < item.quantity_ordered
        )
        if (itemNeedingAllocation) {
          const newItemAllocated = itemNeedingAllocation.quantity_allocated + allocationAmount
          await supabase
            .from('customer_order_items')
            .update({
              quantity_allocated: newItemAllocated,
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderItemId)
        }
      }
      
      // Update main order status - use the correct workflow statuses
      const newStatus = newTotalAllocated >= selectedOrder.quantity_ordered 
        ? 'fully_allocated' 
        : 'partially_allocated';
      const { error: orderError } = await supabase
        .from('customer_orders')
        .update({
          quantity_allocated: newTotalAllocated,
          order_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);
      if (orderError) throw orderError;
      // 4. Update finished fabric stock quantity
      const newStockQuantity = (selectedOrder.finished_fabrics?.stock_quantity || 0) - allocationAmount;
      const { error: stockError } = await supabase
        .from('finished_fabrics')
        .update({
          stock_quantity: newStockQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.finished_fabric_id);
      if (stockError) throw stockError;
      // 5. Create summary stock movement record
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          fabric_type: 'finished_fabric',
          fabric_id: selectedOrder.finished_fabric_id,
          movement_type: 'allocation',
          quantity: -allocationAmount,
          reference_id: selectedOrder.id,
          reference_type: 'customer_order',
          notes: `Stock allocated to order ${selectedOrder.internal_order_number} (Quick Allocate)` ,
          created_at: new Date().toISOString(),
        });
      if (movementError) throw movementError;
      // Reset form and reload data
      setShowPinModal(false)
      setPin('')
      setSelectedOrder(null)
      setAllocationAmount(0)
      loadPendingOrders()
      onAllocationComplete()
    } catch (error) {
      console.error('Error processing allocation:', error)
      alert('Error processing allocation. Please try again.')
    } finally {
      setAllocatingOrderId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'partially_allocated':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-4 w-4" />
      case 'partially_allocated':
        return <ExclamationTriangleIcon className="h-4 w-4" />
      default:
        return <CheckCircleIcon className="h-4 w-4" />
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
                      Stock Allocation - Pending Orders
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Order Details
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Customer
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Product
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Quantity Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Available Stock
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pendingOrders.map((order) => {
                            const remainingQuantity = order.quantity_ordered - order.quantity_allocated
                            const availableStock = order.finished_fabrics?.stock_quantity || 0
                            const canAllocate = availableStock > 0 && remainingQuantity > 0
                            
                            return (
                              <tr key={order.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {order.internal_order_number}
                                    </div>
                                    {order.customer_po_number && (
                                      <div className="text-sm text-gray-500">
                                        PO: {order.customer_po_number}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {order.customers?.name || 'N/A'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {order.finished_fabrics?.name || 'N/A'}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {order.finished_fabrics?.color || 'N/A'}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    <span className="font-medium">{order.quantity_allocated}</span>
                                    <span className="text-gray-700"> / {order.quantity_ordered}m</span>
                                  </div>
                                  <div className="text-xs text-gray-700">
                                    Remaining: {remainingQuantity}m
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className={`text-sm font-medium ${
                                    availableStock > 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {availableStock}m
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                                    {getStatusIcon(order.order_status)}
                                    <span className="ml-1 capitalize">{order.order_status.replace('_', ' ')}</span>
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  {canAllocate ? (
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => handleAllocateStock(order)}
                                        disabled={allocatingOrderId === order.id}
                                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                                      >
                                        {allocatingOrderId === order.id ? 'Allocating...' : 'Quick Allocate'}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedOrder(order)
                                          setShowRollAllocationModal(true)
                                        }}
                                        className="text-green-600 hover:text-green-900"
                                      >
                                        Select Rolls
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-gray-600">No Stock Available</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>

                      {pendingOrders.length === 0 && (
                        <div className="text-center py-12">
                          <CheckCircleIcon className="mx-auto h-12 w-12 text-green-400" />
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No pending orders</h3>
                          <p className="mt-1 text-sm text-gray-700">
                            All orders are currently allocated or in production.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
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

                  {selectedOrder && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Allocation Summary</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Order: {selectedOrder.internal_order_number}</div>
                        <div>Product: {selectedOrder.finished_fabrics?.name}</div>
                        <div>Allocating: {allocationAmount}m</div>
                        <div>Remaining after allocation: {selectedOrder.quantity_ordered - selectedOrder.quantity_allocated - allocationAmount}m</div>
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allocation Amount (meters)
                    </label>
                    <input
                      type="number"
                      value={allocationAmount}
                      onChange={(e) => setAllocationAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      max={selectedOrder ? Math.min(
                        selectedOrder.finished_fabrics?.stock_quantity || 0,
                        selectedOrder.quantity_ordered - selectedOrder.quantity_allocated
                      ) : 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>

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
                        setSelectedOrder(null)
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={processAllocation}
                      disabled={!pin || allocationAmount <= 0}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                    >
                      Confirm Allocation
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Roll Allocation Modal */}
      <RollAllocationModal
        isOpen={showRollAllocationModal}
        onClose={() => {
          setShowRollAllocationModal(false)
          setSelectedOrder(null)
        }}
        onAllocationComplete={() => {
          setShowRollAllocationModal(false)
          setSelectedOrder(null)
          loadPendingOrders()
          onAllocationComplete()
        }}
        selectedOrder={selectedOrder}
      />
    </>
  )
} 