import { NextApiRequest, NextApiResponse } from 'next'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import ProductionOrderTemplate from '@/components/pdf/templates/ProductionOrderTemplate'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const orderData = req.body

    if (!orderData) {
      return res.status(400).json({ message: 'Order data is required' })
    }

    // Generate PDF using React-PDF
    const element = createElement(ProductionOrderTemplate, { order: orderData })
    const pdfBuffer = await renderToBuffer(element)

    // Set response headers for PDF
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', pdfBuffer.length)
    res.setHeader(
      'Content-Disposition', 
      `attachment; filename="production-order-${orderData.internal_order_number}.pdf"`
    )

    // Send the PDF buffer
    res.end(pdfBuffer)

  } catch (error) {
    console.error('Error generating production order PDF:', error)
    res.status(500).json({ 
      message: 'Failed to generate PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 