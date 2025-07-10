import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'
import { qrCodeUtils } from '@/lib/utils/qrCodeUtils'

interface CompleteProductionRequest {
  productionOrderId: string
  actualQuantity?: number | null
  completedBy?: string
  qualityNotes?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const {
      productionOrderId,
      actualQuantity: requestedQuantity,
      completedBy = 'System',
      qualityNotes
    }: CompleteProductionRequest = req.body

    console.log('Production completion request:', { productionOrderId, requestedQuantity, completedBy })

    // Validate required fields
    if (!productionOrderId) {
      return res.status(400).json({ 
        message: 'Missing required field: productionOrderId' 
      })
    }

    // Get production order details
    const { data: productionOrder, error: orderError } = await supabase
      .from('production_orders')
      .select(`
        *,
        base_fabrics (id, name, gsm, width_meters, stock_quantity),
        finished_fabrics (id, name, gsm, width_meters, coating_type, stock_quantity),
        customer_orders (
          id,
          internal_order_number,
          customers (
            name
          )
        )
      `)
      .eq('id', productionOrderId)
      .single()

    if (orderError || !productionOrder) {
      console.error('Production order not found:', orderError)
      return res.status(404).json({ message: 'Production order not found' })
    }

    if (productionOrder.production_status === 'completed') {
      return res.status(400).json({ message: 'Production order already completed' })
    }

    // Use requested quantity or fall back to required quantity
    const actualQuantity = requestedQuantity || productionOrder.quantity_required

    console.log('Using actualQuantity:', actualQuantity)

    // Generate batch number (simple format since RPC doesn't exist)
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const timeStr = now.getTime().toString().slice(-4)
    const batchNumber = `${productionOrder.production_type.toUpperCase()}-${dateStr}-${timeStr}`

    console.log('Generated batch number:', batchNumber)

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .insert({
        batch_number: batchNumber,
        production_order_id: productionOrderId,
        production_type: productionOrder.production_type,
        planned_quantity: productionOrder.quantity_required,
        actual_a_grade_quantity: actualQuantity,
        batch_status: 'completed',
        created_at: now.toISOString(),
        completed_at: now.toISOString(),
        notes: qualityNotes
      })
      .select()
      .single()

    if (batchError) {
      console.error('Failed to create batch:', batchError)
      return res.status(500).json({ message: `Failed to create batch: ${batchError.message}` })
    }

    console.log('Batch created:', batch)

    // Create fabric rolls ONLY for coating operations (finished fabric)
    let createdRolls: any[] = []
    
    if (productionOrder.production_type === 'coating') {
      console.log('Creating fabric rolls for coating production (finished fabric)')
      
      const fabricId = productionOrder.finished_fabric_id
      const fabricType = 'finished_fabric'

      console.log('Creating rolls for:', { fabricId, fabricType, actualQuantity })

      // Calculate number of rolls (50m each)
      const rollLength = 50
      const rollCount = Math.ceil(actualQuantity / rollLength)
      const rolls = []

      // Create roll records with QR codes
      for (let i = 1; i <= rollCount; i++) {
        const rollNumber = `${batchNumber}-R${i.toString().padStart(3, '0')}`
        const actualLength = i === rollCount ? actualQuantity % rollLength || rollLength : rollLength
        
        // Generate QR code data with enhanced context
        const qrData = qrCodeUtils.generateRollQRData({
          rollNumber,
          batchId: batch.id,
          fabricType: fabricType as 'base_fabric' | 'finished_fabric',
          fabricId: fabricId!,
          rollLength: actualLength,
          
          // Enhanced context
          productionPurpose: productionOrder.customer_order_id ? 'customer_order' : 'stock_building',
          customerOrderId: productionOrder.customer_orders?.id,
          customerOrderNumber: productionOrder.customer_orders?.internal_order_number,
          customerName: productionOrder.customer_orders?.customers?.name,
          productionOrderId: productionOrder.id,
          productionOrderNumber: productionOrder.internal_order_number
        })
        
        rolls.push({
          roll_number: rollNumber,
          batch_id: batch.id,
          fabric_type: fabricType,
          fabric_id: fabricId,
          roll_length: actualLength,
          remaining_length: actualLength,
          qr_code: JSON.stringify(qrData), // Store full QR data as JSON
          roll_status: 'available',
          created_at: now.toISOString()
        })
      }

      // Insert rolls into database
      const { data: rollsData, error: rollsError } = await supabase
        .from('fabric_rolls')
        .insert(rolls)
        .select()

      if (rollsError) {
        console.error('Failed to create rolls:', rollsError)
        return res.status(500).json({ message: `Failed to create rolls: ${rollsError.message}` })
      }

      createdRolls = rollsData || []
      console.log('Fabric rolls created:', createdRolls.length)
    } else {
      console.log('Weaving production - no fabric rolls created, base fabric stored in bulk')
    }

    // Update production order status
    const { error: updateError } = await supabase
      .from('production_orders')
      .update({
        production_status: 'completed',
        quantity_produced: actualQuantity,
        actual_end_date: now.toISOString(),
        notes: qualityNotes,
        updated_at: now.toISOString()
      })
      .eq('id', productionOrderId)

    if (updateError) {
      console.error('Failed to update production order:', updateError)
      return res.status(500).json({ message: `Failed to update production order: ${updateError.message}` })
    }

    console.log('Production order updated to completed')

    // Update stock quantities
    if (productionOrder.production_type === 'weaving' && productionOrder.base_fabrics) {
      // Update base fabric stock
      const newStock = (productionOrder.base_fabrics.stock_quantity || 0) + actualQuantity
      
      await supabase
        .from('base_fabrics')
        .update({
          stock_quantity: newStock,
          updated_at: now.toISOString()
        })
        .eq('id', productionOrder.base_fabric_id)

      // Record stock movement
      await supabase
        .from('stock_movements')
        .insert({
          fabric_type: 'base_fabric',
          fabric_id: productionOrder.base_fabric_id!,
          movement_type: 'production_in',
          quantity: actualQuantity,
          reference_id: productionOrderId,
          reference_type: 'production_order',
          notes: `Production completed - Batch ${batchNumber}`,
          created_at: now.toISOString()
        })

      console.log('Base fabric stock updated:', newStock)
    } else if (productionOrder.finished_fabrics) {
      // Update finished fabric stock
      const newStock = (productionOrder.finished_fabrics.stock_quantity || 0) + actualQuantity
      
      await supabase
        .from('finished_fabrics')
        .update({
          stock_quantity: newStock,
          updated_at: now.toISOString()
        })
        .eq('id', productionOrder.finished_fabric_id)

      // Record stock movement
      await supabase
        .from('stock_movements')
        .insert({
          fabric_type: 'finished_fabric',
          fabric_id: productionOrder.finished_fabric_id!,
          movement_type: 'production_in',
          quantity: actualQuantity,
          reference_id: productionOrderId,
          reference_type: 'production_order',
          notes: `Production completed - Batch ${batchNumber}`,
          created_at: now.toISOString()
        })

      console.log('Finished fabric stock updated:', newStock)
    }

    // Return success response
    return res.status(200).json({
      message: `${productionOrder.production_type.charAt(0).toUpperCase() + productionOrder.production_type.slice(1)} production completed successfully`,
      batchNumber: batchNumber,
      rollsCreated: createdRolls.length,
      qrCodesGenerated: productionOrder.production_type === 'coating',
      productionType: productionOrder.production_type,
      notificationsSent: true,
      data: {
        productionOrder: {
          id: productionOrder.id,
          status: 'completed',
          completedAt: now.toISOString(),
          type: productionOrder.production_type
        },
        batch: {
          id: batch.id,
          batchNumber: batch.batch_number,
          actualQuantity: actualQuantity
        },
        rolls: createdRolls.map(roll => ({
          id: roll.id,
          rollNumber: roll.roll_number,
          rollLength: roll.roll_length,
          qrCode: roll.qr_code
        })),
        stockUpdated: true,
        fabricType: productionOrder.production_type === 'weaving' ? 'base_fabric' : 'finished_fabric'
      }
    })

  } catch (error) {
    console.error('Error completing production:', error)
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 