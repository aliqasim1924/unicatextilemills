import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Use environment variables for service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderId, deliveryData } = req.body;
  
  if (!orderId || !deliveryData) {
    return res.status(400).json({ error: 'Missing orderId or deliveryData' });
  }

  try {
    console.log('Delivery API called for orderId:', orderId);
    
    // Get shipment for this order (check both shipped and delivered status)
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('*')
      .eq('customer_order_id', orderId)
      .in('shipment_status', ['shipped', 'delivered'])
      .single();

    console.log('Shipment query result:', { shipment, error: shipmentError });

    if (shipmentError || !shipment) {
      console.log('No shipment found for order:', orderId);
      return res.status(404).json({ error: 'No shipment found for this order' });
    }

    // If shipment is already delivered, return success
    if (shipment.shipment_status === 'delivered') {
      return res.status(200).json({ 
        success: true, 
        message: 'Order already delivered',
        updatedRolls: 0
      });
    }

    // Update shipment status to delivered
    const { error: shipmentUpdateError } = await supabase
      .from('shipments')
      .update({
        shipment_status: 'delivered',
        delivery_date: new Date().toISOString().split('T')[0],
        notes: `${shipment.notes || ''}\nDelivered on ${new Date().toLocaleDateString()}. Notes: ${deliveryData.notes || 'None'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipment.id);

    if (shipmentUpdateError) {
      return res.status(500).json({ error: `Error updating shipment: ${shipmentUpdateError.message}` });
    }

    // Get all rolls in this shipment
    const { data: shipmentItems, error: itemsError } = await supabase
      .from('shipment_items')
      .select('fabric_roll_id')
      .eq('shipment_id', shipment.id);

    if (itemsError) {
      return res.status(500).json({ error: `Error fetching shipment items: ${itemsError.message}` });
    }

    // Update all rolls to delivered status and update location
    const rollIds = shipmentItems?.map(item => item.fabric_roll_id) || [];
    
    console.log('Roll IDs to update:', rollIds);
    
    if (rollIds.length > 0) {
      const { error: rollsUpdateError } = await supabase
        .from('fabric_rolls')
        .update({
          roll_status: 'delivered',
          location: 'Delivered to Customer',
          updated_at: new Date().toISOString(),
        })
        .in('id', rollIds);

      console.log('Rolls update result:', { error: rollsUpdateError });

      if (rollsUpdateError) {
        return res.status(500).json({ error: `Error updating rolls: ${rollsUpdateError.message}` });
      }
    }

    // Update order status to delivered
    const { error: orderUpdateError } = await supabase
      .from('customer_orders')
      .update({
        order_status: 'delivered',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (orderUpdateError) {
      return res.status(500).json({ error: `Error updating order status: ${orderUpdateError.message}` });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Order delivered successfully',
      updatedRolls: rollIds.length
    });

  } catch (error) {
    return res.status(500).json({ error: `Internal server error: ${error}` });
  }
} 