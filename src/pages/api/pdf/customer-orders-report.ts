import { NextApiRequest, NextApiResponse } from 'next'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import CustomerOrderTemplate from '@/components/pdf/templates/CustomerOrderTemplate'
import { supabase } from '@/lib/supabase/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const options = req.body?.options || {}
    
    // Fetch all customer orders data with related information
    const { data: orders, error } = await supabase
      .from('customer_orders')
      .select(`
        *,
        customers (
          name,
          contact_person,
          phone,
          email,
          address
        ),
        finished_fabrics (
          name,
          gsm,
          width_meters,
          color,
          coating_type
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`)
    }

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'No orders found' })
    }

    // Generate PDF using React-PDF with CustomerOrderTemplate
    const pdfBuffer = await renderToBuffer(
      React.createElement(CustomerOrderTemplate, { 
        orders: orders,
        generatedAt: new Date().toISOString()
      })
    )

    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `customer-orders-report-${dateStr}.pdf`

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
    console.error('Error generating customer orders report PDF:', error)
    res.status(500).json({ 
      message: 'Failed to generate customer orders report PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 