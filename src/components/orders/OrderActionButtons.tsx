'use client'

import { useState } from 'react'
import { 
  CheckIcon, 
  XMarkIcon, 
  TruckIcon, 
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { generateOrderAuditDescription, logBusinessEvent } from '@/lib/utils/auditTrail'
import { numberingUtils } from '@/lib/utils/numberingUtils'

interface OrderActionButtonsProps {
  order: {
    id: string
    internal_order_number: string
    order_status: string
    quantity_ordered: number
    quantity_allocated: number
  }
  onOrderUpdated: () => void
}

export default function OrderActionButtons({ order, onOrderUpdated }: OrderActionButtonsProps) {
  const [showPinModal, setShowPinModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pendingAction, setPendingAction] = useState<{
    action: string
    label: string
    newStatus: string
    requiresData?: boolean
  } | null>(null)
  const [updating, setUpdating] = useState(false)
  const [dispatchData, setDispatchData] = useState({
    invoice_number: '',
    gate_pass_number: '',
    delivery_note_number: '',
    dispatch_date: new Date().toISOString().split('T')[0],
    dispatch_notes: ''
  })

  const getAvailableActions = () => {
    const actions = []
    
    switch (order.order_status) {
      case 'pending':
        actions.push({
          action: 'confirm',
          label: 'Confirm Order',
          newStatus: 'confirmed',
          icon: CheckIcon,
          color: 'bg-green-600 hover:bg-green-700',
          description: 'Confirm this order and start production planning'
        })
        actions.push({
          action: 'cancel',
          label: 'Cancel Order',
          newStatus: 'cancelled',
          icon: XMarkIcon,
          color: 'bg-red-600 hover:bg-red-700',
          description: 'Cancel this order'
        })
        break
        
      case 'confirmed':
        // Show awaiting production status instead of start production button
        actions.push({
          action: 'awaiting_production',
          label: 'Awaiting Production',
          newStatus: 'confirmed', // No status change
          icon: ClockIcon,
          color: 'bg-amber-600 hover:bg-amber-700',
          description: 'Order confirmed and awaiting production to commence',
          disabled: true // Make it non-clickable
        })
        break
        
      case 'in_production':
        // Show production in progress status
        if (order.quantity_allocated >= order.quantity_ordered) {
          actions.push({
            action: 'complete_production',
            label: 'Production Complete',
            newStatus: 'production_complete',
            icon: CheckIcon,
            color: 'bg-green-600 hover:bg-green-700',
            description: 'Mark production as complete'
          })
        } else {
          actions.push({
            action: 'in_progress',
            label: 'Production In Progress',
            newStatus: 'in_production', // No status change
            icon: Cog6ToothIcon,
            color: 'bg-blue-600 hover:bg-blue-700',
            description: 'Production is currently in progress',
            disabled: true // Make it non-clickable
          })
        }
        break
        
      case 'production_complete':
        actions.push({
          action: 'ready_for_dispatch',
          label: 'Ready for Dispatch',
          newStatus: 'ready_for_dispatch',
          icon: ClipboardDocumentIcon,
          color: 'bg-blue-600 hover:bg-blue-700',
          description: 'Prepare order for dispatch'
        })
        break
        
      case 'ready_for_dispatch':
        actions.push({
          action: 'dispatch',
          label: 'Dispatch Order',
          newStatus: 'dispatched',
          icon: TruckIcon,
          color: 'bg-purple-600 hover:bg-purple-700',
          description: 'Dispatch order to customer',
          requiresData: true
        })
        break
        
      case 'dispatched':
        actions.push({
          action: 'deliver',
          label: 'Mark as Delivered',
          newStatus: 'delivered',
          icon: CheckIcon,
          color: 'bg-green-600 hover:bg-green-700',
          description: 'Confirm order delivery'
        })
        break

      // Legacy status support - these are old statuses that need to be migrated
      case 'fully_allocated':
        // This means production is complete and ready for dispatch
        actions.push({
          action: 'ready_for_dispatch',
          label: 'Ready for Dispatch',
          newStatus: 'ready_for_dispatch',
          icon: ClipboardDocumentIcon,
          color: 'bg-blue-600 hover:bg-blue-700',
          description: 'Prepare order for dispatch'
        })
        break
        
      case 'partially_allocated':
        // This means production is in progress
        actions.push({
          action: 'complete_production',
          label: 'Complete Production',
          newStatus: 'production_complete',
          icon: CheckIcon,
          color: 'bg-green-600 hover:bg-green-700',
          description: 'Mark production as complete'
        })
        break
        
      case 'in_progress':
        // Legacy status - map to in_production workflow
        if (order.quantity_allocated >= order.quantity_ordered) {
          actions.push({
            action: 'complete_production',
            label: 'Production Complete',
            newStatus: 'production_complete',
            icon: CheckIcon,
            color: 'bg-green-600 hover:bg-green-700',
            description: 'Mark production as complete'
          })
        }
        break
        
      case 'completed':
        // Legacy completed status - should be ready for dispatch
        actions.push({
          action: 'ready_for_dispatch',
          label: 'Ready for Dispatch',
          newStatus: 'ready_for_dispatch',
          icon: ClipboardDocumentIcon,
          color: 'bg-blue-600 hover:bg-blue-700',
          description: 'Prepare order for dispatch'
        })
        break
    }
    
    return actions
  }

  const handleActionClick = (actionConfig: {
    action: string
    label: string
    newStatus: string
    requiresData?: boolean
  }) => {
    setPendingAction(actionConfig)
    
    if (actionConfig.requiresData) {
      setShowDispatchModal(true)
    } else {
      setShowPinModal(true)
    }
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (pin !== '0000') {
      setPinError('Invalid PIN. Please try again.')
      return
    }

    if (!pendingAction) return

    await executeAction()
  }

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate dispatch data
    if (!dispatchData.invoice_number || !dispatchData.gate_pass_number || !dispatchData.dispatch_date) {
      alert('Please fill in all required dispatch information.')
      return
    }

    setShowDispatchModal(false)
    setShowPinModal(true)
  }

  const logDetailedAuditEntry = async (action: string, oldStatus: string, newStatus: string) => {
    try {
      const currentDate = new Date().toISOString()
      
      // Log the appropriate business event based on the action
      switch (action) {
        case 'confirm':
          await logBusinessEvent.customerOrder.confirmed(order.id)
          break

        case 'start_production':
          await logBusinessEvent.customerOrder.productionStarted(order.id, {
            startDate: currentDate
          })
          break

        case 'complete_production':
          await logBusinessEvent.customerOrder.productionCompleted(order.id, {
            completionDate: currentDate
          })
          
          // Check if any final allocation is needed
          if (order.quantity_allocated < order.quantity_ordered) {
            const finalAllocation = order.quantity_ordered - order.quantity_allocated
            await logBusinessEvent.customerOrder.finalAllocation(order.id, {
              quantity: finalAllocation,
              allocationDate: currentDate
            })
          }
          break

        case 'dispatch':
          await logBusinessEvent.customerOrder.dispatched(order.id, {
            invoiceNumber: dispatchData.invoice_number,
            gatePassNumber: dispatchData.gate_pass_number
          })
          break

        case 'deliver':
          // Generate delivery note number if not provided
          let deliveryNoteNumber = dispatchData.delivery_note_number
          if (!deliveryNoteNumber) {
            deliveryNoteNumber = await numberingUtils.generateDeliveryNoteNumber()
            
            // Update the order with the generated delivery note number
            await supabase
              .from('customer_orders')
              .update({ delivery_note_number: deliveryNoteNumber })
              .eq('id', order.id)
          }
          
          await logBusinessEvent.customerOrder.delivered(order.id, {
            deliveryNote: deliveryNoteNumber
          })
          break
      }
    } catch (error) {
      console.error('Error logging audit trail:', error)
    }
  }

  const getActionReason = (action: string): string => {
    switch (action) {
      case 'confirm': return 'Order confirmation by authorized user'
      case 'start_production': return 'Production commencement authorization'
      case 'complete_production': return 'Production completion verification'
      case 'ready_for_dispatch': return 'Dispatch readiness confirmation'
      case 'dispatch': return 'Customer dispatch authorization'
      case 'deliver': return 'Delivery confirmation received'
      case 'cancel': return 'Order cancellation processed'
      default: return 'Status update processed'
    }
  }

  const executeAction = async () => {
    if (!pendingAction) return

    try {
      setUpdating(true)

      // On order confirmation, create production orders
      if (pendingAction.action === 'confirm') {
        // Fetch the full customer order details with order items and their fabric details
        const { data: orderDetails, error: orderDetailsError } = await supabase
          .from('customer_orders')
          .select(`
            *, 
            customer_order_items(
              *,
              finished_fabrics(*, base_fabrics(*))
            )
          `)
          .eq('id', order.id)
          .single()
        if (orderDetailsError || !orderDetails) throw orderDetailsError || new Error('Order not found')

        // Create production orders for each order item
        const orderItems = orderDetails.customer_order_items || []
        if (orderItems.length === 0) {
          throw new Error('No order items found for this order')
        }

        for (const orderItem of orderItems) {
          // Get the specific fabric for this order item
          const fabric = orderItem.finished_fabrics
          if (!fabric) {
            console.error(`No fabric found for order item ${orderItem.id}`)
            continue
          }

          // Calculate allocation plan for this specific item
          const availableStock = fabric.stock_quantity || 0
          const stockAllocated = Math.min(orderItem.quantity_ordered, availableStock)
          const productionRequired = Math.max(0, orderItem.quantity_ordered - availableStock)
          let baseFabricAvailable = fabric.base_fabrics?.stock_quantity || 0
          let needsWeavingProduction = false
          let baseFabricShortage = 0
          
          if (productionRequired > 0 && fabric.base_fabrics) {
            baseFabricShortage = Math.max(0, productionRequired - baseFabricAvailable)
            needsWeavingProduction = baseFabricShortage > 0
          } else if (productionRequired > 0) {
            needsWeavingProduction = true
            baseFabricShortage = productionRequired
          }

          // Create weaving production order if needed
          let weavingOrderId = null
          if (needsWeavingProduction) {
            const weavingOrder = {
              internal_order_number: await numberingUtils.generateProductionOrderNumber('weaving'),
              production_type: 'weaving',
              customer_order_id: order.id,
              customer_order_item_id: orderItem.id,
              customer_color: orderItem.color,
              base_fabric_id: fabric.base_fabric_id,
              quantity_required: baseFabricShortage,
              quantity_produced: 0,
              production_status: 'pending',
              priority_level: orderDetails.priority_override,
              target_completion_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              notes: `Weaving production for customer order - ${baseFabricShortage}m base fabric shortage - Color: ${orderItem.color}`,
              production_sequence: 1
            }
            const { data: weavingResponse, error: weavingError } = await supabase
              .from('production_orders')
              .insert([weavingOrder])
              .select('id')
              .single()
            if (weavingError) throw weavingError
            weavingOrderId = weavingResponse.id
          }

          // Create coating production order if needed
          if (productionRequired > 0) {
            const coatingOrder = {
              internal_order_number: await numberingUtils.generateProductionOrderNumber('coating'),
              production_type: 'coating',
              customer_order_id: order.id,
              customer_order_item_id: orderItem.id,
              customer_color: orderItem.color,
              finished_fabric_id: fabric.id,
              quantity_required: productionRequired,
              quantity_produced: 0,
              production_status: needsWeavingProduction ? 'waiting_materials' : 'pending',
              priority_level: orderDetails.priority_override,
              target_completion_date: new Date(Date.now() + (needsWeavingProduction ? 14 : 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              notes: `Coating production for customer order - ${productionRequired}m finished fabric needed (${baseFabricAvailable}m base fabric available) - Color: ${orderItem.color}`,
              production_sequence: needsWeavingProduction ? 2 : 1,
              linked_production_order_id: weavingOrderId
            }
            const { error: coatingError } = await supabase
              .from('production_orders')
              .insert([coatingOrder])
            if (coatingError) throw coatingError
          }

          // Update stock quantities for this specific item
          if (stockAllocated > 0) {
            // Update finished fabric stock
            const { error: stockError } = await supabase
              .from('finished_fabrics')
              .update({ 
                stock_quantity: fabric.stock_quantity - stockAllocated 
              })
              .eq('id', fabric.id)

            if (stockError) {
              console.error(`Failed to update stock for fabric ${fabric.id}:`, stockError)
            }

            // Log stock movement
            await supabase
              .from('stock_movements')
              .insert([{
                fabric_type: 'finished_fabric',
                fabric_id: fabric.id,
                movement_type: 'allocation',
                quantity: -stockAllocated,
                reference_id: order.id,
                reference_type: 'customer_order',
                notes: `Stock allocated to customer order ${orderDetails.internal_order_number} - Color: ${orderItem.color}`
              }])
          }
        } // End of for loop
      }

      const updateData: any = {
        order_status: pendingAction.newStatus,
        updated_at: new Date().toISOString()
      }

      // Add dispatch data if this is a dispatch action
      if (pendingAction.action === 'dispatch') {
        updateData.invoice_number = dispatchData.invoice_number
        updateData.gate_pass_number = dispatchData.gate_pass_number
        updateData.delivery_note_number = dispatchData.delivery_note_number
        updateData.dispatch_date = dispatchData.dispatch_date
        updateData.dispatch_notes = dispatchData.dispatch_notes
      }

      const { error } = await supabase
        .from('customer_orders')
        .update(updateData)
        .eq('id', order.id)

      if (error) throw error

      // Create shipment if this is a dispatch action
      if (pendingAction.action === 'dispatch') {
        try {
                // Call the new API route instead of direct Supabase logic
                const response = await fetch('/api/shipments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: order.id, dispatchData })
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                  throw new Error(result.error || 'Failed to create shipment');
                }
                
              } catch (shipmentError: any) {
                console.error('Error creating shipment:', shipmentError);
                alert(`Warning: Order was dispatched but shipment creation failed: ${shipmentError.message || 'Unknown error'}`);
                // Continue with order update even if shipment creation fails
                // The order will still be marked as dispatched
              }
            }

      // Log comprehensive audit trail entries
      await logDetailedAuditEntry(pendingAction.action, order.order_status, pendingAction.newStatus)

      // Reset states
      handleCancel()
      onOrderUpdated()
      
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Failed to update order. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const handleCancel = () => {
    setShowPinModal(false)
    setShowDispatchModal(false)
    setPendingAction(null)
    setPin('')
    setPinError('')
    setDispatchData({
      invoice_number: '',
      gate_pass_number: '',
      delivery_note_number: '',
      dispatch_date: new Date().toISOString().split('T')[0],
      dispatch_notes: ''
    })
  }

  const availableActions = getAvailableActions()

  if (availableActions.length === 0) {
    return (
      <div className="text-xs text-gray-900">
        No actions available
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {availableActions.map((actionConfig) => {
        const IconComponent = actionConfig.icon
        return (
          <button
            key={actionConfig.action}
            onClick={() => !actionConfig.disabled && handleActionClick(actionConfig)}
            disabled={updating || actionConfig.disabled}
            className={`
              w-full flex items-center justify-center px-3 py-2 text-xs font-medium text-white rounded-md 
              transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
              ${actionConfig.color}
            `}
            title={actionConfig.description}
          >
            <IconComponent className="h-4 w-4 mr-1" />
            {actionConfig.label}
          </button>
        )
      })}

      {/* PIN Authorization Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Authorization Required</h3>
                <button
                  onClick={handleCancel}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                You are about to: <strong>{pendingAction?.label}</strong>
                <br />
                Order: <strong>{order.internal_order_number}</strong>
              </p>
              
              <form onSubmit={handlePinSubmit}>
                <div className="mb-4">
                  <label htmlFor="pin" className="block text-sm font-medium text-gray-900 mb-2">
                    Enter PIN to confirm:
                  </label>
                  <input
                    type="password"
                    id="pin"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value)
                      setPinError('')
                    }}
                    className={`block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                      pinError ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter 4-digit PIN"
                    maxLength={4}
                    required
                  />
                  {pinError && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                      {pinError}
                    </p>
                  )}
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Information Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Dispatch Information</h3>
                <button
                  onClick={handleCancel}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Please provide dispatch details for order: <strong>{order.internal_order_number}</strong>
              </p>
              
              <form onSubmit={handleDispatchSubmit} className="space-y-4">
                <div>
                  <label htmlFor="invoice_number" className="block text-sm font-medium text-gray-900 mb-1">
                    Invoice Number *
                  </label>
                  <input
                    type="text"
                    id="invoice_number"
                    value={dispatchData.invoice_number}
                    onChange={(e) => setDispatchData({ ...dispatchData, invoice_number: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="gate_pass_number" className="block text-sm font-medium text-gray-900 mb-1">
                    Gate Pass Number *
                  </label>
                  <input
                    type="text"
                    id="gate_pass_number"
                    value={dispatchData.gate_pass_number}
                    onChange={(e) => setDispatchData({ ...dispatchData, gate_pass_number: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="delivery_note_number" className="block text-sm font-medium text-gray-900 mb-1">
                    Delivery Note Number
                  </label>
                  <input
                    type="text"
                    id="delivery_note_number"
                    value={dispatchData.delivery_note_number}
                    onChange={(e) => setDispatchData({ ...dispatchData, delivery_note_number: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="dispatch_date" className="block text-sm font-medium text-gray-900 mb-1">
                    Dispatch Date *
                  </label>
                  <input
                    type="date"
                    id="dispatch_date"
                    value={dispatchData.dispatch_date}
                    onChange={(e) => setDispatchData({ ...dispatchData, dispatch_date: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="dispatch_notes" className="block text-sm font-medium text-gray-900 mb-1">
                    Dispatch Notes
                  </label>
                  <textarea
                    id="dispatch_notes"
                    value={dispatchData.dispatch_notes}
                    onChange={(e) => setDispatchData({ ...dispatchData, dispatch_notes: e.target.value })}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional dispatch notes..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Continue
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 