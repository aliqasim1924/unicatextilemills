import { supabase } from '@/lib/supabase/client'

export interface BatchData {
  id: string
  batchNumber: string
  productionOrderId: string
  productionType: 'weaving' | 'coating'
  plannedQuantity: number
  actualAGradeQuantity?: number
  wastageQuantity?: number
  wastagePercentage?: number
  batchStatus: 'in_progress' | 'completed' | 'quality_check' | 'approved'
  createdAt: string
  completedAt?: string
  notes?: string
}

export interface RollData {
  id: string
  rollNumber: string
  batchId: string
  fabricType: 'base_fabric' | 'finished_fabric'
  fabricId: string
  rollLength: number
  remainingLength: number
  qrCode?: string
  rollStatus: 'available' | 'allocated' | 'used' | 'damaged'
  createdAt: string
}

export interface WastageRecord {
  id: string
  batchId: string
  wastageType: 'production' | 'cutting' | 'quality' | 'handling'
  wastageReason?: string
  wastageQuantity: number
  recordedBy: string
  recordedAt: string
  notes?: string
}

export const batchUtils = {
  // Generate batch number using database function
  generateBatchNumber: async (productionType: 'weaving' | 'coating'): Promise<string> => {
    try {
      const { data, error } = await supabase
        .rpc('generate_batch_number', { p_production_type: productionType })
      
      if (error) {
        throw new Error(`Failed to generate batch number: ${error.message}`)
      }
      
      return data
    } catch (error) {
      console.error('Error generating batch number:', error)
      throw error
    }
  },

  // Create new batch record
  createBatch: async (batchData: {
    productionOrderId: string
    productionType: 'weaving' | 'coating'
    plannedQuantity: number
    actualAGradeQuantity?: number
    notes?: string
  }): Promise<BatchData> => {
    try {
      // Generate batch number
      const batchNumber = await batchUtils.generateBatchNumber(batchData.productionType)
      
      const { data, error } = await supabase
        .from('production_batches')
        .insert({
          batch_number: batchNumber,
          production_order_id: batchData.productionOrderId,
          production_type: batchData.productionType,
          planned_quantity: batchData.plannedQuantity,
          actual_a_grade_quantity: batchData.actualAGradeQuantity,
          batch_status: batchData.actualAGradeQuantity ? 'completed' : 'in_progress',
          notes: batchData.notes
        })
        .select()
        .single()
      
      if (error) {
        throw new Error(`Failed to create batch: ${error.message}`)
      }
      
      return {
        id: data.id,
        batchNumber: data.batch_number,
        productionOrderId: data.production_order_id,
        productionType: data.production_type,
        plannedQuantity: data.planned_quantity,
        actualAGradeQuantity: data.actual_a_grade_quantity,
        wastageQuantity: data.wastage_quantity,
        wastagePercentage: data.wastage_percentage,
        batchStatus: data.batch_status,
        createdAt: data.created_at,
        completedAt: data.completed_at,
        notes: data.notes
      }
    } catch (error) {
      console.error('Error creating batch:', error)
      throw error
    }
  },

  // Generate QR code data for roll
  generateQRCodeData: (rollData: {
    rollNumber: string
    batchId: string
    fabricType: 'base_fabric' | 'finished_fabric'
    fabricId: string
    rollLength: number
  }) => {
    // Generate unique ID for this QR code (for download URL)
    const qrId = `qr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      type: 'fabric_roll',
      rollNumber: rollData.rollNumber,
      batchId: rollData.batchId,
      fabricType: rollData.fabricType,
      fabricId: rollData.fabricId,
      rollLength: rollData.rollLength,
      qrGeneratedAt: new Date().toISOString(),
      
      // Download URL for PDF/text file generation
      detailsUrl: `${process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/qr/download/${qrId}`,
      
      additionalData: {
        qrId: qrId
      }
    }
  },

  // Create fabric rolls for a batch
  createRolls: async (
    batchId: string,
    fabricType: 'base_fabric' | 'finished_fabric',
    fabricId: string,
    totalQuantity: number,
    rollLength: number = 50
  ): Promise<RollData[]> => {
    try {
      // Get batch info for roll numbering
      const { data: batch, error: batchError } = await supabase
        .from('production_batches')
        .select('batch_number')
        .eq('id', batchId)
        .single()
      
      if (batchError || !batch) {
        throw new Error('Batch not found')
      }
      
      // Calculate number of rolls needed
      const rollCount = Math.ceil(totalQuantity / rollLength)
      const rolls = []
      
      // Create roll records
      for (let i = 1; i <= rollCount; i++) {
        const rollNumber = `${batch.batch_number}-R${i.toString().padStart(3, '0')}`
        const actualLength = i === rollCount ? totalQuantity % rollLength || rollLength : rollLength
        
        // Generate QR code data
        const qrData = batchUtils.generateQRCodeData({
          rollNumber,
          batchId,
          fabricType,
          fabricId,
          rollLength: actualLength
        })
        
        rolls.push({
          roll_number: rollNumber,
          batch_id: batchId,
          fabric_type: fabricType,
          fabric_id: fabricId,
          roll_length: actualLength,
          remaining_length: actualLength,
          qr_code: JSON.stringify(qrData),
          roll_status: 'available'
        })
      }
      
      // Insert rolls into database
      const { data, error } = await supabase
        .from('fabric_rolls')
        .insert(rolls)
        .select()
      
      if (error) {
        throw new Error(`Failed to create rolls: ${error.message}`)
      }
      
      // Convert to RollData format
      return data.map(roll => ({
        id: roll.id,
        rollNumber: roll.roll_number,
        batchId: roll.batch_id,
        fabricType: roll.fabric_type,
        fabricId: roll.fabric_id,
        rollLength: roll.roll_length,
        remainingLength: roll.remaining_length,
        qrCode: roll.qr_code,
        rollStatus: roll.roll_status,
        createdAt: roll.created_at
      }))
    } catch (error) {
      console.error('Error creating rolls:', error)
      throw error
    }
  },

  // Calculate wastage from planned vs actual quantities
  calculateWastage: (plannedQuantity: number, actualAGradeQuantity: number) => {
    const wastageQuantity = Math.max(0, plannedQuantity - actualAGradeQuantity)
    const wastagePercentage = plannedQuantity > 0 ? (wastageQuantity / plannedQuantity) * 100 : 0
    
    return {
      wastageQuantity: Math.round(wastageQuantity * 100) / 100, // Round to 2 decimal places
      wastagePercentage: Math.round(wastagePercentage * 100) / 100
    }
  },

  // Record wastage for a batch
  recordWastage: async (
    batchId: string,
    wastageQuantity: number,
    wastageType: 'production' | 'cutting' | 'quality' | 'handling',
    wastageReason?: string,
    recordedBy: string = 'system',
    notes?: string
  ): Promise<WastageRecord> => {
    try {
      const { data, error } = await supabase
        .from('wastage_records')
        .insert({
          batch_id: batchId,
          wastage_type: wastageType,
          wastage_reason: wastageReason,
          wastage_quantity: wastageQuantity,
          recorded_by: recordedBy,
          notes: notes
        })
        .select()
        .single()
      
      if (error) {
        throw new Error(`Failed to record wastage: ${error.message}`)
      }
      
      return {
        id: data.id,
        batchId: data.batch_id,
        wastageType: data.wastage_type,
        wastageReason: data.wastage_reason,
        wastageQuantity: data.wastage_quantity,
        recordedBy: data.recorded_by,
        recordedAt: data.recorded_at,
        notes: data.notes
      }
    } catch (error) {
      console.error('Error recording wastage:', error)
      throw error
    }
  },

  // Complete batch with final quantities
  completeBatch: async (
    batchId: string,
    actualAGradeQuantity: number,
    wastageReasons?: Array<{
      type: 'production' | 'cutting' | 'quality' | 'handling'
      reason: string
      quantity: number
    }>
  ): Promise<BatchData> => {
    try {
      // Get current batch data
      const { data: batch, error: batchError } = await supabase
        .from('production_batches')
        .select('*')
        .eq('id', batchId)
        .single()
      
      if (batchError || !batch) {
        throw new Error('Batch not found')
      }
      
      // Calculate wastage
      const { wastageQuantity, wastagePercentage } = batchUtils.calculateWastage(
        batch.planned_quantity,
        actualAGradeQuantity
      )
      
      // Update batch with completion data
      const { data: updatedBatch, error: updateError } = await supabase
        .from('production_batches')
        .update({
          actual_a_grade_quantity: actualAGradeQuantity,
          wastage_quantity: wastageQuantity,
          wastage_percentage: wastagePercentage,
          batch_status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', batchId)
        .select()
        .single()
      
      if (updateError) {
        throw new Error(`Failed to update batch: ${updateError.message}`)
      }
      
      // Record detailed wastage reasons if provided
      if (wastageReasons && wastageReasons.length > 0) {
        for (const reason of wastageReasons) {
          await batchUtils.recordWastage(
            batchId,
            reason.quantity,
            reason.type,
            reason.reason,
            'production_team'
          )
        }
      }
      
      return {
        id: updatedBatch.id,
        batchNumber: updatedBatch.batch_number,
        productionOrderId: updatedBatch.production_order_id,
        productionType: updatedBatch.production_type,
        plannedQuantity: updatedBatch.planned_quantity,
        actualAGradeQuantity: updatedBatch.actual_a_grade_quantity,
        wastageQuantity: updatedBatch.wastage_quantity,
        wastagePercentage: updatedBatch.wastage_percentage,
        batchStatus: updatedBatch.batch_status,
        createdAt: updatedBatch.created_at,
        completedAt: updatedBatch.completed_at,
        notes: updatedBatch.notes
      }
    } catch (error) {
      console.error('Error completing batch:', error)
      throw error
    }
  },

  // Get batch with related data
  getBatchDetails: async (batchId: string) => {
    try {
      const { data, error } = await supabase
        .from('production_batches')
        .select(`
          *,
          production_orders (
            id,
            quantity_required,
            production_type,
            base_fabrics (name),
            finished_fabrics (name)
          ),
          fabric_rolls (
            id,
            roll_number,
            roll_length,
            remaining_length,
            roll_status
          ),
          wastage_records (
            id,
            wastage_type,
            wastage_reason,
            wastage_quantity,
            recorded_at
          )
        `)
        .eq('id', batchId)
        .single()
      
      if (error) {
        throw new Error(`Failed to get batch details: ${error.message}`)
      }
      
      return data
    } catch (error) {
      console.error('Error getting batch details:', error)
      throw error
    }
  }
}

export default batchUtils 