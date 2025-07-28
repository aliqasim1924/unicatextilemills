import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { rollId } = req.query

    if (!rollId || typeof rollId !== 'string') {
      return res.status(400).json({ message: 'Roll ID is required' })
    }

    // First, try to find the roll in fabric_rolls table
    const { data: fabricRoll, error: fabricRollError } = await supabase
      .from('fabric_rolls')
      .select(`
        *,
        production_batches (
          batch_number,
          production_type,
          customer_color,
          production_orders (
            internal_order_number,
            customer_order_id,
            customer_color,
            customer_orders (
              internal_order_number,
              customers (
                name
              )
            )
          )
        ),
        customer_order_items:customer_order_item_id (
          id,
          color,
          quantity_ordered,
          customer_order_id,
          customer_orders (
            internal_order_number,
            customers (
              name
            )
          )
        )
      `)
      .eq('id', rollId)
      .single()

    if (fabricRoll && !fabricRollError) {
      // Get fabric name and color based on type
      let fabricName = 'Unknown Fabric'
      let fabricColor = fabricRoll.customer_color || 
                       fabricRoll.customer_order_items?.color || 
                       fabricRoll.production_batches?.customer_color ||
                       'Natural'
      
      if (fabricRoll.fabric_type === 'base_fabric') {
        const { data: fabricData } = await supabase
          .from('base_fabrics')
          .select('name')
          .eq('id', fabricRoll.fabric_id)
          .single()
        fabricName = fabricData?.name || 'Unknown Base Fabric'
      } else if (fabricRoll.fabric_type === 'finished_fabric') {
        const { data: fabricData } = await supabase
          .from('finished_fabrics')
          .select('name, color')
          .eq('id', fabricRoll.fabric_id)
          .single()
        fabricName = fabricData?.name || 'Unknown Finished Fabric'
        // Keep the customer color we already determined, don't override it
        if (!fabricColor || fabricColor === 'Natural') {
          fabricColor = fabricData?.color || 'Natural'
        }
      }

      // Determine allocation status
      let allocationStatus = 'Available'
      
      if (fabricRoll.roll_status === 'allocated') {
        if (fabricRoll.production_batches?.production_orders?.customer_orders?.customers?.name) {
          allocationStatus = `Allocated to ${fabricRoll.production_batches.production_orders.customer_orders.customers.name}`
        } else {
          allocationStatus = 'Allocated to customer order'
        }
      } else if (fabricRoll.roll_status === 'partially_allocated') {
        allocationStatus = 'Partially allocated'
      } else if (fabricRoll.roll_status === 'used') {
        allocationStatus = 'Used in fulfillment'
      } else if (fabricRoll.roll_status === 'shipped') {
        allocationStatus = 'Shipped to customer'
      } else if (fabricRoll.roll_status === 'delivered') {
        allocationStatus = 'Delivered to customer'
      } else if (fabricRoll.roll_status === 'available') {
        // Check if it's for a customer order or stock building
        if (fabricRoll.production_batches?.production_orders?.customer_orders?.customers?.name) {
          allocationStatus = `Available for ${fabricRoll.production_batches.production_orders.customer_orders.customers.name}`
        } else {
          allocationStatus = 'Available for stock building'
        }
      }

      // Use the location field from the database
      const location = fabricRoll.location || 'Warehouse'

      const rollDetails = {
        id: fabricRoll.id,
        rollNumber: fabricRoll.roll_number,
        fabricType: fabricRoll.fabric_type,
        fabricName,
        color: fabricColor,
        allocationStatus,
        rollLength: fabricRoll.roll_length,
        remainingLength: fabricRoll.remaining_length,
        rollStatus: fabricRoll.roll_status,
        qualityGrade: fabricRoll.quality_grade || 'Not specified',
        rollType: fabricRoll.roll_type || 'standard',
        batchNumber: fabricRoll.production_batches?.batch_number,
        productionType: fabricRoll.production_batches?.production_type,
        productionOrderNumber: fabricRoll.production_batches?.production_orders?.internal_order_number,
        customerOrderNumber: fabricRoll.production_batches?.production_orders?.customer_orders?.internal_order_number,
        customerName: fabricRoll.production_batches?.production_orders?.customer_orders?.customers?.name,
        createdAt: fabricRoll.created_at,
        location
      }

      return res.status(200).json({
        success: true,
        data: rollDetails,
        type: 'fabric_roll'
      })
    }

    // If not found in fabric_rolls, try loom_rolls table
    const { data: loomRoll, error: loomRollError } = await supabase
      .from('loom_rolls')
      .select(`
        *,
        loom_production_details!inner (
          loom_id,
          production_order_id,
          looms (loom_number),
          production_orders (
            internal_order_number,
            production_type,
            customer_order_id,
            customer_orders (
              internal_order_number,
              customers (name)
            )
          )
        )
      `)
      .eq('id', rollId)
      .single()

    if (loomRoll && !loomRollError) {
      const rollDetails = {
        id: loomRoll.id,
        rollNumber: loomRoll.roll_number,
        fabricType: 'loom_roll',
        fabricName: 'Base Fabric (Loom Roll)',
        rollLength: loomRoll.roll_length,
        rollWeight: loomRoll.roll_weight,
        rollStatus: loomRoll.roll_status,
        qualityGrade: loomRoll.quality_grade || 'Not specified',
        rollType: 'loom_roll',
        loomNumber: loomRoll.loom_production_details?.looms?.loom_number,
        productionType: loomRoll.loom_production_details?.production_orders?.production_type,
        productionOrderNumber: loomRoll.loom_production_details?.production_orders?.internal_order_number,
        customerOrderNumber: loomRoll.loom_production_details?.production_orders?.customer_orders?.internal_order_number,
        customerName: loomRoll.loom_production_details?.production_orders?.customer_orders?.customers?.name,
        createdAt: loomRoll.created_at,
        producedAt: loomRoll.produced_at,
        qualityNotes: loomRoll.quality_notes
      }

      return res.status(200).json({
        success: true,
        data: rollDetails,
        type: 'loom_roll'
      })
    }

    // If still not found, return 404
    return res.status(404).json({ 
      success: false, 
      message: 'Roll not found' 
    })

  } catch (error) {
    console.error('Error fetching roll details:', error)
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    })
  }
} 