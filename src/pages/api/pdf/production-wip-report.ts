import { NextApiRequest, NextApiResponse } from 'next'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import ProductionWIPTemplate from '@/components/pdf/templates/ProductionWIPTemplate'
import { supabase } from '@/lib/supabase/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const options = req.body?.options || {}
    
    // Fetch comprehensive production orders data
    console.log('Fetching production orders data...')
    
    const { data: productionOrders, error } = await supabase
      .from('production_orders')
      .select(`
        *,
        customer_orders (
          internal_order_number,
          customers (
            name
          )
        ),
        base_fabrics (
          name,
          stock_quantity
        ),
        finished_fabrics (
          name,
          stock_quantity
        ),
        linked_production_order:linked_production_order_id (
          internal_order_number,
          production_type,
          production_status
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch production orders: ${error.message}`)
    }

    console.log('Production orders fetched successfully:', {
      totalOrders: productionOrders?.length || 0
    })

    if (!productionOrders || productionOrders.length === 0) {
      return res.status(404).json({ message: 'No production orders found' })
    }

    // Prepare data for the template
    const productionData = {
      productionOrders: productionOrders || []
    }

    // Generate PDF using React-PDF with ProductionWIPTemplate
    const pdfBuffer = await renderToBuffer(
      React.createElement(ProductionWIPTemplate, { 
        data: productionData,
        generatedAt: new Date().toISOString()
      }) as any
    )

    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `production-wip-report-${dateStr}.pdf`

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
    console.error('Error generating production WIP report PDF:', error)
    res.status(500).json({ 
      message: 'Failed to generate production WIP report PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 