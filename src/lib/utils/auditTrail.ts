import { supabase } from '@/lib/supabase/client'

interface AuditEntry {
  action_type: string
  field_changed?: string
  old_value?: string
  new_value?: string
  change_description: string
  changed_by?: string
  change_reason?: string
}

export const logCustomerOrderAudit = async (
  customerOrderId: string,
  auditEntry: AuditEntry
) => {
  try {
    const { error } = await supabase
      .from('customer_order_audit')
      .insert({
        customer_order_id: customerOrderId,
        action_type: auditEntry.action_type,
        field_changed: auditEntry.field_changed || null,
        old_value: auditEntry.old_value || null,
        new_value: auditEntry.new_value || null,
        change_description: auditEntry.change_description,
        changed_by: auditEntry.changed_by || 'System',
        change_reason: auditEntry.change_reason || null,
      })

    if (error) {
      console.error('Error logging customer order audit:', error)
    }
  } catch (error) {
    console.error('Error logging customer order audit:', error)
  }
}

export const logProductionOrderAudit = async (
  productionOrderId: string,
  auditEntry: AuditEntry
) => {
  try {
    const { error } = await supabase
      .from('production_order_audit')
      .insert({
        production_order_id: productionOrderId,
        action_type: auditEntry.action_type,
        field_changed: auditEntry.field_changed || null,
        old_value: auditEntry.old_value || null,
        new_value: auditEntry.new_value || null,
        change_description: auditEntry.change_description,
        changed_by: auditEntry.changed_by || 'System',
        change_reason: auditEntry.change_reason || null,
      })

    if (error) {
      console.error('Error logging production order audit:', error)
    }
  } catch (error) {
    console.error('Error logging production order audit:', error)
  }
}

// Enhanced audit logging for business events
export const logBusinessEvent = {
  // Customer Order Events
  customerOrder: {
    created: async (orderId: string, details: { orderNumber: string, customer: string, fabric: string, quantity: number }) => {
      await logCustomerOrderAudit(orderId, {
        action_type: 'order_received',
        change_description: `Customer order received from ${details.customer} for ${details.fabric} (${details.quantity}m)`,
        changed_by: 'User',
        change_reason: 'New customer order processed'
      })
    },

    stockAllocated: async (orderId: string, details: { quantity: number, remaining: number, allocationDate?: string }) => {
      const allocationTime = details.allocationDate ? new Date(details.allocationDate).toLocaleString() : new Date().toLocaleString()
      await logCustomerOrderAudit(orderId, {
        action_type: 'stock_allocated',
        change_description: `Stock allocated: ${details.quantity}m from existing inventory at ${allocationTime}${details.remaining > 0 ? ` (${details.remaining}m requires production)` : ''}`,
        changed_by: 'System',
        change_reason: 'Automatic stock allocation from available inventory'
      })
    },

    confirmed: async (orderId: string) => {
      await logCustomerOrderAudit(orderId, {
        action_type: 'order_confirmed',
        change_description: 'Order confirmed and approved for production planning',
        changed_by: 'User',
        change_reason: 'Management approval obtained'
      })
    },

    productionStarted: async (orderId: string, details?: { startDate?: string }) => {
      const startTime = details?.startDate ? new Date(details.startDate).toLocaleString() : new Date().toLocaleString()
      await logCustomerOrderAudit(orderId, {
        action_type: 'production_commenced',
        change_description: `Production work commenced for customer order on ${startTime}`,
        changed_by: 'User',
        change_reason: 'Production line allocated and work started'
      })
    },

    productionCompleted: async (orderId: string, details?: { completionDate?: string }) => {
      const completionTime = details?.completionDate ? new Date(details.completionDate).toLocaleString() : new Date().toLocaleString()
      await logCustomerOrderAudit(orderId, {
        action_type: 'production_completed',
        change_description: `All production work completed and quality approved on ${completionTime}`,
        changed_by: 'User',
        change_reason: 'Production finished and ready for dispatch'
      })
    },

    finalAllocation: async (orderId: string, details: { quantity: number, allocationDate?: string }) => {
      const allocationTime = details.allocationDate ? new Date(details.allocationDate).toLocaleString() : new Date().toLocaleString()
      await logCustomerOrderAudit(orderId, {
        action_type: 'final_allocation_completed',
        change_description: `Final allocation completed: ${details.quantity}m allocated from completed production at ${allocationTime}`,
        changed_by: 'System',
        change_reason: 'Production completion - final stock allocation'
      })
    },

    dispatched: async (orderId: string, details: { invoiceNumber?: string, gatePassNumber?: string }) => {
      const documents = []
      if (details.invoiceNumber) documents.push(`Invoice: ${details.invoiceNumber}`)
      if (details.gatePassNumber) documents.push(`Gate Pass: ${details.gatePassNumber}`)
      
      await logCustomerOrderAudit(orderId, {
        action_type: 'order_dispatched',
        change_description: `Order dispatched to customer${documents.length > 0 ? ` with ${documents.join(', ')}` : ''}`,
        changed_by: 'User',
        change_reason: 'Customer dispatch processed'
      })
    },

    delivered: async (orderId: string, details?: { deliveryNote?: string }) => {
      const deliveryNoteInfo = details?.deliveryNote ? ` (Delivery Note: ${details.deliveryNote})` : ''
      await logCustomerOrderAudit(orderId, {
        action_type: 'order_delivered',
        change_description: `Order successfully delivered to customer${deliveryNoteInfo}`,
        changed_by: 'User',
        change_reason: 'Customer delivery confirmed'
      })
    }
  },

  // Production Order Events
  productionOrder: {
    created: async (orderId: string, details: { orderNumber: string, type: string, fabric: string, quantity: number }) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'production_order_received',
        change_description: `${details.type.charAt(0).toUpperCase() + details.type.slice(1)} production order received for ${details.fabric} (${details.quantity}m)`,
        changed_by: 'User',
        change_reason: 'New production order created'
      })
    },

    planned: async (orderId: string, details: { targetDate: string, orderNumber: string }) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'production_planned',
        change_description: `Production plan updated - Order ${details.orderNumber} scheduled for completion by ${details.targetDate}`,
        changed_by: 'System',
        change_reason: 'Production planning and scheduling completed'
      })
    },

    baseFabricAllocated: async (orderId: string, details: { fabric: string, quantity: number, batchNumber?: string }) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'base_fabric_allocated',
        change_description: `Base fabric allocated from stock: ${details.fabric} (${details.quantity}m)${details.batchNumber ? ` - Batch: ${details.batchNumber}` : ''}`,
        changed_by: 'System',
        change_reason: 'Material allocation from existing inventory'
      })
    },

    linkedWeavingCompleted: async (orderId: string, details: { linkedOrderNumber: string, quantity: number, batchNumber?: string }) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'linked_weaving_completed',
        change_description: `Linked weaving production completed - Order ${details.linkedOrderNumber} (${details.quantity}m base fabric produced)${details.batchNumber ? ` - Batch: ${details.batchNumber}` : ''}`,
        changed_by: 'System',
        change_reason: 'Dependent production completion'
      })
    },

    materialsReady: async (orderId: string, details: { type: string }) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'materials_ready',
        change_description: `All required materials are now available - ${details.type} production can commence`,
        changed_by: 'System',
        change_reason: 'Material availability confirmed'
      })
    },

    commenced: async (orderId: string, details: { type: string, fabric: string }) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'production_commenced',
        change_description: `${details.type.charAt(0).toUpperCase() + details.type.slice(1)} production work commenced for ${details.fabric}`,
        changed_by: 'User',
        change_reason: 'Production line allocated and work started'
      })
    },

    completed: async (orderId: string, details: { type: string, fabric: string, quantity: number, batchNumber?: string }) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'production_finished',
        change_description: `${details.type.charAt(0).toUpperCase() + details.type.slice(1)} production completed successfully - ${details.fabric} (${details.quantity}m produced)${details.batchNumber ? ` - Batch: ${details.batchNumber}` : ''}`,
        changed_by: 'User',
        change_reason: 'Production work finished and quality approved'
      })
    },

    inventoryUpdated: async (orderId: string, details: { fabric: string, quantity: number, type: string, batchNumber?: string }) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'inventory_updated',
        change_description: `Inventory updated - ${details.fabric} stock increased by ${details.quantity}m (${details.type} production)${details.batchNumber ? ` - Batch: ${details.batchNumber}` : ''}`,
        changed_by: 'System',
        change_reason: 'Production completion - stock levels updated'
      })
    },

    baseFabricConsumed: async (orderId: string, details: { fabric: string, quantity: number, batchNumber?: string }) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'base_fabric_consumed',
        change_description: `Base fabric consumed in coating process: ${details.fabric} (${details.quantity}m)${details.batchNumber ? ` - Batch: ${details.batchNumber}` : ''}`,
        changed_by: 'System',
        change_reason: 'Material consumption during coating production'
      })
    },

    onHold: async (orderId: string, reason?: string) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'production_on_hold',
        change_description: `Production work temporarily halted${reason ? ` - ${reason}` : ''}`,
        changed_by: 'User',
        change_reason: 'Production hold requested - awaiting resolution'
      })
    },

    materialShortage: async (orderId: string) => {
      await logProductionOrderAudit(orderId, {
        action_type: 'material_shortage',
        change_description: 'Production delayed due to insufficient raw materials',
        changed_by: 'User',
        change_reason: 'Material availability issue'
      })
    }
  }
}

// Legacy function for simple descriptions - kept for backward compatibility
export const generateOrderAuditDescription = (
  action: string,
  details?: Record<string, unknown>
): string => {
  switch (action) {
    case 'created':
      return 'Order created with initial data and specifications'
    case 'allocated':
      return `Stock allocated to order (${details?.quantity || 'N/A'}m allocated)`
    case 'dispatched':
      return `Order dispatched${details?.gate_pass ? ` with Gate Pass: ${details.gate_pass}` : ''}`
    case 'production_started':
      return 'Production work commenced for this order'
    case 'production_completed':
      return 'Production work completed successfully'
    default:
      return `Order ${action.replace(/_/g, ' ')}`
  }
} 