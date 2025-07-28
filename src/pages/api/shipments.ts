import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Generate shipment number
function generateShipmentNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `SHIP-${year}${month}${day}-${random}`
}

// Use environment variables for service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderId, dispatchData } = req.body;
  
  if (!orderId || !dispatchData) {
    return res.status(400).json({ error: 'Missing orderId or dispatchData' });
  }

  try {
    // Create shipment record
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        shipment_number: generateShipmentNumber(),
        customer_order_id: orderId,
        shipped_date: new Date().toISOString().split('T')[0],
        tracking_number: dispatchData.gatePass,
        shipment_status: 'shipped',
        notes: `Dispatched with Invoice: ${dispatchData.invoiceNumber}, Gate Pass: ${dispatchData.gatePass}. Notes: ${dispatchData.notes || 'None'}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (shipmentError) {
      return res.status(500).json({ error: `Error creating shipment: ${shipmentError.message}` });
    }

    // Get order details
    const { data: orderDetails, error: orderDetailsError } = await supabase
      .from('customer_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderDetailsError) {
      return res.status(500).json({ error: `Error fetching order details: ${orderDetailsError.message}` });
    }

    // Get allocated rolls for this order
    const { data: allocatedRolls, error: rollsError } = await supabase
      .from('fabric_rolls')
      .select('*')
      .eq('customer_order_id', orderId)
      .eq('roll_status', 'allocated')
      .eq('fabric_type', 'finished_fabric');

    if (rollsError) {
      return res.status(500).json({ error: `Error fetching allocated rolls: ${rollsError.message}` });
    }

    if (!allocatedRolls || allocatedRolls.length === 0) {
      return res.status(400).json({ error: 'No allocated rolls found for this order. Cannot create shipment.' });
    }

    // Create shipment items
    const shipmentItems = allocatedRolls.map(roll => ({
      shipment_id: shipment.id,
      fabric_roll_id: roll.id,
      quantity_shipped: roll.roll_length,
      created_at: new Date().toISOString(),
    }));

    const { error: itemsError } = await supabase
      .from('shipment_items')
      .insert(shipmentItems);

    if (itemsError) {
      return res.status(500).json({ error: `Error inserting shipment items: ${itemsError.message}` });
    }

    // Update rolls to shipped status and archive them
    const rollUpdates = allocatedRolls.map(roll => ({
      id: roll.id,
      roll_status: 'shipped',
      archived: true,
      updated_at: new Date().toISOString(),
    }));

    for (const update of rollUpdates) {
      const { error: rollUpdateError } = await supabase
        .from('fabric_rolls')
        .update({
          roll_status: update.roll_status,
          archived: update.archived,
          updated_at: update.updated_at,
        })
        .eq('id', update.id);

      if (rollUpdateError) {
        return res.status(500).json({ error: `Error updating roll ${update.id}: ${rollUpdateError.message}` });
      }
    }

    // Update order status to dispatched
    const { error: orderUpdateError } = await supabase
      .from('customer_orders')
      .update({
        order_status: 'dispatched',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      return res.status(500).json({ error: `Error updating order status: ${orderUpdateError.message}` });
    }

    return res.status(200).json({ 
      success: true, 
      shipment: shipment,
      message: 'Shipment created successfully' 
    });

  } catch (error) {
    return res.status(500).json({ error: `Internal server error: ${error}` });
  }
} 