import { NextApiRequest, NextApiResponse } from 'next'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import BatchReportTemplate from '@/components/pdf/templates/BatchReportTemplate'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { batchId } = req.body

    if (!batchId) {
      return res.status(400).json({ message: 'Batch ID is required' })
    }

    console.log('Fetching batch data for ID:', batchId)
    
    // Fetch batch data with all related information
    const { data: batch, error: batchError } = await supabase
      .from('production_batches')
      .select(`
        *,
        production_orders (
          internal_order_number,
          customer_orders (
            internal_order_number,
            customers (
              name
            )
          )
        ),
        base_fabrics:base_fabric_id (
          name,
          gsm,
          width_meters,
          color
        ),
        finished_fabrics:finished_fabric_id (
          name,
          gsm,
          width_meters,
          color,
          coating_type
        )
      `)
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      console.error('Error fetching batch:', batchError)
      return res.status(404).json({ message: 'Batch not found', error: batchError?.message })
    }

    // Fetch fabric rolls for this batch
    const { data: fabricRolls, error: rollsError } = await supabase
      .from('fabric_rolls')
      .select(`
        id,
        roll_number,
        length,
        remaining_length,
        roll_status,
        quality_grade,
        roll_type,
        created_at
      `)
      .eq('batch_id', batchId)
      .order('roll_number')

    if (rollsError) {
      console.error('Error fetching fabric rolls:', rollsError)
      return res.status(500).json({ message: 'Failed to fetch fabric rolls', error: rollsError.message })
    }

    console.log('Data fetched successfully:', {
      batch: batch.batch_number,
      rollsCount: fabricRolls?.length || 0
    })

    // Prepare batch data for the template
    const batchData = {
      ...batch,
      fabric_rolls: fabricRolls || []
    }

    // Generate PDF using React-PDF with BatchReportTemplate
    const pdfBuffer = await renderToBuffer(
      React.createElement(BatchReportTemplate, { 
        batch: batchData,
        generatedAt: new Date().toISOString()
      }) as any
    )

    // Generate filename with batch number and current date
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `batch-report-${batch.batch_number}-${dateStr}.pdf`

    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', pdfBuffer.length)
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename="${filename}"`
    )

    // Send the PDF buffer
    res.end(pdfBuffer)

  } catch (error) {
    console.error('Error generating batch report PDF:', error)
    res.status(500).json({ 
      message: 'Failed to generate batch report PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 