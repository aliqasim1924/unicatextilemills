import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Roll ID is required' })
    }

    // Fetch the current fabric roll and related info
    const { data: roll, error } = await supabase
      .from('fabric_rolls')
      .select(`
        *,
        production_batches (
          batch_number,
          production_type,
          production_orders (
            internal_order_number,
            customer_order_id,
            customer_orders (
              internal_order_number,
              customers (
                name
              )
            )
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !roll) {
      return res.status(404).json({ message: 'Roll not found' })
    }

    // Get fabric name and color based on type
    let fabricName = 'Unknown Fabric'
    let fabricColor = 'Natural'
    if (roll.fabric_type === 'base_fabric') {
      const { data: fabricData } = await supabase
        .from('base_fabrics')
        .select('name')
        .eq('id', roll.fabric_id)
        .single()
      fabricName = fabricData?.name || 'Unknown Base Fabric'
    } else if (roll.fabric_type === 'finished_fabric') {
      // Prefer customer_color on the roll, fallback to finished_fabrics.color
      const { data: fabricData } = await supabase
        .from('finished_fabrics')
        .select('name, color')
        .eq('id', roll.fabric_id)
        .single()
      fabricName = fabricData?.name || 'Unknown Finished Fabric'
      fabricColor = roll.customer_color || fabricData?.color || 'Natural'
    }

    // Determine allocation status
    let allocationStatus = 'Available'
    if (roll.roll_status === 'allocated') {
      if (roll.production_batches?.production_orders?.customer_orders?.customers?.name) {
        allocationStatus = `Allocated to ${roll.production_batches.production_orders.customer_orders.customers.name}`
      } else {
        allocationStatus = 'Allocated to customer order'
      }
    } else if (roll.roll_status === 'partially_allocated') {
      allocationStatus = 'Partially allocated'
    } else if (roll.roll_status === 'used') {
      allocationStatus = 'Used in fulfillment'
    } else if (roll.roll_status === 'shipped') {
      allocationStatus = 'Shipped to customer'
    } else if (roll.roll_status === 'available') {
      if (roll.production_batches?.production_orders?.customer_orders?.customers?.name) {
        allocationStatus = `Available for ${roll.production_batches.production_orders.customer_orders.customers.name}`
      } else {
        allocationStatus = 'Available for stock building'
      }
    }

    // Return all live roll data as JSON
    res.status(200).json({
      id: roll.id,
      rollNumber: roll.roll_number,
      batchId: roll.batch_id,
      fabricType: roll.fabric_type,
      fabricName,
      color: fabricColor,
      allocationStatus,
      rollLength: roll.roll_length,
      remainingLength: roll.remaining_length,
      rollStatus: roll.roll_status,
      customerColor: roll.customer_color,
      batchNumber: roll.production_batches?.batch_number,
      productionType: roll.production_batches?.production_type,
      productionOrderNumber: roll.production_batches?.production_orders?.internal_order_number,
      customerOrderNumber: roll.production_batches?.production_orders?.customer_orders?.internal_order_number,
      customerName: roll.production_batches?.production_orders?.customer_orders?.customers?.name,
      createdAt: roll.created_at,
      updatedAt: roll.updated_at,
    })
  } catch (error) {
    console.error('Error fetching live roll data:', error)
    res.status(500).json({ message: 'Failed to fetch live roll data', error: error instanceof Error ? error.message : 'Unknown error' })
  }
} 