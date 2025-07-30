'use client'

import { useState, useEffect } from 'react'
import { 
  ClockIcon,
  PlayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import NewProductionOrderForm from '@/components/forms/NewProductionOrderForm'
import PDFGenerator from '@/components/pdf/generators/PDFGenerator'
import ExpandableProductionRow from '@/components/tables/ExpandableProductionRow'
import { logBusinessEvent } from '@/lib/utils/auditTrail'
import WeavingCompletionModal from '@/components/production/WeavingCompletionModal'
import CoatingCompletionModal from '@/components/production/CoatingCompletionModal'
import CoatingRollAllocationModal from '@/components/production/CoatingRollAllocationModal'

interface ProductionOrder {
  id: string
  internal_order_number: string
  customer_order_id: string | null
  production_type: 'weaving' | 'coating'
  base_fabric_id: string | null
  finished_fabric_id: string | null
  quantity_required: number
  quantity_produced: number
  production_status: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'waiting_materials'
  priority_level: number
  production_sequence: number | null
  planned_start_date: string | null
  planned_end_date: string | null
  target_completion_date: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  linked_production_order_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customer_color?: string
  // Related data
  customer_orders?: {
    internal_order_number: string
    customers: {
      name: string
    }
  } | null
  base_fabrics?: {
    name: string
    stock_quantity: number
  } | null
  finished_fabrics?: {
    name: string
    stock_quantity: number
    color?: string
  } | null
}



const priorityConfig = {
  0: { label: 'Normal', color: 'text-gray-600' },
  1: { label: 'Low', color: 'text-gray-700' },
  3: { label: 'Medium', color: 'text-blue-600' },
  5: { label: 'High', color: 'text-orange-600' },
  8: { label: 'Urgent', color: 'text-red-600' }
}

export default function ProductionPage() {
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // PIN Authorization states
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{orderId: string, newStatus: string} | null>(null)
  
  // Delete functionality states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeletePinModal, setShowDeletePinModal] = useState(false)
  const [deletePin, setDeletePin] = useState('')
  const [deletePinError, setDeletePinError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<ProductionOrder | null>(null)
  
  // View/Edit modal states
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [showWeavingCompletionModal, setShowWeavingCompletionModal] = useState(false)
  const [showCoatingCompletionModal, setShowCoatingCompletionModal] = useState(false)
  const [showCoatingRollAllocationModal, setShowCoatingRollAllocationModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null)

  useEffect(() => {
    loadProductionOrders()
  }, [])

  const loadProductionOrders = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('production_orders')
        .select(`
          *,
          customer_color,
          customer_orders (
            internal_order_number,
            customers (
              name
            )
          ),
          base_fabrics (
            name,
            stock_quantity
          ),
          finished_fabrics (
            name,
            stock_quantity,
            color
          ),
          linked_production_order:linked_production_order_id (
            internal_order_number,
            production_type,
            production_status
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading production orders:', error)
        return
      }

      setProductionOrders(data || [])
    } catch (error) {
      console.error('Error loading production orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const logProductionOrderStatusChange = async (orderId: string, newStatus: string) => {
    try {
      // Get production order details for richer audit context
      const { data: order, error: orderError } = await supabase
        .from('production_orders')
        .select(`
          *,
          customer_orders (
            internal_order_number,
            customers (
              name
            )
          ),
          base_fabrics (
            name
          ),
          finished_fabrics (
            name
          )
        `)
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        console.error('Error fetching production order for audit:', orderError)
        return
      }

      const fabricName = order.base_fabrics?.name || order.finished_fabrics?.name || 'Unknown Fabric'

      // Log the appropriate business event based on status change
      switch (newStatus) {
        case 'in_progress':
          await logBusinessEvent.productionOrder.commenced(orderId, {
            type: order.production_type,
            fabric: fabricName
          })

          // For coating production, only log commencement (roll allocation happens separately)
          if (order.production_type === 'coating' && order.finished_fabric_id) {
            const { data: finishedFabric, error: finishedFabricError } = await supabase
              .from('finished_fabrics')
              .select(`
                base_fabric_id,
                base_fabrics!inner (
                  name,
                  stock_quantity,
                  last_batch_number
                )
              `)
              .eq('id', order.finished_fabric_id)
              .single()

            if (!finishedFabricError && finishedFabric?.base_fabrics) {
              const baseFabric = Array.isArray(finishedFabric.base_fabrics) 
                ? finishedFabric.base_fabrics[0] 
                : finishedFabric.base_fabrics

              // Only log that production commenced - actual allocation happens via roll selection
              await logBusinessEvent.productionOrder.baseFabricAllocated(orderId, {
                fabric: baseFabric.name,
                quantity: order.quantity_required,
                batchNumber: baseFabric.last_batch_number || undefined
              })

              console.log(`Coating production commenced for ${order.internal_order_number} - roll allocation required`)
            }
          }
          break

        case 'completed':
          // Generate batch number for completed production
          const { data: batchResult } = await supabase
            .rpc('generate_batch_number', { production_type: order.production_type })

          const batchNumber = batchResult || `${order.production_type.toUpperCase()}-${Date.now()}`

          // Update production order with batch number and completion
          await supabase
            .from('production_orders')
            .update({ 
              batch_number: batchNumber,
              quantity_produced: order.quantity_required,
              actual_end_date: new Date().toISOString()
            })
            .eq('id', orderId)

          // Update inventory with batch number
          if (order.production_type === 'weaving' && order.base_fabric_id) {
            // Get current stock first
            const { data: currentStock } = await supabase
              .from('base_fabrics')
              .select('stock_quantity')
              .eq('id', order.base_fabric_id)
              .single()

            const newStock = (currentStock?.stock_quantity || 0) + order.quantity_required

            await supabase
              .from('base_fabrics')
              .update({ 
                stock_quantity: newStock,
                last_batch_number: batchNumber
              })
              .eq('id', order.base_fabric_id)
          } else if (order.production_type === 'coating' && order.finished_fabric_id) {
            // Get current stock first
            const { data: currentStock } = await supabase
              .from('finished_fabrics')
              .select('stock_quantity')
              .eq('id', order.finished_fabric_id)
              .single()

            const newStock = (currentStock?.stock_quantity || 0) + order.quantity_required

            await supabase
              .from('finished_fabrics')
              .update({ 
                stock_quantity: newStock,
                last_batch_number: batchNumber
              })
              .eq('id', order.finished_fabric_id)
          }

          // Log completion with batch number
          await logBusinessEvent.productionOrder.completed(orderId, {
            type: order.production_type,
            fabric: fabricName,
            quantity: order.quantity_required,
            batchNumber: batchNumber
          })

          // Log inventory update with batch number
          await logBusinessEvent.productionOrder.inventoryUpdated(orderId, {
            fabric: fabricName,
            quantity: order.quantity_required,
            type: order.production_type,
            batchNumber: batchNumber
          })

          break

        case 'on_hold':
          await logBusinessEvent.productionOrder.onHold(orderId, 'Production hold requested by user')
          break

        case 'waiting_materials':
          await logBusinessEvent.productionOrder.materialShortage(orderId)
          break
      }

    } catch (error) {
      console.error('Error logging production order audit:', error)
    }
  }

  const updateProductionStatus = (orderId: string, newStatus: string) => {
    // Find the order to get its details
    const order = productionOrders.find(o => o.id === orderId)
    
    if (newStatus === 'completed' && order?.production_type === 'weaving') {
      // For weaving completion, open the enhanced modal
      setSelectedOrder(order)
      setShowWeavingCompletionModal(true)
    } else if (newStatus === 'completed' && order?.production_type === 'coating') {
      // For coating completion, open the enhanced modal
      setSelectedOrder(order)
      setShowCoatingCompletionModal(true)
    } else if (newStatus === 'in_progress' && order?.production_type === 'coating') {
      // For coating production start, open roll allocation modal
      setSelectedOrder(order)
      setShowCoatingRollAllocationModal(true)
    } else {
      // For other status changes, use the PIN modal
      setPendingStatusUpdate({ orderId, newStatus })
      setShowPinModal(true)
    }
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (pin !== '0000') {
      setPinError('Invalid PIN. Please try again.')
      return
    }

    if (!pendingStatusUpdate) return

    const { orderId, newStatus } = pendingStatusUpdate

    try {
      // If marking as completed, use the API to handle everything
      if (newStatus === 'completed') {
        console.log('Handling completion via API for order:', orderId)
        
        // Check if already completed to avoid duplicate processing
        const { data: preCheckOrder, error: preCheckError } = await supabase
          .from('production_orders')
          .select('production_status, quantity_produced')
          .eq('id', orderId)
          .single()
        
        if (!preCheckError && preCheckOrder) {
          if (preCheckOrder.production_status === 'completed') {
            console.log('Production order already completed, skipping')
            handlePinCancel()
            return
          }
          
          // Call API to handle all completion logic
          await handleProductionCompletion(orderId)
          await updateLinkedProductionOrders(orderId)
        }
      } else {
        // For all other status changes, update directly in database
        const updateData: {
          production_status: string
          updated_at: string
          actual_start_date?: string
        } = {
          production_status: newStatus,
          updated_at: new Date().toISOString()
        }

        // Set start date if marking as in progress
        if (newStatus === 'in_progress') {
          updateData.actual_start_date = new Date().toISOString()
        }

        const { error } = await supabase
          .from('production_orders')
          .update(updateData)
          .eq('id', orderId)

        if (error) {
          console.error('Error updating production status:', error)
          return
        }

        // Log audit trail for non-completion status changes
        await logProductionOrderStatusChange(orderId, newStatus)
      }

      // Reload data and close modal
      loadProductionOrders()
      handlePinCancel()
    } catch (error) {
      console.error('Error updating production status:', error)
    }
  }

  const handleProductionCompletion = async (orderId: string) => {
    try {
      console.log('Starting production completion for order:', orderId)
      
      // Get the production order details to use the required quantity
      const productionOrder = productionOrders.find(o => o.id === orderId)
      const actualQuantity = productionOrder?.quantity_required || 100 // Default fallback
      
      console.log('Found production order:', productionOrder)
      console.log('Using actualQuantity:', actualQuantity)
      
      // Use our production completion API
      const response = await fetch('/api/production/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productionOrderId: orderId,
          actualQuantity: actualQuantity,
          completedBy: 'Production Manager',
          qualityNotes: 'Production completed successfully'
        })
      })

      console.log('API response status:', response.status, response.ok)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Error completing production:', errorData)
        throw new Error(errorData.error || 'Failed to complete production')
      }

      console.log('About to parse JSON response...')
      const result = await response.json()
      console.log('JSON parsed successfully:', result)
      
      // Show success notification with details
      console.log('Production completed successfully:', result)

      console.log('Production completion notification removed - check console for details')
      
      // Log completion details to console instead of showing browser alert
      if (result.batchNumber) {
        console.log('Production completed successfully:', {
          productionType: result.productionType,
          batchNumber: result.batchNumber,
          quantity: actualQuantity,
          rollsCreated: result.rollsCreated,
          qrCodesGenerated: result.qrCodesGenerated
        })
      }

      console.log('About to check pending orders allocation...')
      
      // Check if this completion enables any pending orders to be allocated
      const completedOrder = productionOrders.find(o => o.id === orderId)
      if (completedOrder && completedOrder.finished_fabric_id) {
        console.log('Production completion - checking for pending orders to allocate for fabric_id:', completedOrder.finished_fabric_id);
        try {
          const allocatedOrders = await checkPendingOrdersForAllocation(completedOrder.finished_fabric_id)
          
          // Show notification if orders were auto-allocated
          if (allocatedOrders && allocatedOrders.length > 0) {
            console.log(`Auto-allocated stock to ${allocatedOrders.length} pending order(s)`)
            // You could emit an event here or use a global notification state
          }
        } catch (allocationError) {
          console.warn('Error checking pending orders for allocation:', allocationError)
          // Don't fail the entire operation for this
        }
      }

      console.log('Production completion finished successfully')

    } catch (error) {
      console.error('Error in handleProductionCompletion - Type:', typeof error)
      console.error('Error in handleProductionCompletion - Constructor:', error?.constructor?.name)
      console.error('Error in handleProductionCompletion - Message:', error instanceof Error ? error.message : 'Unknown error')
      console.error('Error completing production:', error)
      console.error('Production completion failed - check console for details')
    }
  }

  const checkPendingOrdersForAllocation = async (fabricId: string): Promise<Array<{orderId: string, allocation: number}>> => {
    try {
      // Get current stock level
      const { data: fabric, error: fabricError } = await supabase
        .from('finished_fabrics')
        .select('stock_quantity')
        .eq('id', fabricId)
        .single()

      if (fabricError || !fabric) return []

      // Find pending orders for this fabric that can now be allocated
      const { data: pendingOrders, error: ordersError } = await supabase
        .from('customer_orders')
        .select('*')
        .eq('finished_fabric_id', fabricId)
        .in('order_status', ['pending', 'partially_allocated'])
        .order('created_at', { ascending: true }) // FIFO allocation

      if (ordersError || !pendingOrders) return []
      
      console.log(`Found ${pendingOrders.length} pending orders for fabric_id ${fabricId}:`, pendingOrders.map(o => ({
        id: o.id,
        internal_order_number: o.internal_order_number,
        color: o.color,
        quantity_ordered: o.quantity_ordered,
        quantity_allocated: o.quantity_allocated,
        order_status: o.order_status
      })));

      let availableStock = fabric.stock_quantity
      const allocations: Array<{orderId: string, allocation: number}> = []

      // Calculate possible allocations
      for (const order of pendingOrders) {
        const remainingQuantity = order.quantity_ordered - (order.quantity_allocated || 0)
        const allocationAmount = Math.min(remainingQuantity, availableStock)
        
        if (allocationAmount > 0) {
          allocations.push({
            orderId: order.id,
            allocation: allocationAmount
          })
          availableStock -= allocationAmount
        }

        if (availableStock <= 0) break
      }

      // Apply allocations
      for (const { orderId, allocation } of allocations) {
        const order = pendingOrders.find(o => o.id === orderId)
        if (!order) continue

        let allocationLeft = allocation;
        
        // Get the order details to determine the correct color for allocation
        const { data: orderDetails, error: orderDetailsError } = await supabase
          .from('customer_orders')
          .select(`
            *,
            customer_order_items (
              id,
              color,
              quantity_ordered,
              quantity_allocated
            )
          `)
          .eq('id', orderId)
          .single();
        
        if (orderDetailsError) {
          console.error('Error fetching order details for allocation:', orderDetailsError);
          continue;
        }
        
        // Determine the target color for allocation
        let targetColor = orderDetails.finished_fabrics?.color || 'Natural';
        let orderItemId = null;
        
        if (orderDetails.customer_order_items && orderDetails.customer_order_items.length > 0) {
          const itemNeedingAllocation = orderDetails.customer_order_items.find((item: any) => 
            item.quantity_allocated < item.quantity_ordered
          );
          if (itemNeedingAllocation) {
            targetColor = itemNeedingAllocation.color;
            orderItemId = itemNeedingAllocation.id;
          }
        }
        
        console.log(`Auto-allocation debug - Order ${order.internal_order_number}: target color = ${targetColor}`);
        
        // Fetch available rolls for this finished fabric and color (FIFO)
        const { data: availableRolls, error: rollsError } = await supabase
          .from('fabric_rolls')
          .select('*')
          .eq('fabric_id', fabricId)
          .eq('fabric_type', 'finished_fabric')
          .eq('roll_status', 'available')
          .eq('customer_color', targetColor)
          .gt('remaining_length', 0)
          .order('created_at', { ascending: true });
        if (rollsError) throw rollsError;
        
        console.log(`Found ${availableRolls?.length || 0} available rolls for fabric_id ${fabricId}, color ${targetColor}:`, availableRolls?.map(r => ({
          id: r.id,
          roll_number: r.roll_number,
          customer_color: r.customer_color,
          remaining_length: r.remaining_length,
          quality_grade: r.quality_grade
        })) || []);
        
        if (!availableRolls || availableRolls.length === 0) throw new Error('No available rolls found for allocation');
        // Allocate rolls
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
              customer_order_id: orderId,
              customer_order_item_id: orderItemId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', roll.id);
          if (rollUpdateError) {
            // Optionally, keep a single error log for production
            console.error('Error updating roll status during auto-allocation:', rollUpdateError.message || rollUpdateError);
          }
          allocationLeft -= allocFromThisRoll;
        }

        // Update the specific order item if we have one
        if (orderItemId) {
          const itemNeedingAllocation = orderDetails.customer_order_items?.find((item: any) => 
            item.quantity_allocated < item.quantity_ordered
          );
          if (itemNeedingAllocation) {
            const newItemAllocated = itemNeedingAllocation.quantity_allocated + allocation;
            await supabase
              .from('customer_order_items')
              .update({
                quantity_allocated: newItemAllocated,
                updated_at: new Date().toISOString(),
              })
              .eq('id', orderItemId);
          }
        }

        const newTotalAllocated = (order.quantity_allocated || 0) + allocation
        const newStatus = newTotalAllocated >= order.quantity_ordered 
          ? 'fully_allocated' 
          : 'partially_allocated'

        // Update order allocation
        await supabase
          .from('customer_orders')
          .update({
            quantity_allocated: newTotalAllocated,
            order_status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)

        // Record stock movement
        const { error: movementError } = await supabase.from('stock_movements').insert({
          fabric_type: 'finished_fabric',
          fabric_id: fabricId,
          movement_type: 'allocation',
          quantity: -allocation,
          reference_id: orderId,
          reference_type: 'customer_order',
          notes: `Auto-allocated after production completion to order ${order.internal_order_number}`,
          created_at: new Date().toISOString()
        })
        if (movementError) {
          // Optionally, keep a single error log for production
          console.error('Error logging stock movement during auto-allocation:', movementError.message || movementError);
        }

        // Log the allocation in customer order audit trail
        const allocationTime = new Date().toISOString()
        if (newTotalAllocated >= order.quantity_ordered) {
          // Final allocation completed
          await logBusinessEvent.customerOrder.finalAllocation(orderId, {
            quantity: allocation,
            allocationDate: allocationTime
          })
        } else {
          // Partial allocation
          await logBusinessEvent.customerOrder.stockAllocated(orderId, {
            quantity: allocation,
            remaining: order.quantity_ordered - newTotalAllocated,
            allocationDate: allocationTime
          })
        }
      }

      // Update final stock quantity
      if (allocations.length > 0) {
        const totalAllocated = allocations.reduce((sum, a) => sum + a.allocation, 0)
        await supabase
          .from('finished_fabrics')
          .update({
            stock_quantity: fabric.stock_quantity - totalAllocated,
            updated_at: new Date().toISOString()
          })
          .eq('id', fabricId)
      }

      return allocations

    } catch (error) {
      console.error('Error checking pending orders for allocation:', error)
      return []
    }
  }

  const updateLinkedProductionOrders = async (completedOrderId: string) => {
    try {
      // Get the completed order details for audit logging
      const { data: completedOrder, error: completedOrderError } = await supabase
        .from('production_orders')
        .select(`
          *,
          base_fabrics (name),
          finished_fabrics (name)
        `)
        .eq('id', completedOrderId)
        .single()

      if (completedOrderError || !completedOrder) {
        console.error('Error fetching completed order:', completedOrderError)
        return
      }

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

        // Log the linked weaving completion and materials ready for each coating order
        for (const linkedOrder of linkedOrders) {
          // Log that the linked weaving order has been completed
          await logBusinessEvent.productionOrder.linkedWeavingCompleted(linkedOrder.id, {
            linkedOrderNumber: completedOrder.internal_order_number,
            quantity: completedOrder.quantity_produced,
            batchNumber: completedOrder.batch_number
          })

          // Log that materials are now ready for coating production
          await logBusinessEvent.productionOrder.materialsReady(linkedOrder.id, {
            type: 'coating'
          })
        }
      }
    } catch (error) {
      console.error('Error updating linked production orders:', error)
    }
  }

  const handlePinCancel = () => {
    setShowPinModal(false)
    setPinError('')
    setPin('')
    setPendingStatusUpdate(null)
  }

  const handleDeleteOrder = (order: ProductionOrder) => {
    setOrderToDelete(order)
    setShowDeleteModal(true)
  }

  const confirmDelete = () => {
    setShowDeleteModal(false)
    setShowDeletePinModal(true)
  }

  const handleDeletePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (deletePin !== '0000') {
      setDeletePinError('Invalid PIN. Please try again.')
      return
    }

    if (!orderToDelete) return

    setDeleting(true)
    try {
      // If this is a weaving order with linked coating orders, update them first
      if (orderToDelete.production_type === 'weaving') {
        const { error: linkUpdateError } = await supabase
          .from('production_orders')
          .update({ 
            linked_production_order_id: null,
            production_status: 'pending'
          })
          .eq('linked_production_order_id', orderToDelete.id)

        if (linkUpdateError) {
          console.error('Error updating linked orders:', linkUpdateError)
        }
      }

      // Delete the production order
      const { error: deleteError } = await supabase
        .from('production_orders')
        .delete()
        .eq('id', orderToDelete.id)

      if (deleteError) throw deleteError

      // Reload production orders
      loadProductionOrders()
      handleDeleteCancel()
    } catch (error) {
      console.error('Error deleting production order:', error)
      alert('Failed to delete production order. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
    setShowDeletePinModal(false)
    setDeletePin('')
    setDeletePinError('')
    setOrderToDelete(null)
  }

  // View/Edit handlers
  const handleViewOrder = (order: ProductionOrder) => {
    setSelectedOrder(order)
    setShowViewModal(true)
  }

  const handleEditOrder = (order: ProductionOrder) => {
    setSelectedOrder(order)
    setShowEditModal(true)
  }

  const handleNewOrder = () => {
    setShowNewOrderModal(true)
  }

  const closeModals = () => {
    setShowViewModal(false)
    setShowEditModal(false)
    setShowNewOrderModal(false)
    setShowWeavingCompletionModal(false)
    setShowCoatingCompletionModal(false)
    setShowCoatingRollAllocationModal(false)
    setSelectedOrder(null)
  }

  const filteredOrders = productionOrders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.production_status === filterStatus
    const matchesType = filterType === 'all' || order.production_type === filterType
    const matchesSearch = searchTerm === '' || 
      order.internal_order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_orders?.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.base_fabrics?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.finished_fabrics?.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesStatus && matchesType && matchesSearch
      })
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString()
  }
  
    if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Production Management</h1>
          <p className="text-gray-600">Monitor and manage all production orders</p>
        </div>
        <div className="flex space-x-3">
          <PDFGenerator
            type="production-wip-report"
            buttonText="Production & WIP Report"
            buttonClassName="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center text-sm"
          />
          <button 
            onClick={handleNewOrder}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Production Order
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{productionOrders.length}</p>
            </div>
            <ClockIcon className="h-8 w-8 text-gray-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">
                {productionOrders.filter(o => o.production_status === 'in_progress').length}
              </p>
            </div>
            <PlayIcon className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {productionOrders.filter(o => o.production_status === 'pending').length}
              </p>
            </div>
            <ClockIcon className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {productionOrders.filter(o => o.production_status === 'completed').length}
              </p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="waiting_materials">Waiting Materials</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="weaving">Weaving</option>
            <option value="coating">Coating</option>
          </select>
          
          <input
            type="text"
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-900 flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Production Orders Table */}
      <div className="bg-white shadow border rounded-lg overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <ClockIcon className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Production Orders</h3>
            <p className="text-gray-600">
              {productionOrders.length === 0 
                ? "No production orders have been created yet." 
                : "No orders match your current filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Order Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Material
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Target Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <ExpandableProductionRow
                    key={order.id}
                    order={order}
                    onStatusUpdate={updateProductionStatus}
                    onView={handleViewOrder}
                    onEdit={handleEditOrder}
                    onDelete={handleDeleteOrder}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-sm mx-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 text-center mb-2">Delete Production Order</h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              Are you sure you want to delete production order <strong>{orderToDelete.internal_order_number}</strong>?
              <br />
              <span className="text-xs text-gray-700 mt-1 block">
                Type: {orderToDelete.production_type} • Status: {orderToDelete.production_status}
              </span>
            </p>
            {orderToDelete.production_type === 'weaving' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> This will unlink any coating orders that depend on this weaving order.
                </p>
              </div>
            )}
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete PIN Authorization Modal */}
      {showDeletePinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Authorization Required</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please enter your PIN to authorize production order deletion.
            </p>
            <form onSubmit={handleDeletePinSubmit}>
              <input
                type="password"
                value={deletePin}
                onChange={(e) => setDeletePin(e.target.value)}
                placeholder="Enter PIN"
                maxLength={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-lg tracking-widest text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
              {deletePinError && (
                <p className="mt-2 text-sm text-red-600 text-center">{deletePinError}</p>
              )}
              <div className="flex space-x-3 mt-4">
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!deletePin || deleting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN Authorization Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Authorization Required</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please enter your PIN to authorize production status changes.
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
                  disabled={!pin}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Production Order Modal */}
      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Production Order Details</h3>
              <button
                onClick={closeModals}
                className="text-gray-600 hover:text-gray-800"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Order Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Order Number</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrder.internal_order_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Production Type</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{selectedOrder.production_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{selectedOrder.production_status.replace('_', ' ')}</p>
                </div>
                {/* Add Colour field here */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Colour</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedOrder.customer_color || selectedOrder.finished_fabrics?.color || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority Level</label>
                  <p className="mt-1 text-sm text-gray-900">{priorityConfig[selectedOrder.priority_level as keyof typeof priorityConfig]?.label || 'Normal'}</p>
                </div>
              </div>

              {/* Customer Information */}
              {selectedOrder.customer_orders && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Customer Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Customer</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedOrder.customer_orders.customers?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Customer Order</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedOrder.customer_orders.internal_order_number}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Material Information */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">Material Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Material</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedOrder.production_type === 'weaving' 
                        ? selectedOrder.base_fabrics?.name 
                        : selectedOrder.finished_fabrics?.name}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Stock</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {selectedOrder.production_type === 'weaving' 
                        ? selectedOrder.base_fabrics?.stock_quantity 
                        : selectedOrder.finished_fabrics?.stock_quantity}m
                    </p>
                  </div>
                </div>
              </div>

              {/* Production Details */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">Production Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity Required</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedOrder.quantity_required}m</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity Produced</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedOrder.quantity_produced}m</p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">Important Dates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedOrder.created_at)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Target Completion</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(selectedOrder.target_completion_date)}</p>
                  </div>
                  {selectedOrder.actual_start_date && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Started</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedOrder.actual_start_date)}</p>
                    </div>
                  )}
                  {selectedOrder.actual_end_date && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Completed</label>
                      <p className="mt-1 text-sm text-gray-900">{formatDate(selectedOrder.actual_end_date)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={closeModals}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Production Order Modal */}
      {showEditModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Edit Production Order</h3>
              <button
                onClick={closeModals}
                className="text-gray-600 hover:text-gray-800"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Edit functionality will be available in the next update. Currently, you can update order status using the action buttons in the table.
            </p>

            <div className="flex justify-end">
              <button
                onClick={closeModals}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Production Order Modal */}
      <NewProductionOrderForm
        isOpen={showNewOrderModal}
        onClose={closeModals}
        onOrderCreated={loadProductionOrders}
      />

      {/* Weaving Completion Modal */}
      {selectedOrder && (
        <WeavingCompletionModal
          isOpen={showWeavingCompletionModal}
          onClose={closeModals}
          productionOrder={selectedOrder}
          onCompleted={loadProductionOrders}
        />
      )}

      {/* Coating Completion Modal */}
      {selectedOrder && (
        <CoatingCompletionModal
          isOpen={showCoatingCompletionModal}
          onClose={closeModals}
          productionOrder={selectedOrder}
          onCompleted={loadProductionOrders}
        />
      )}

      {/* Coating Roll Allocation Modal */}
      {selectedOrder && (
        <CoatingRollAllocationModal
          isOpen={showCoatingRollAllocationModal}
          onClose={closeModals}
          productionOrder={selectedOrder}
          onAllocationComplete={loadProductionOrders}
        />
      )}
    </div>
  )
} 