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

    // Fetch the fabric roll with production_batches join
    const { data: roll, error } = await supabase
      .from('fabric_rolls')
      .select(`
        *,
        production_batches (
          batch_number,
          production_type
        )
      `)
      .eq('id', id)
      .single()

    if (error || !roll) {
      return res.status(404).json({ message: 'Roll not found' })
    }

    // Use the same mapping as the QR codes page
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

    // Process the roll data - use joined production_batches data
    const batchInfo = (roll.production_batches as any)?.batch_number 
      ? { batch_number: (roll.production_batches as any).batch_number, production_type: (roll.production_batches as any).production_type }
      : {};
    const orderInfo = roll.customer_order_id ? orderMap[roll.customer_order_id as keyof typeof orderMap] : undefined;
    const orderNumber = orderInfo?.order_number || null;
    const customerId = orderInfo?.customer_id || null;
    const customerName = customerId ? customerMap[customerId as keyof typeof customerMap] : null;
    const baseFabricName = roll.base_fabric_id ? baseFabricMap[roll.base_fabric_id as keyof typeof baseFabricMap] : null;

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
      const { data: fabricData } = await supabase
        .from('finished_fabrics')
        .select('name, color, base_fabric_id')
        .eq('id', roll.fabric_id)
        .single()
      fabricName = fabricData?.name || 'Unknown Finished Fabric'
      fabricColor = roll.customer_color || fabricData?.color || 'Natural'
      
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
    if (roll.roll_status === 'allocated' && customerName) {
      allocationStatus = `Allocated to ${customerName}`
    } else if (roll.roll_status === 'allocated') {
      allocationStatus = 'Allocated to Customer Order'
    } else if (roll.roll_status === 'used') {
      allocationStatus = 'Used in Fulfillment'
    } else if (roll.roll_status === 'shipped') {
      allocationStatus = 'In Transit'
    } else if (roll.roll_status === 'delivered') {
      allocationStatus = 'Delivered to Customer'
    }

    // When updating roll status to dispatched, also set archived: true
    await supabase
      .from('fabric_rolls')
      .update({ roll_status: 'dispatched', archived: true })
      .eq('id', roll.id);

    // Parse QR data for production purpose
    let qrData = null;
    try {
      qrData = JSON.parse(roll.qr_code);
    } catch (e) {
      console.warn('Failed to parse QR code data for roll:', roll.roll_number);
    }

    // Return the enhanced roll data
    return res.status(200).json({
      id: roll.id,
      rollNumber: roll.roll_number,
      fabricType: roll.fabric_type,
      fabricName,
      fabricColor,
      rollLength: roll.roll_length,
      remainingLength: roll.remaining_length,
      rollStatus: roll.roll_status,
      qualityGrade: roll.quality_grade,
      createdAt: roll.created_at,
      // human batch number only, never obscure GUID
      batchNumber: batchInfo?.batch_number ?? '‹missing batch number›',
      productionType: batchInfo?.production_type || 'Unknown',
      // ensure purpose is always defined
      productionPurpose: qrData?.productionPurpose
        ?? (roll.customer_order_id ? 'customer_order' : 'stock_building'),
      allocationStatus,
      customerName,
      customerOrderNumber: orderNumber,
      baseFabricName,
      qrCode: roll.qr_code
    })

  } catch (error) {
    console.error('Error fetching roll:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
} 