import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabase/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { productionOrderId, batchId } = req.body
    if (!productionOrderId || !batchId) {
      return res.status(400).json({ message: 'Missing required fields: productionOrderId, batchId' })
    }

    // (Insert your coating start logic here, e.g., update production status, timestamps, etc.)

    // Archive all base-fabric rolls used in this batch
    await supabase
      .from('fabric_rolls')
      .update({ archived: true })
      .eq('batch_id', batchId)
      .eq('fabric_type', 'base_fabric')

    return res.status(200).json({
      message: 'Coating production started and base-fabric rolls archived',
      productionOrderId,
      batchId
    })
  } catch (error) {
    console.error('Error starting coating production:', error)
    return res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 