import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    console.log('Attempting to fetch batches...')

    const { data, error } = await supabase
      .from('production_batches')
      .select(`
        *,
        production_orders (
          internal_order_number,
          production_type,
          customer_orders (
            internal_order_number,
            customers (name)
          )
        ),
        base_fabrics:base_fabric_id (name, color),
        finished_fabrics:finished_fabric_id (name, color, coating_type)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching batches:', error)
      return res.status(500).json({ error: 'Failed to fetch batches', details: error.message })
    }

    console.log('Successfully fetched batches:', data?.length || 0)
    return res.status(200).json({ batches: data || [] })
  } catch (error) {
    console.error('Error fetching batches:', error)
    return res.status(500).json({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' })
  }
} 