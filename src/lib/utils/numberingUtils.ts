import { supabase } from '@/lib/supabase/client'

export const numberingUtils = {
  // Generate customer order number
  generateOrderNumber: async (): Promise<string> => {
    const today = new Date()
    const year = today.getFullYear().toString().slice(-2)
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    
    // Get next sequence number for today
    const datePrefix = `ORD${year}${month}${day}`
    const { data: existingOrders } = await supabase
      .from('customer_orders')
      .select('internal_order_number')
      .like('internal_order_number', `${datePrefix}%`)
      .order('internal_order_number', { ascending: false })
      .limit(1)

    let sequence = 1
    if (existingOrders && existingOrders.length > 0) {
      const lastNumber = existingOrders[0].internal_order_number
      const lastSequence = parseInt(lastNumber.slice(-3))
      sequence = lastSequence + 1
    }

    return `${datePrefix}${sequence.toString().padStart(3, '0')}`
  },

  // Generate production order number
  generateProductionOrderNumber: async (productionType: 'weaving' | 'coating'): Promise<string> => {
    const today = new Date()
    const year = today.getFullYear().toString().slice(-2)
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    
    const suffix = productionType === 'weaving' ? 'W' : 'C'
    const datePrefix = `ORD${year}${month}${day}`
    
    // Get next sequence number for today and type
    const { data: existingOrders } = await supabase
      .from('production_orders')
      .select('internal_order_number')
      .like('internal_order_number', `${datePrefix}%${suffix}`)
      .order('internal_order_number', { ascending: false })
      .limit(1)

    let sequence = 1
    if (existingOrders && existingOrders.length > 0) {
      const lastNumber = existingOrders[0].internal_order_number
      const lastSequence = parseInt(lastNumber.slice(-4, -1))
      sequence = lastSequence + 1
    }

    return `${datePrefix}${sequence.toString().padStart(3, '0')}-${suffix}`
  },

  // Generate batch number using database function
  generateBatchNumber: async (productionType: 'weaving' | 'coating'): Promise<string> => {
    try {
      const { data, error } = await supabase
        .rpc('generate_batch_number', { p_production_type: productionType })
      
      if (error) {
        console.warn('Database function failed, using fallback:', error.message)
        // Fallback to manual generation if database function fails
        return numberingUtils.generateBatchNumberFallback(productionType)
      }
      
      return data
    } catch (error) {
      console.error('Error generating batch number:', error)
      // Fallback to manual generation
      return numberingUtils.generateBatchNumberFallback(productionType)
    }
  },

  // Fallback batch number generation
  generateBatchNumberFallback: async (productionType: 'weaving' | 'coating'): Promise<string> => {
    const prefix = productionType.toUpperCase()
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
    
    // Get next sequence number for today
    const { data: existingBatches } = await supabase
      .from('production_batches')
      .select('batch_number')
      .like('batch_number', `${prefix}-${dateStr}-%`)
      .order('batch_number', { ascending: false })
      .limit(1)

    let sequence = 1
    if (existingBatches && existingBatches.length > 0) {
      const lastBatch = existingBatches[0].batch_number
      const lastSequence = parseInt(lastBatch.slice(-3))
      sequence = lastSequence + 1
    }

    return `${prefix}-${dateStr}-${sequence.toString().padStart(3, '0')}`
  },

  // Generate shipment number
  generateShipmentNumber: async (): Promise<string> => {
    const today = new Date()
    const year = today.getFullYear().toString().slice(-2)
    
    // Get next sequence number for this year
    const { data: existingShipments } = await supabase
      .from('shipments')
      .select('shipment_number')
      .like('shipment_number', `SH${year}%`)
      .order('shipment_number', { ascending: false })
      .limit(1)

    let sequence = 1
    if (existingShipments && existingShipments.length > 0) {
      const lastNumber = existingShipments[0].shipment_number
      const lastSequence = parseInt(lastNumber.slice(4))
      sequence = lastSequence + 1
    }

    return `SH${year}${sequence.toString().padStart(4, '0')}`
  },

  // Generate delivery note number
  generateDeliveryNoteNumber: async (): Promise<string> => {
    const today = new Date()
    const year = today.getFullYear().toString().slice(-2)
    const month = (today.getMonth() + 1).toString().padStart(2, '0')
    const day = today.getDate().toString().padStart(2, '0')
    
    const datePrefix = `DN${year}${month}${day}`
    
    // Get next sequence number for today
    const { data: existingNotes } = await supabase
      .from('customer_orders')
      .select('delivery_note_number')
      .like('delivery_note_number', `${datePrefix}%`)
      .not('delivery_note_number', 'is', null)
      .order('delivery_note_number', { ascending: false })
      .limit(1)

    let sequence = 1
    if (existingNotes && existingNotes.length > 0) {
      const lastNumber = existingNotes[0].delivery_note_number
      if (lastNumber) {
        const lastSequence = parseInt(lastNumber.slice(-3))
        sequence = lastSequence + 1
      }
    }

    return `${datePrefix}${sequence.toString().padStart(3, '0')}`
  },

  // Generate roll number for a batch
  generateRollNumber: (batchNumber: string, rollIndex: number): string => {
    return `${batchNumber}-R${rollIndex.toString().padStart(3, '0')}`
  },

  // Validate number format
  validateOrderNumber: (orderNumber: string): boolean => {
    return /^ORD\d{6}\d{3}$/.test(orderNumber)
  },

  validateBatchNumber: (batchNumber: string): boolean => {
    return /^(WEAVING|COATING)-\d{8}-\d{3}$/.test(batchNumber)
  },

  validateShipmentNumber: (shipmentNumber: string): boolean => {
    return /^SH\d{6}$/.test(shipmentNumber)
  }
} 