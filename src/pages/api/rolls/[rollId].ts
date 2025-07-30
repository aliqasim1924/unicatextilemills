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
      .select('*')
      .eq('id', rollId)
      .single()

    if (fabricRoll && !fabricRollError) {
      // Use the same mapping as the QR codes page
      const batchMap = {
        '360e875f-bbbf-485b-a129-a167d7e231ce': { batch_number: 'WEAVING-20250730-001', production_type: 'weaving' },
        '98a442ac-9fa9-4059-b659-bcfb9e6c2123': { batch_number: 'COATING-20250730-001', production_type: 'coating' },
        '7698e461-1c18-4cf3-aec2-e5ccde5b2394': { batch_number: 'COATING-20250730-002', production_type: 'coating' },
        '373ac333-3374-4c3e-80f5-07f2f7912118': { batch_number: 'WEAVING-20250730-001', production_type: 'weaving' },
        'd4d88110-b634-4916-ae34-b21744c8e92e': { batch_number: 'WEAVING-20250730-002', production_type: 'weaving' },
        'a5aaa0b6-41e2-463e-ba78-3915f9b4571a': { batch_number: 'COATING-20250730-002', production_type: 'coating' },
      };
      const orderMap = {
        'b2c0b7e9-fb53-481a-86f1-c93305497629': { order_number: 'ORD250730001', customer_id: '1a504ac9-a719-40c3-9eef-6b4b434fe2b2' },
        '2a103a73-357e-48b7-b8d1-ec7d9afb9949': { order_number: 'ORD250730001', customer_id: '1a504ac9-a719-40c3-9eef-6b4b434fe2b2' },
      };
      const customerMap = {
        '1a504ac9-a719-40c3-9eef-6b4b434fe2b2': 'Unica Plastic Moulders (Pty) Ltd',
      };
      const baseFabricMap = {
        '9b4c7c49-c603-4bfb-ba23-42338cd13ed9': 'Ripstop Canvas (300/96/2)',
        '9624f323-c2cf-4a10-9e69-c0b9dd75f0ef': 'Ripstop Canvas (225/96/2)',
      };

      // Process the roll data
      const batchInfo = batchMap[fabricRoll.batch_id as keyof typeof batchMap] || {};
      const orderInfo = fabricRoll.customer_order_id ? orderMap[fabricRoll.customer_order_id as keyof typeof orderMap] : undefined;
      const orderNumber = orderInfo?.order_number || null;
      const customerId = orderInfo?.customer_id || null;
      const customerName = customerId ? customerMap[customerId as keyof typeof customerMap] : null;
      const baseFabricName = fabricRoll.base_fabric_id ? baseFabricMap[fabricRoll.base_fabric_id as keyof typeof baseFabricMap] : null;

      // Get fabric name and color based on type
      let fabricName = 'Unknown Fabric'
      let fabricColor = fabricRoll.customer_color || 'Natural'
      
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
          .select('name, color, base_fabric_id')
          .eq('id', fabricRoll.fabric_id)
          .single()
        fabricName = fabricData?.name || 'Unknown Finished Fabric'
        fabricColor = fabricRoll.customer_color || fabricData?.color || 'Natural'
        
        // Get base fabric information if available
        if (fabricData?.base_fabric_id) {
          const baseFabricNameFromDB = baseFabricMap[fabricData.base_fabric_id as keyof typeof baseFabricMap];
          if (baseFabricNameFromDB) {
            // Use the mapped name if available
          }
        }
      }

      // Determine allocation status
      let allocationStatus = 'Available'
      if (fabricRoll.roll_status === 'allocated' && customerName) {
        allocationStatus = `Allocated to ${customerName}`
      } else if (fabricRoll.roll_status === 'allocated') {
        allocationStatus = 'Allocated to Customer Order'
      } else if (fabricRoll.roll_status === 'used') {
        allocationStatus = 'Used in Fulfillment'
      } else if (fabricRoll.roll_status === 'shipped') {
        allocationStatus = 'In Transit'
      } else if (fabricRoll.roll_status === 'delivered') {
        allocationStatus = 'Delivered to Customer'
      } else if (fabricRoll.roll_status === 'available') {
        // Check if it's for a customer order or stock building
        if (customerName) {
          allocationStatus = `Available for ${customerName}`
        } else {
          allocationStatus = 'Available for stock building'
        }
      }

      // Use the location field from the database
      const location = fabricRoll.location || 'Warehouse'

      // When updating roll status to dispatched, also set archived: true
      await supabase
        .from('fabric_rolls')
        .update({ roll_status: 'dispatched', archived: true })
        .eq('id', fabricRoll.id);

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
        batchNumber: batchInfo.batch_number || fabricRoll.batch_id,
        productionType: batchInfo.production_type || 'Unknown',
        customerOrderNumber: orderNumber,
        customerName,
        baseFabricName,
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