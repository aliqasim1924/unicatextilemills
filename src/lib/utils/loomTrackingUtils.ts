import { supabase } from '@/lib/supabase/client'
import { numberingUtils } from './numberingUtils'

export interface LoomRollData {
  id: string
  rollNumber: string
  loomNumber: string
  rollLength: number
  qualityGrade: 'A' | 'B' | 'C'
  productionStartTime: string
  productionEndTime: string
  batchNumber: string
  productionOrderId: string
}

export interface EnhancedQRCodeData {
  type: 'loom_roll' | 'fabric_roll'
  rollNumber: string
  batchNumber: string
  
  // Loom traceability
  loomNumber?: string
  loomRollNumber?: string
  
  // Production details
  weavingStartDate?: string
  weavingEndDate?: string
  coatingStartDate?: string
  coatingEndDate?: string
  
  // Quality information
  qualityGrade: 'A' | 'B' | 'C'
  rollType: 'full_50m' | 'short' | 'wastage'
  rollLength: number
  
  // Fabric information
  fabricType: 'base_fabric' | 'finished_fabric'
  fabricId: string
  fabricName?: string
  
  // Production chain
  productionChain: Array<{
    stage: 'weaving' | 'coating'
    loomNumber?: string
    startDate: string
    endDate: string
    batchNumber: string
  }>
  
  // Download and reference
  qrId: string
  detailsUrl: string
  qrGeneratedAt: string
  
  // Customer information (if applicable)
  customerOrderId?: string
  customerOrderNumber?: string
  customerName?: string
  // Add productionPurpose
  productionPurpose?: 'stock_building' | 'customer_order'
}

export interface LoomProductionDetail {
  loomId: string
  loomNumber: string
  plannedQuantity: number
  actualQuantity: number
  rollsProduced: number
  rollDetails: Array<{
    rollLength: number
    qualityGrade: 'A' | 'B' | 'C'
    qualityNotes?: string
  }>
  productionStartTime: string
  productionEndTime: string
  qualityNotes?: string
  issuesEncountered?: string
}

export interface IndividualRollDetail {
  id: string
  rollNumber: string
  rollLength: number
  qualityNotes?: string
}

export interface ProductionCompletionData {
  productionOrderId: string
  productionType: 'weaving' | 'coating'
  plannedQuantity: number
  actualQuantity: number
  completionNotes?: string
  completedBy: string
  
  // Weaving specific
  loomDetails?: LoomProductionDetail[]
  incompleteReason?: string
  balanceStatus?: 'in_production' | 'cancelled' | 'completed'
  
  // Coating specific
  inputRolls?: Array<{
    loomRollId: string
    quantityUsed: number
    processingOrder: number
  }>
  aGrade50mRolls?: number
  aGradeShortRolls?: IndividualRollDetail[]
  aGradeShortQuantity?: number
  bcGradeRolls?: IndividualRollDetail[]
  bcGradeQuantity?: number
  wastageQuantity?: number
}

export const loomTrackingUtils = {
  // Generate QR code for loom roll (intermediate weaved roll)
  generateLoomRollQRData: (rollData: {
    rollNumber: string
    loomNumber: string
    rollLength: number
    qualityGrade: 'A' | 'B' | 'C'
    batchNumber: string
    productionOrderId: string
    productionStartTime: string
    productionEndTime: string
    fabricId: string
    fabricName?: string
    customerOrderId?: string
    customerOrderNumber?: string
    customerName?: string
  }): EnhancedQRCodeData => {
    const qrId = `loom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      type: 'loom_roll',
      rollNumber: rollData.rollNumber,
      batchNumber: rollData.batchNumber,
      
      // Loom traceability
      loomNumber: rollData.loomNumber,
      loomRollNumber: rollData.rollNumber,
      
      // Production details
      weavingStartDate: rollData.productionStartTime,
      weavingEndDate: rollData.productionEndTime,
      
      // Quality information
      qualityGrade: rollData.qualityGrade,
      rollType: 'full_50m', // Loom rolls are typically full rolls
      rollLength: rollData.rollLength,
      
      // Fabric information
      fabricType: 'base_fabric',
      fabricId: rollData.fabricId,
      fabricName: rollData.fabricName,
      
      // Production chain
      productionChain: [{
        stage: 'weaving',
        loomNumber: rollData.loomNumber,
        startDate: rollData.productionStartTime,
        endDate: rollData.productionEndTime,
        batchNumber: rollData.batchNumber
      }],
      
      // Download and reference
      qrId: qrId,
      detailsUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app'}/api/qr/download/${qrId}`,
      qrGeneratedAt: new Date().toISOString(),
      
      // Customer information
      customerOrderId: rollData.customerOrderId,
      customerOrderNumber: rollData.customerOrderNumber,
      customerName: rollData.customerName
    }
  },

  // Generate QR code for final fabric roll (with complete traceability)
  generateFinalRollQRData: (rollData: {
    rollNumber: string
    batchNumber: string
    rollLength: number
    qualityGrade: 'A' | 'B' | 'C'
    rollType: 'full_50m' | 'short' | 'wastage'
    fabricId: string
    fabricName?: string
    
    // Loom traceability
    loomNumber?: string
    loomRollNumber?: string
    
    // Production dates
    weavingStartDate?: string
    weavingEndDate?: string
    coatingStartDate?: string
    coatingEndDate?: string
    
    // Production chain
    productionChain: Array<{
      stage: 'weaving' | 'coating'
      loomNumber?: string
      startDate: string
      endDate: string
      batchNumber: string
    }>
    
    // Customer information
    customerOrderId?: string
    customerOrderNumber?: string
    customerName?: string
    // Add productionPurpose
    productionPurpose?: 'stock_building' | 'customer_order'
  }): EnhancedQRCodeData => {
    const qrId = `final-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      type: 'fabric_roll',
      rollNumber: rollData.rollNumber,
      batchNumber: rollData.batchNumber,
      
      // Loom traceability
      loomNumber: rollData.loomNumber,
      loomRollNumber: rollData.loomRollNumber,
      
      // Production details
      weavingStartDate: rollData.weavingStartDate,
      weavingEndDate: rollData.weavingEndDate,
      coatingStartDate: rollData.coatingStartDate,
      coatingEndDate: rollData.coatingEndDate,
      
      // Quality information
      qualityGrade: rollData.qualityGrade,
      rollType: rollData.rollType,
      rollLength: rollData.rollLength,
      
      // Fabric information
      fabricType: 'finished_fabric',
      fabricId: rollData.fabricId,
      fabricName: rollData.fabricName,
      
      // Production chain
      productionChain: rollData.productionChain,
      
      // Download and reference
      qrId: qrId,
      detailsUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app'}/api/qr/download/${qrId}`,
      qrGeneratedAt: new Date().toISOString(),
      
      // Customer information
      customerOrderId: rollData.customerOrderId,
      customerOrderNumber: rollData.customerOrderNumber,
      customerName: rollData.customerName,
      // Add productionPurpose
      productionPurpose: rollData.productionPurpose
    }
  },

  // Generate API-based QR code that stores only Roll ID
  generateApiQRData: (rollId: string): {
    type: 'api_roll'
    rollId: string
    apiUrl: string
    qrGeneratedAt: string
  } => {
    return {
      type: 'api_roll',
      rollId: rollId,
      apiUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app'}/api/rolls/${rollId}`,
      qrGeneratedAt: new Date().toISOString()
    }
  },

  // Get available rolls for coating (from linked weaving production)
  getAvailableRolls: async (productionOrderId: string): Promise<LoomRollData[]> => {
    try {
      // Get linked weaving production order
      const { data: linkedOrder, error: linkedError } = await supabase
        .from('production_orders')
        .select('linked_production_order_id')
        .eq('id', productionOrderId)
        .single()

      if (linkedError) {
        throw new Error(`Failed to get linked order: ${linkedError.message}`)
      }

      if (linkedOrder?.linked_production_order_id) {
        // Load loom rolls from linked weaving order
        return await loomTrackingUtils.getAvailableLoomRolls(linkedOrder.linked_production_order_id)
      } else {
        // Load all available base fabric rolls from the same fabric type
        const { data: finishedFabric, error: fabricError } = await supabase
          .from('finished_fabrics')
          .select('base_fabric_id')
          .eq('id', productionOrderId)
          .single()

        if (fabricError || !finishedFabric?.base_fabric_id) {
          throw new Error(`Failed to get finished fabric: ${fabricError?.message || 'No base fabric found'}`)
        }

        // Load available loom rolls for this base fabric
        const { data: loomRolls, error: rollsError } = await supabase
          .from('loom_rolls')
          .select(`
            *,
            loom_production_details!inner (
              production_start_time,
              production_end_time,
              looms (loom_number),
              production_orders!inner (
                base_fabric_id,
                production_batches (
                  batch_number
                )
              )
            )
          `)
          .eq('loom_production_details.production_orders.base_fabric_id', finishedFabric.base_fabric_id)
          .eq('roll_status', 'available')
          .order('created_at', { ascending: true })

        if (rollsError) {
          throw new Error(`Failed to get loom rolls: ${rollsError.message}`)
        }

        return loomRolls?.map(roll => ({
          id: roll.id,
          rollNumber: roll.roll_number,
          loomNumber: roll.loom_production_details?.looms?.loom_number || '',
          rollLength: roll.roll_length,
          qualityGrade: roll.quality_grade,
          productionStartTime: roll.loom_production_details?.production_start_time || '',
          productionEndTime: roll.loom_production_details?.production_end_time || '',
          batchNumber: roll.loom_production_details?.production_orders?.production_batches?.[0]?.batch_number || '',
          productionOrderId: roll.loom_production_details?.production_order_id || ''
        })) || []
      }
    } catch (error) {
      console.error('Error loading available rolls:', error)
      throw error
    }
  },

  // Complete weaving production with loom details
  completeWeavingProduction: async (completionData: ProductionCompletionData): Promise<{
    batchNumber: string
    loomRolls: Array<{
      id: string
      rollNumber: string
      loomNumber: string
      qrCode: string
    }>
  }> => {
    if (!completionData.loomDetails || completionData.loomDetails.length === 0) {
      throw new Error('Loom details are required for weaving production completion')
    }

    // Generate batch number
    const batchNumber = await numberingUtils.generateBatchNumber('weaving')
    
    // Create production batch
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .insert({
        batch_number: batchNumber,
        production_order_id: completionData.productionOrderId,
        production_type: 'weaving',
        planned_quantity: completionData.plannedQuantity,
        actual_a_grade_quantity: completionData.actualQuantity,
        batch_status: 'completed',
        completed_at: new Date().toISOString(),
        notes: completionData.completionNotes
      })
      .select()
      .single()

    if (batchError) {
      throw new Error(`Failed to create batch: ${batchError.message}`)
    }

    // Create production completion details
    await supabase
      .from('production_completion_details')
      .insert({
        production_order_id: completionData.productionOrderId,
        production_type: 'weaving',
        planned_quantity: completionData.plannedQuantity,
        actual_quantity: completionData.actualQuantity,
        total_looms_used: completionData.loomDetails.length,
        incomplete_reason: completionData.incompleteReason,
        balance_status: completionData.balanceStatus || 'completed',
        completion_notes: completionData.completionNotes,
        completed_by: completionData.completedBy
      })

    // Get production order details to get fabric_id
    const { data: productionOrder, error: orderError } = await supabase
      .from('production_orders')
      .select('base_fabric_id')
      .eq('id', completionData.productionOrderId)
      .single()

    if (orderError) {
      throw new Error(`Failed to get production order: ${orderError.message}`)
    }

    const fabricId = productionOrder?.base_fabric_id
    if (!fabricId) {
      throw new Error('No base fabric ID found in production order')
    }

    // Create loom production details and rolls
    const createdLoomRolls = []
    
    for (const loomDetail of completionData.loomDetails) {
      // Create loom production detail
      const { data: loomProductionDetail, error: loomError } = await supabase
        .from('loom_production_details')
        .insert({
          production_order_id: completionData.productionOrderId,
          loom_id: loomDetail.loomId,
          planned_quantity: loomDetail.plannedQuantity,
          actual_quantity: loomDetail.actualQuantity,
          rolls_produced: loomDetail.rollsProduced,
          production_start_time: loomDetail.productionStartTime,
          production_end_time: loomDetail.productionEndTime,
          quality_notes: loomDetail.qualityNotes,
          issues_encountered: loomDetail.issuesEncountered
        })
        .select()
        .single()

      if (loomError) {
        throw new Error(`Failed to create loom production detail: ${loomError.message}`)
      }

      // Create loom rolls
      for (let i = 0; i < loomDetail.rollDetails.length; i++) {
        const rollDetail = loomDetail.rollDetails[i]
        const rollIndex = i + 1
        const rollNumber = `${batchNumber}-${loomDetail.loomNumber}-R${rollIndex.toString().padStart(3, '0')}`
        
        // Insert loom roll first to get the roll ID
        const { data: loomRoll, error: rollError } = await supabase
          .from('loom_rolls')
          .insert({
            loom_production_detail_id: loomProductionDetail.id,
            roll_number: rollNumber,
            roll_length: rollDetail.rollLength,
            quality_grade: rollDetail.qualityGrade,
            quality_notes: rollDetail.qualityNotes,
            qr_code: '' // Temporary empty QR code
          })
          .select()
          .single()

        if (rollError) {
          throw new Error(`Failed to create loom roll: ${rollError.message}`)
        }

        // Generate API-based QR code with the roll ID
        const qrData = loomTrackingUtils.generateApiQRData(loomRoll.id)

        // Update the loom roll with the QR code
        await supabase
          .from('loom_rolls')
          .update({
            qr_code: JSON.stringify(qrData)
          })
          .eq('id', loomRoll.id)

        createdLoomRolls.push({
          id: loomRoll.id,
          rollNumber,
          loomNumber: loomDetail.loomNumber,
          qrCode: JSON.stringify(qrData)
        })
      }
    }

    return {
      batchNumber,
      loomRolls: createdLoomRolls
    }
  },

  // Complete coating production with roll selection and grading
  completeCoatingProduction: async (completionData: ProductionCompletionData): Promise<{
    batchNumber: string
    finalRolls: Array<{
      id: string
      rollNumber: string
      rollType: string
      qualityGrade: string
      qrCode: string
    }>
  }> => {
    if (!completionData.inputRolls || completionData.inputRolls.length === 0) {
      throw new Error('Input rolls are required for coating production completion')
    }

    // Generate batch number
    const batchNumber = await numberingUtils.generateBatchNumber('coating')
    
    // Create production batch
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .insert({
        batch_number: batchNumber,
        production_order_id: completionData.productionOrderId,
        production_type: 'coating',
        planned_quantity: completionData.plannedQuantity,
        actual_a_grade_quantity: completionData.actualQuantity,
        batch_status: 'completed',
        completed_at: new Date().toISOString(),
        notes: completionData.completionNotes
      })
      .select()
      .single()

    if (batchError) {
      throw new Error(`Failed to create batch: ${batchError.message}`)
    }

    // Create production completion details
    await supabase
      .from('production_completion_details')
      .insert({
        production_order_id: completionData.productionOrderId,
        production_type: 'coating',
        planned_quantity: completionData.plannedQuantity,
        actual_quantity: completionData.actualQuantity,
        a_grade_50m_rolls: completionData.aGrade50mRolls || 0,
        a_grade_short_rolls: completionData.aGradeShortRolls || 0,
        a_grade_short_quantity: completionData.aGradeShortQuantity || 0,
        bc_grade_rolls: completionData.bcGradeRolls || 0,
        bc_grade_quantity: completionData.bcGradeQuantity || 0,
        wastage_quantity: completionData.wastageQuantity || 0,
        completion_notes: completionData.completionNotes,
        completed_by: completionData.completedBy
      })

    // Record input rolls used
    for (const inputRoll of completionData.inputRolls) {
      await supabase
        .from('coating_roll_inputs')
        .insert({
          production_order_id: completionData.productionOrderId,
          loom_roll_id: inputRoll.loomRollId,
          quantity_used: inputRoll.quantityUsed,
          processing_order: inputRoll.processingOrder
        })
    }

    // Get production order details to get fabric_id
    const { data: productionOrder, error: orderError } = await supabase
      .from('production_orders')
      .select('finished_fabric_id, customer_order_id, customer_orders(color)')
      .eq('id', completionData.productionOrderId)
      .single()

    if (orderError) {
      throw new Error(`Failed to get production order: ${orderError.message}`)
    }

    const fabricId = productionOrder?.finished_fabric_id
    if (!fabricId) {
      throw new Error('No finished fabric ID found in production order')
    }

    // Create final fabric rolls
    const finalRolls = []
    
    // Get production chain information from input rolls
    const { data: inputRollsData } = await supabase
      .from('loom_rolls')
      .select(`
        *,
        loom_production_details!inner (
          loom_id,
          production_start_time,
          production_end_time,
          looms (loom_number)
        )
      `)
      .in('id', completionData.inputRolls.map(r => r.loomRollId))

    // Create A grade 50m rolls
    for (let i = 1; i <= (completionData.aGrade50mRolls || 0); i++) {
      const rollNumber = `${batchNumber}-R${i.toString().padStart(3, '0')}`
      
      // Insert roll first to get the roll ID
      const { data: finalRoll, error: rollError } = await supabase
        .from('fabric_rolls')
        .insert({
          roll_number: rollNumber,
          batch_id: batch.id,
          fabric_type: 'finished_fabric',
          fabric_id: fabricId,
          roll_length: 50,
          remaining_length: 50,
          quality_grade: 'A',
          roll_type: 'full_50m',
          qr_code: '' // Temporary empty QR code
        })
        .select()
        .single()

      if (rollError) {
        throw new Error(`Failed to create final roll: ${rollError.message}`)
      }

      // Generate API-based QR code with the roll ID
      const qrData = loomTrackingUtils.generateApiQRData(finalRoll.id)

      // Update the roll with the QR code
      await supabase
        .from('fabric_rolls')
        .update({
          qr_code: JSON.stringify(qrData)
        })
        .eq('id', finalRoll.id)

      finalRolls.push({
        id: finalRoll.id,
        rollNumber,
        rollType: 'full_50m',
        qualityGrade: 'A',
        qrCode: JSON.stringify(qrData)
      })
    }

    // Create A grade short rolls
    const aGradeShortRollsCount = Array.isArray(completionData.aGradeShortRolls) ? completionData.aGradeShortRolls.length : (completionData.aGradeShortRolls || 0)
    for (let i = 1; i <= aGradeShortRollsCount; i++) {
      const rollNumber = `${batchNumber}-S${i.toString().padStart(3, '0')}`
      const rollLength = (completionData.aGradeShortQuantity || 0) / aGradeShortRollsCount
      
      // Insert roll first to get the roll ID
      const { data: finalRoll, error: rollError } = await supabase
        .from('fabric_rolls')
        .insert({
          roll_number: rollNumber,
          batch_id: batch.id,
          fabric_type: 'finished_fabric',
          fabric_id: fabricId,
          roll_length: rollLength,
          remaining_length: rollLength,
          quality_grade: 'A',
          roll_type: 'short',
          qr_code: '' // Temporary empty QR code
        })
        .select()
        .single()

      if (rollError) {
        throw new Error(`Failed to create short roll: ${rollError.message}`)
      }

      // Generate API-based QR code with the roll ID
      const qrData = loomTrackingUtils.generateApiQRData(finalRoll.id)

      // Update the roll with the QR code
      await supabase
        .from('fabric_rolls')
        .update({
          qr_code: JSON.stringify(qrData)
        })
        .eq('id', finalRoll.id)

      finalRolls.push({
        id: finalRoll.id,
        rollNumber,
        rollType: 'short',
        qualityGrade: 'A',
        qrCode: JSON.stringify(qrData)
      })
    }

    // Create B/C grade rolls
    const bcGradeRollsCount = Array.isArray(completionData.bcGradeRolls) ? completionData.bcGradeRolls.length : (completionData.bcGradeRolls || 0)
    for (let i = 1; i <= bcGradeRollsCount; i++) {
      const rollNumber = `${batchNumber}-BC${i.toString().padStart(3, '0')}`
      const rollLength = (completionData.bcGradeQuantity || 0) / bcGradeRollsCount
      
      // Insert roll first to get the roll ID
      const { data: finalRoll, error: rollError } = await supabase
        .from('fabric_rolls')
        .insert({
          roll_number: rollNumber,
          batch_id: batch.id,
          fabric_type: 'finished_fabric',
          fabric_id: fabricId,
          roll_length: rollLength,
          remaining_length: rollLength,
          quality_grade: 'B',
          roll_type: rollLength >= 50 ? 'full_50m' : 'short',
          qr_code: '' // Temporary empty QR code
        })
        .select()
        .single()

      if (rollError) {
        throw new Error(`Failed to create B/C grade roll: ${rollError.message}`)
      }

      // Generate API-based QR code with the roll ID
      const qrData = loomTrackingUtils.generateApiQRData(finalRoll.id)

      // Update the roll with the QR code
      await supabase
        .from('fabric_rolls')
        .update({
          qr_code: JSON.stringify(qrData)
        })
        .eq('id', finalRoll.id)

      finalRolls.push({
        id: finalRoll.id,
        rollNumber,
        rollType: rollLength >= 50 ? 'full_50m' : 'short',
        qualityGrade: 'B',
        qrCode: JSON.stringify(qrData)
      })
    }

    // At the end of completeCoatingProduction
    // Fetch customer order ID if available
    const { data: prodOrderDetails } = await supabase
      .from('production_orders')
      .select('customer_order_id')
      .eq('id', completionData.productionOrderId)
      .single()
    if (prodOrderDetails?.customer_order_id) {
      await loomTrackingUtils.autoAllocateAGradeRollsToCustomerOrder(prodOrderDetails.customer_order_id)
    }

    // Update finished fabric stock quantity with total production
    const totalAGradeQuantity = (completionData.aGrade50mRolls || 0) * 50 + (completionData.aGradeShortQuantity || 0)
    const totalBGradeQuantity = completionData.bcGradeQuantity || 0
    const totalProducedQuantity = totalAGradeQuantity + totalBGradeQuantity

    if (totalProducedQuantity > 0) {
      // Get current stock quantity first
      const { data: currentFabric } = await supabase
        .from('finished_fabrics')
        .select('stock_quantity')
        .eq('id', fabricId)
        .single()
      
      const currentStock = currentFabric?.stock_quantity || 0
      
      // Get the color from the customer order to update the finished fabric
      const customerOrderColor = productionOrder.customer_orders?.[0]?.color || null
      
      await supabase
        .from('finished_fabrics')
        .update({
          stock_quantity: currentStock + totalProducedQuantity,
          color: customerOrderColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', fabricId)
    }

    return {
      batchNumber,
      finalRolls
    }
  },

  // Complete coating production with individual roll details
  completeCoatingProductionWithIndividualRolls: async (completionData: ProductionCompletionData): Promise<{
    batchNumber: string
    finalRolls: Array<{
      id: string
      rollNumber: string
      rollType: string
      qualityGrade: string
      qrCode: string
    }>
  }> => {
    if (!completionData.inputRolls || completionData.inputRolls.length === 0) {
      throw new Error('Input rolls are required for coating production completion')
    }

    // Generate batch number
    const batchNumber = await numberingUtils.generateBatchNumber('coating')
    
    // Create production batch
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .insert({
        batch_number: batchNumber,
        production_order_id: completionData.productionOrderId,
        production_type: 'coating',
        planned_quantity: completionData.plannedQuantity,
        actual_a_grade_quantity: completionData.actualQuantity,
        batch_status: 'completed',
        completed_at: new Date().toISOString(),
        notes: completionData.completionNotes
      })
      .select()
      .single()

    if (batchError) {
      throw new Error(`Failed to create batch: ${batchError.message}`)
    }

    // Calculate totals for completion details
    const aGradeShortQuantity = completionData.aGradeShortRolls?.reduce((total, roll) => total + roll.rollLength, 0) || 0
    const bcGradeQuantity = completionData.bcGradeRolls?.reduce((total, roll) => total + roll.rollLength, 0) || 0
    
    // Wastage is automatically calculated as total B/C grade quantity
    const wastageQuantity = bcGradeQuantity

    // Create production completion details
    await supabase
      .from('production_completion_details')
      .insert({
        production_order_id: completionData.productionOrderId,
        production_type: 'coating',
        planned_quantity: completionData.plannedQuantity,
        actual_quantity: completionData.actualQuantity,
        a_grade_50m_rolls: completionData.aGrade50mRolls || 0,
        a_grade_short_rolls: completionData.aGradeShortRolls?.length || 0,
        a_grade_short_quantity: aGradeShortQuantity,
        bc_grade_rolls: completionData.bcGradeRolls?.length || 0,
        bc_grade_quantity: bcGradeQuantity,
        wastage_quantity: wastageQuantity,
        completion_notes: completionData.completionNotes,
        completed_by: completionData.completedBy
      })

    // Record input rolls used
    for (const inputRoll of completionData.inputRolls) {
      await supabase
        .from('coating_roll_inputs')
        .insert({
          production_order_id: completionData.productionOrderId,
          loom_roll_id: inputRoll.loomRollId,
          quantity_used: inputRoll.quantityUsed,
          processing_order: inputRoll.processingOrder
        })
    }

    // Get production order details to get fabric_id and customer order context
    const { data: productionOrder, error: orderError } = await supabase
      .from('production_orders')
      .select('finished_fabric_id, customer_order_id, customer_orders(internal_order_number, color, customers(name))')
      .eq('id', completionData.productionOrderId)
      .single()

    if (orderError) {
      throw new Error(`Failed to get production order: ${orderError.message}`)
    }

    const fabricId = productionOrder?.finished_fabric_id
    if (!fabricId) {
      throw new Error('No finished fabric ID found in production order')
    }

    // Fetch customer order context if available
    let customerOrderId = null
    let customerOrderNumber = null
    let customerName = null
    if (productionOrder.customer_order_id && Array.isArray(productionOrder.customer_orders) && productionOrder.customer_orders.length > 0) {
      customerOrderId = productionOrder.customer_order_id;
      customerOrderNumber = productionOrder.customer_orders[0]?.internal_order_number || null;
      const customersArr = productionOrder.customer_orders[0]?.customers;
      customerName = Array.isArray(customersArr) && customersArr.length > 0 ? customersArr[0].name : null;
    }

    // Create final fabric rolls
    const finalRolls = []
    
    // Get production chain information from input rolls
    const { data: inputRollsData } = await supabase
      .from('loom_rolls')
      .select(`
        *,
        loom_production_details!inner (
          loom_id,
          production_start_time,
          production_end_time,
          looms (loom_number)
        )
      `)
      .in('id', completionData.inputRolls.map(r => r.loomRollId))

    // Create A grade 50m rolls
    for (let i = 1; i <= (completionData.aGrade50mRolls || 0); i++) {
      const rollNumber = `${batchNumber}-A50-R${i.toString().padStart(3, '0')}`
      
      // Build production chain from input rolls
      const productionChain: Array<{
        stage: 'weaving' | 'coating'
        loomNumber?: string
        startDate: string
        endDate: string
        batchNumber: string
      }> = inputRollsData?.map(inputRoll => ({
        stage: 'weaving' as const,
        loomNumber: inputRoll.loom_production_details?.looms?.loom_number,
        startDate: inputRoll.loom_production_details?.production_start_time,
        endDate: inputRoll.loom_production_details?.production_end_time,
        batchNumber: batchNumber
      })) || []

      // Add coating stage
      productionChain.push({
        stage: 'coating' as const,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        batchNumber: batchNumber
      })

      // Fetch customer order context if available
      // let customerOrderId = null
      // let customerOrderNumber = null
      // let customerName = null
      // if (completionData.customerOrderId || completionData.customerOrderNumber || completionData.customerName) {
      //   customerOrderId = completionData.customerOrderId
      //   customerOrderNumber = completionData.customerOrderNumber
      //   customerName = completionData.customerName
      // }

      const qrData = loomTrackingUtils.generateFinalRollQRData({
        rollNumber,
        batchNumber,
        rollLength: 50,
        qualityGrade: 'A',
        rollType: 'full_50m',
        fabricId: fabricId,
        productionChain,
        customerOrderId,
        customerOrderNumber,
        customerName,
        productionPurpose: customerOrderId ? 'customer_order' : 'stock_building'
      })

      const { data: finalRoll, error: rollError } = await supabase
        .from('fabric_rolls')
        .insert({
          roll_number: rollNumber,
          batch_id: batch.id,
          fabric_type: 'finished_fabric',
          fabric_id: fabricId,
          roll_length: 50,
          remaining_length: 50,
          quality_grade: 'A',
          roll_type: 'full_50m',
          qr_code: JSON.stringify(qrData)
        })
        .select()
        .single()

      if (rollError) {
        throw new Error(`Failed to create final roll: ${rollError.message}`)
      }

      finalRolls.push({
        id: finalRoll.id,
        rollNumber,
        rollType: 'full_50m',
        qualityGrade: 'A',
        qrCode: JSON.stringify(qrData)
      })
    }

    // Create individual A grade short rolls
    if (completionData.aGradeShortRolls && completionData.aGradeShortRolls.length > 0) {
      for (let i = 0; i < completionData.aGradeShortRolls.length; i++) {
        const rollDetail = completionData.aGradeShortRolls[i]
        const rollNumber = rollDetail.rollNumber || `${batchNumber}-AS-R${(i + 1).toString().padStart(3, '0')}`
        
        // Build production chain from input rolls
        const productionChain: Array<{
          stage: 'weaving' | 'coating'
          loomNumber?: string
          startDate: string
          endDate: string
          batchNumber: string
        }> = inputRollsData?.map(inputRoll => ({
          stage: 'weaving' as const,
          loomNumber: inputRoll.loom_production_details?.looms?.loom_number,
          startDate: inputRoll.loom_production_details?.production_start_time,
          endDate: inputRoll.loom_production_details?.production_end_time,
          batchNumber: batchNumber
        })) || []

        productionChain.push({
          stage: 'coating' as const,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          batchNumber: batchNumber
        })

        const qrData = loomTrackingUtils.generateFinalRollQRData({
          rollNumber,
          batchNumber,
          rollLength: rollDetail.rollLength,
          qualityGrade: 'A',
          rollType: 'short',
          fabricId: fabricId,
          productionChain,
          customerOrderId,
          customerOrderNumber,
          customerName,
          productionPurpose: customerOrderId ? 'customer_order' : 'stock_building'
        })

        const { data: finalRoll, error: rollError } = await supabase
          .from('fabric_rolls')
          .insert({
            roll_number: rollNumber,
            batch_id: batch.id,
            fabric_type: 'finished_fabric',
            fabric_id: fabricId,
            roll_length: rollDetail.rollLength,
            remaining_length: rollDetail.rollLength,
            quality_grade: 'A',
            roll_type: 'short',
            qr_code: JSON.stringify(qrData)
          })
          .select()
          .single()

        if (rollError) {
          throw new Error(`Failed to create A grade short roll: ${rollError.message}`)
        }

        finalRolls.push({
          id: finalRoll.id,
          rollNumber,
          rollType: 'short',
          qualityGrade: 'A',
          qrCode: JSON.stringify(qrData)
        })
      }
    }

    // Create individual B/C grade rolls
    if (completionData.bcGradeRolls && completionData.bcGradeRolls.length > 0) {
      for (let i = 0; i < completionData.bcGradeRolls.length; i++) {
        const rollDetail = completionData.bcGradeRolls[i]
        const rollNumber = rollDetail.rollNumber || `${batchNumber}-BC-R${(i + 1).toString().padStart(3, '0')}`
        
        // Build production chain from input rolls
        const productionChain: Array<{
          stage: 'weaving' | 'coating'
          loomNumber?: string
          startDate: string
          endDate: string
          batchNumber: string
        }> = inputRollsData?.map(inputRoll => ({
          stage: 'weaving' as const,
          loomNumber: inputRoll.loom_production_details?.looms?.loom_number,
          startDate: inputRoll.loom_production_details?.production_start_time,
          endDate: inputRoll.loom_production_details?.production_end_time,
          batchNumber: batchNumber
        })) || []

        productionChain.push({
          stage: 'coating' as const,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          batchNumber: batchNumber
        })

        const qrData = loomTrackingUtils.generateFinalRollQRData({
          rollNumber,
          batchNumber,
          rollLength: rollDetail.rollLength,
          qualityGrade: 'B',
          rollType: rollDetail.rollLength >= 50 ? 'full_50m' : 'short',
          fabricId: fabricId,
          productionChain,
          customerOrderId,
          customerOrderNumber,
          customerName,
          productionPurpose: customerOrderId ? 'customer_order' : 'stock_building'
        })

        const { data: finalRoll, error: rollError } = await supabase
          .from('fabric_rolls')
          .insert({
            roll_number: rollNumber,
            batch_id: batch.id,
            fabric_type: 'finished_fabric',
            fabric_id: fabricId,
            roll_length: rollDetail.rollLength,
            remaining_length: rollDetail.rollLength,
            quality_grade: 'B',
            roll_type: rollDetail.rollLength >= 50 ? 'full_50m' : 'short',
            qr_code: JSON.stringify(qrData)
          })
          .select()
          .single()

        if (rollError) {
          throw new Error(`Failed to create B/C grade roll: ${rollError.message}`)
        }

        finalRolls.push({
          id: finalRoll.id,
          rollNumber,
          rollType: rollDetail.rollLength >= 50 ? 'full_50m' : 'short',
          qualityGrade: 'B',
          qrCode: JSON.stringify(qrData)
        })
      }
    }

    // At the end of completeCoatingProductionWithIndividualRolls
    // Auto-allocate A grade rolls to customer order if present
    if (customerOrderId) {
      await loomTrackingUtils.autoAllocateAGradeRollsToCustomerOrder(customerOrderId)
    }

    // Update finished fabric stock quantity with total production
    const totalAGradeQuantity = (completionData.aGrade50mRolls || 0) * 50 + aGradeShortQuantity
    const totalBGradeQuantity = bcGradeQuantity
    const totalProducedQuantity = totalAGradeQuantity + totalBGradeQuantity

    if (totalProducedQuantity > 0) {
      // Get current stock quantity first
      const { data: currentFabric } = await supabase
        .from('finished_fabrics')
        .select('stock_quantity')
        .eq('id', fabricId)
        .single()
      
      const currentStock = currentFabric?.stock_quantity || 0
      
      // Get the color from the customer order to update the finished fabric
      const customerOrderColor = productionOrder.customer_orders?.[0]?.color || null
      
      await supabase
        .from('finished_fabrics')
        .update({
          stock_quantity: currentStock + totalProducedQuantity,
          color: customerOrderColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', fabricId)
    }

    return {
      batchNumber,
      finalRolls
    }
  },

  // Get available loom rolls for coating
  getAvailableLoomRolls: async (productionOrderId: string): Promise<LoomRollData[]> => {
    const { data, error } = await supabase
      .from('loom_rolls')
      .select(`
        *,
        loom_production_details!inner (
          production_order_id,
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
      `)
      .eq('loom_production_details.production_order_id', productionOrderId)
      .eq('roll_status', 'available')
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to get available loom rolls: ${error.message}`)
    }

    return data?.map(roll => ({
      id: roll.id,
      rollNumber: roll.roll_number,
      loomNumber: roll.loom_production_details?.looms?.loom_number || '',
      rollLength: roll.roll_length,
      qualityGrade: roll.quality_grade,
      productionStartTime: roll.loom_production_details?.production_start_time || '',
      productionEndTime: roll.loom_production_details?.production_end_time || '',
      batchNumber: roll.loom_production_details?.production_orders?.production_batches?.[0]?.batch_number || '',
      productionOrderId: roll.loom_production_details?.production_order_id || ''
    })) || []
  },

  // Get production traceability for a fabric roll
  getProductionTraceability: async (fabricRollId: string): Promise<EnhancedQRCodeData | null> => {
    const { data, error } = await supabase
      .rpc('get_production_traceability', { p_fabric_roll_id: fabricRollId })

    if (error) {
      throw new Error(`Failed to get production traceability: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return null
    }

    const traceData = data[0]
    
    // Parse existing QR code data and enhance it
    const { data: rollData } = await supabase
      .from('fabric_rolls')
      .select('qr_code')
      .eq('id', fabricRollId)
      .single()

    if (rollData?.qr_code) {
      try {
        const existingQrData = JSON.parse(rollData.qr_code)
        return {
          ...existingQrData,
          loomNumber: traceData.loom_number,
          loomRollNumber: traceData.loom_roll_number,
          weavingStartDate: traceData.weaving_start_date,
          weavingEndDate: traceData.weaving_end_date,
          coatingStartDate: traceData.coating_start_date,
          coatingEndDate: traceData.coating_end_date,
          qualityGrade: traceData.quality_grade,
          rollType: traceData.roll_type
        }
      } catch (e) {
        console.error('Failed to parse existing QR code data:', e)
      }
    }

    return null
  },

  /**
   * Allocates selected loom rolls for a coating production order.
   * Updates roll_status, links to coating order, reduces base fabric stock, and logs stock movement.
   * @param coatingProductionOrderId - The coating production order ID
   * @param selectedRolls - Array of { rollId: string, quantityUsed: number }
   * @param user - User performing the allocation (for audit)
   */
  allocateBaseFabricRollsForCoating: async (
    coatingProductionOrderId: string,
    selectedRolls: Array<{ rollId: string; quantityUsed: number }>,
    user: string = 'System'
  ) => {
    let totalAllocated = 0
    let baseFabricId: string | null = null

    for (let i = 0; i < selectedRolls.length; i++) {
      const { rollId, quantityUsed } = selectedRolls[i]

      // Update loom roll status and link to coating order
      await supabase
        .from('loom_rolls')
        .update({
          roll_status: 'allocated_for_coating',
          coating_production_order_id: coatingProductionOrderId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rollId)

      // Insert record into coating_roll_inputs table
      const { error: insertError } = await supabase
        .from('coating_roll_inputs')
        .insert({
          production_order_id: coatingProductionOrderId,
          loom_roll_id: rollId,
          quantity_used: quantityUsed,
          processing_order: i + 1,
          created_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Failed to insert coating roll input:', insertError)
        throw new Error(`Failed to record coating roll allocation: ${insertError.message}`)
      }

      // Get base fabric ID from the loom roll if not already set
      if (!baseFabricId) {
        const { data: rollData } = await supabase
          .from('loom_rolls')
          .select(`
            loom_production_details!inner (
              production_order_id
            )
          `)
          .eq('id', rollId)
          .single()

        const loomProductionDetail = Array.isArray(rollData?.loom_production_details)
          ? rollData.loom_production_details[0]
          : rollData?.loom_production_details

        if (loomProductionDetail?.production_order_id) {
          const { data: productionOrder } = await supabase
            .from('production_orders')
            .select('base_fabric_id')
            .eq('id', loomProductionDetail.production_order_id)
            .single()

          baseFabricId = productionOrder?.base_fabric_id || null
        }
      }

      totalAllocated += quantityUsed

      // Log stock movement for this specific roll
      await supabase
        .from('stock_movements')
        .insert({
          fabric_type: 'base_fabric',
          fabric_id: baseFabricId,
          movement_type: 'production_allocation',
          quantity: -quantityUsed,
          reference_id: coatingProductionOrderId,
          reference_type: 'production_order',
          notes: `Loom roll allocated for coating production (Roll ID: ${rollId})`,
          created_at: new Date().toISOString(),
        })
    }

    // Update base fabric stock quantity based on total allocated amount
    if (baseFabricId && totalAllocated > 0) {
      const { data: currentStock } = await supabase
        .from('base_fabrics')
        .select('stock_quantity, name')
        .eq('id', baseFabricId)
        .single()

      if (currentStock) {
        const newStock = Math.max(0, (currentStock.stock_quantity || 0) - totalAllocated)
        
        await supabase
          .from('base_fabrics')
          .update({
            stock_quantity: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', baseFabricId)

        console.log(`Base fabric stock reduced: ${currentStock.name} from ${currentStock.stock_quantity}m to ${newStock}m (${totalAllocated}m allocated for coating)`)
      }
    }
  },

  /**
   * Auto-allocate available A grade rolls to a customer order after production completion.
   * Allocates up to the required quantity. Does not allocate B grade rolls.
   * Logs allocation events.
   * @param customerOrderId - The customer order ID
   */
  autoAllocateAGradeRollsToCustomerOrder: async (customerOrderId: string) => {
    // Fetch the customer order
    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .select('id, quantity_ordered, quantity_allocated, finished_fabric_id')
      .eq('id', customerOrderId)
      .single()
    if (orderError || !order) throw orderError || new Error('Order not found')

    const required = order.quantity_ordered - (order.quantity_allocated || 0)
    if (required <= 0) return // Nothing to allocate

    // Fetch available A grade rolls for this finished fabric
    const { data: rolls, error: rollsError } = await supabase
      .from('fabric_rolls')
      .select('id, roll_length, remaining_length, quality_grade, roll_status')
      .eq('fabric_type', 'finished_fabric')
      .eq('fabric_id', order.finished_fabric_id)
      .eq('quality_grade', 'A')
      .eq('roll_status', 'available')
      .order('created_at', { ascending: true })
    if (rollsError) throw rollsError

    let toAllocate = required
    let totalAllocated = 0
    
    for (const roll of rolls) {
      if (toAllocate <= 0) break
      const allocQty = Math.min(roll.remaining_length, toAllocate)
      // Mark roll as allocated (or partially allocated if needed)
      await supabase
        .from('fabric_rolls')
        .update({
          roll_status: allocQty === roll.remaining_length ? 'allocated' : 'partially_allocated',
          remaining_length: roll.remaining_length - allocQty,
          customer_order_id: customerOrderId
        })
        .eq('id', roll.id)
      // Update order allocation
      await supabase
        .from('customer_orders')
        .update({
          quantity_allocated: (order.quantity_allocated || 0) + allocQty
        })
        .eq('id', customerOrderId)
      // Log allocation event
      await supabase
        .from('stock_movements')
        .insert({
          fabric_type: 'finished_fabric',
          fabric_id: order.finished_fabric_id,
          movement_type: 'allocation',
          quantity: -allocQty,
          reference_id: customerOrderId,
          reference_type: 'customer_order',
          notes: `Auto-allocated A grade roll to customer order`,
          created_at: new Date().toISOString()
        })
      toAllocate -= allocQty
      totalAllocated += allocQty
    }

    // Update finished fabric stock quantity to reflect the allocation
    if (totalAllocated > 0) {
      const { data: currentFabric } = await supabase
        .from('finished_fabrics')
        .select('stock_quantity')
        .eq('id', order.finished_fabric_id)
        .single()
      
      if (currentFabric) {
        const newStock = Math.max(0, currentFabric.stock_quantity - totalAllocated)
        await supabase
          .from('finished_fabrics')
          .update({
            stock_quantity: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.finished_fabric_id)
      }
    }
  }
} 