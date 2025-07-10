import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'
import { ProductionOrderAudit } from '@/types/database'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { orderId } = req.query

  if (!orderId || typeof orderId !== 'string') {
    return res.status(400).json({ error: 'Order ID is required' })
  }

  try {
    // Fetch the production order details
    const { data: order, error: orderError } = await supabase
      .from('production_orders')
      .select(`
        *,
        customer_orders (
          internal_order_number,
          customers (
            name,
            contact_person
          )
        ),
        base_fabrics (
          name,
          gsm,
          width_meters,
          color
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
      return res.status(404).json({ error: 'Production order not found' })
    }

    // Fetch the audit trail for this production order
    const { data: auditTrail, error: auditError } = await supabase
      .from('production_order_audit')
      .select('*')
      .eq('production_order_id', orderId)
      .order('created_at', { ascending: true })

    if (auditError) {
      console.error('Error fetching audit trail:', auditError)
      return res.status(500).json({ error: 'Failed to fetch audit trail' })
    }

    // Note: Removed audit_generated entries to keep audit trail clean

    const auditData = {
      order,
      auditTrail: auditTrail || [],
      generatedAt: new Date().toISOString(),
    }

    res.status(200).json(auditData)
  } catch (error) {
    console.error('Error generating production audit trail:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
} 