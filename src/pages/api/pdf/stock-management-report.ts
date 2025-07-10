import { NextApiRequest, NextApiResponse } from 'next'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import StockManagementTemplate from '@/components/pdf/templates/StockManagementTemplate'
import { supabase } from '@/lib/supabase/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const options = req.body?.options || {}
    
    // Fetch comprehensive stock data
    console.log('Fetching stock data...')
    
    // Fetch base fabrics
    const { data: baseFabrics, error: baseFabricsError } = await supabase
      .from('base_fabrics')
      .select('*')
      .order('name')

    if (baseFabricsError) {
      throw new Error(`Failed to fetch base fabrics: ${baseFabricsError.message}`)
    }

    // Fetch finished fabrics with base fabric relationships
    const { data: finishedFabrics, error: finishedFabricsError } = await supabase
      .from('finished_fabrics')
      .select(`
        *,
        base_fabrics (
          name
        )
      `)
      .order('name')

    if (finishedFabricsError) {
      throw new Error(`Failed to fetch finished fabrics: ${finishedFabricsError.message}`)
    }

    // Fetch recent stock movements (last 50 movements) - optional if table doesn't exist
    let recentMovements = []
    try {
      const { data: movements, error: movementsError } = await supabase
        .from('stock_movements')
        .select(`
          *,
          base_fabrics (name),
          finished_fabrics (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!movementsError && movements) {
        recentMovements = movements
      } else {
        console.warn('Stock movements table not found or empty, continuing without movements data')
      }
    } catch (movementsFetchError) {
      console.warn('Could not fetch stock movements, continuing without movements data:', movementsFetchError)
    }

    console.log('Data fetched successfully:', {
      baseFabrics: baseFabrics?.length,
      finishedFabrics: finishedFabrics?.length,
      recentMovements: recentMovements?.length
    })

    if (!baseFabrics || !finishedFabrics) {
      return res.status(404).json({ message: 'No stock data found' })
    }

    // Prepare data for the template
    const stockData = {
      baseFabrics: baseFabrics || [],
      finishedFabrics: finishedFabrics || [],
      recentMovements: recentMovements || []
    }

    // Generate PDF using React-PDF with StockManagementTemplate
    const pdfBuffer = await renderToBuffer(
      React.createElement(StockManagementTemplate, { 
        data: stockData,
        generatedAt: new Date().toISOString()
      }) as any
    )

    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `stock-management-report-${dateStr}.pdf`

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
    console.error('Error generating stock management report PDF:', error)
    res.status(500).json({ 
      message: 'Failed to generate stock management report PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 