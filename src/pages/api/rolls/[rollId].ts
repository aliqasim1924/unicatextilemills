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

    // First, try to find the roll in fabric_rolls table with production_batches join
    const { data: fabricRoll, error: fabricRollError } = await supabase
      .from('fabric_rolls')
      .select(`
        *,
        production_batches (
          batch_number,
          production_type
        )
      `)
      .eq('id', rollId)
      .single()

    // Debug logging
    console.log('Fabric roll data:', {
      id: fabricRoll?.id,
      rollNumber: fabricRoll?.roll_number,
      batchId: fabricRoll?.batch_id,
      productionBatches: fabricRoll?.production_batches
    })

    if (fabricRoll && !fabricRollError) {
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

      // Process the roll data - use joined production_batches data only
      let batchInfo = (fabricRoll.production_batches as any)?.batch_number 
        ? { batch_number: (fabricRoll.production_batches as any).batch_number, production_type: (fabricRoll.production_batches as any).production_type }
        : {};
      
      // If join didn't work, try direct query to production_batches
      if (!batchInfo.batch_number && fabricRoll.batch_id) {
        console.log('Join failed, trying direct query for batch_id:', fabricRoll.batch_id)
        const { data: directBatchData, error: directBatchError } = await supabase
          .from('production_batches')
          .select('batch_number, production_type')
          .eq('id', fabricRoll.batch_id)
          .single()
        
        if (directBatchData && !directBatchError) {
          batchInfo = {
            batch_number: directBatchData.batch_number,
            production_type: directBatchData.production_type
          }
          console.log('Direct query successful:', batchInfo)
        } else {
          console.log('Direct query failed:', directBatchError)
        }
      }
      
      // Debug logging for batch info
      console.log('Batch info processing:', {
        productionBatchesData: fabricRoll.production_batches,
        batchInfo,
        finalBatchNumber: batchInfo?.batch_number ?? '‹missing batch number›'
      })
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

      // Parse QR data for production purpose
      let qrData = null;
      try {
        qrData = JSON.parse(fabricRoll.qr_code);
      } catch (e) {
        console.warn('Failed to parse QR code data for roll:', fabricRoll.roll_number);
      }

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
        // human batch number only, never obscure GUID
        batchNumber: batchInfo?.batch_number ?? '‹missing batch number›',
        productionType: batchInfo?.production_type || 'Unknown',
        // ensure purpose is always defined
        productionPurpose: qrData?.productionPurpose
          ?? (fabricRoll.customer_order_id ? 'customer_order' : 'stock_building'),
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