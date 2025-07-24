import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'
import { CustomerOrderAudit } from '@/types/database'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { orderId } = req.query

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ error: 'Order ID is required' })
  }

  try {
    // Fetch the customer order details
    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .select(`
        *,
        customers (
          name,
          contact_person
        ),
        finished_fabrics (
          name,
          gsm,
          width_meters,
          color,
          coating_type
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Fetch the audit trail for this order
    const { data: auditTrail, error: auditError } = await supabase
      .from('customer_order_audit')
      .select('*')
      .eq('customer_order_id', orderId)
      .order('created_at', { ascending: true })

    if (auditError) {
      console.error('Error fetching audit trail:', auditError)
      return res.status(500).json({ error: 'Failed to fetch audit trail' })
    }

    // Fetch all rolls supplied (allocated or dispatched) to this customer order
    const { data: suppliedRolls, error: rollsError } = await supabase
      .from('fabric_rolls')
      .select('id, roll_number, roll_length, remaining_length, quality_grade, customer_color, production_batches(batch_number)')
      .eq('customer_order_id', orderId)
      .in('roll_status', ['allocated','partially_allocated','dispatched'])

    if (rollsError) {
      console.error('Error fetching supplied rolls:', rollsError)
      return res.status(500).json({ error: 'Failed to fetch supplied rolls' })
    }

    // Note: Removed audit_generated entries to keep audit trail clean

    const auditData = {
      order,
      auditTrail: auditTrail || [],
      suppliedRolls: suppliedRolls || [],
      generatedAt: new Date().toISOString(),
    }

    res.status(200).json(auditData)
  } catch (error) {
    console.error('Error generating audit trail:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
} 