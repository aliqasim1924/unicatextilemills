import { NextApiRequest, NextApiResponse } from 'next'
import * as React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import PackingListTemplate from '@/components/pdf/templates/PackingListTemplate'
import { supabase } from '@/lib/supabase/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { orderId, shipmentNumber, shippedDate } = req.body

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID is required' })
    }

    // Fetch the customer order details
    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .select(`
        *,
        customers (
          name,
          contact_person,
          address,
          email,
          phone
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
      return res.status(404).json({ message: 'Order not found' })
    }

    // Fetch all allocated rolls for this customer order
    const { data: allocatedRolls, error: rollsError } = await supabase
      .from('fabric_rolls')
      .select(`
        id,
        roll_number,
        roll_length,
        remaining_length,
        quality_grade,
        customer_color,
        roll_status,
        production_batches(batch_number)
      `)
      .eq('customer_order_id', orderId)
      .in('roll_status', ['allocated', 'partially_allocated', 'shipped', 'delivered'])
      .order('created_at', { ascending: true })

    if (rollsError) {
      console.error('Error fetching allocated rolls:', rollsError)
      return res.status(500).json({ message: 'Failed to fetch allocated rolls' })
    }

    if (!allocatedRolls || allocatedRolls.length === 0) {
      return res.status(404).json({ message: 'No allocated rolls found for this order' })
    }

    // Prepare data for the template
    const packingListData = {
      order: {
        ...order,
        created_at: order.created_at || new Date().toISOString()
      },
      allocatedRolls: allocatedRolls || [],
      generatedAt: new Date().toISOString(),
      shipmentNumber: shipmentNumber || null,
      shippedDate: shippedDate || null
    }

    // Generate PDF using React-PDF with PackingListTemplate
    const pdfBuffer = await renderToBuffer(
      React.createElement(PackingListTemplate, packingListData) as any
    )

    // Generate filename with order number and current date
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `packing-list-${order.internal_order_number}-${dateStr}.pdf`

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
    console.error('Error generating packing list PDF:', error)
    res.status(500).json({ 
      message: 'Failed to generate packing list PDF',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
