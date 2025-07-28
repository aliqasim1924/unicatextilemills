import { NextApiRequest, NextApiResponse } from 'next'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase/client'
import QRInfoTemplate from '@/components/pdf/templates/QRInfoTemplate'

interface FabricRoll {
  id: string
  roll_number: string
  batch_id: string
  fabric_type: 'base_fabric' | 'finished_fabric'
  fabric_id: string
  roll_length: number
  remaining_length: number
  roll_status: string
  location?: string
  qr_code: string
  created_at: string
  production_batches?: {
    batch_number: string
    production_type: string
    production_orders?: {
      internal_order_number: string
      customer_order_id?: string
      customer_orders?: {
        internal_order_number: string
        customers?: {
          name: string
        }
      }
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { qrId } = req.query
    const { format = 'pdf' } = req.query

    if (!qrId || typeof qrId !== 'string') {
      return res.status(400).json({ message: 'QR ID is required' })
    }

    // Find the fabric roll by QR ID (stored in additionalData.qrId)
    const { data: rollsData, error: rollsError } = await supabase
      .from('fabric_rolls')
      .select(`
        *,
        production_batches (
          batch_number,
          production_type,
          production_orders (
            internal_order_number,
            customer_order_id,
            customer_orders (
              internal_order_number,
              customers (
                name
              )
            )
          )
        )
      `)
      .eq('archived', false)

    if (rollsError) {
      console.error('Error loading fabric rolls:', rollsError)
      return res.status(500).json({ message: 'Database error' })
    }

    // Find roll with matching QR ID
    let targetRoll: FabricRoll | null = null
    for (const roll of rollsData || []) {
      try {
        const qrData = JSON.parse(roll.qr_code)
        if (qrData.additionalData?.qrId === qrId) {
          targetRoll = roll
          break
        }
      } catch (e) {
        continue
      }
    }

    if (!targetRoll) {
      return res.status(404).json({ message: 'QR code not found' })
    }

    // Get fabric name and color based on type
    let fabricName = 'Unknown Fabric'
    let fabricColor = 'Natural'
    if (targetRoll.fabric_type === 'base_fabric') {
      const { data: fabricData } = await supabase
        .from('base_fabrics')
        .select('name')
        .eq('id', targetRoll.fabric_id)
        .single()
      fabricName = fabricData?.name || 'Unknown Base Fabric'
    } else if (targetRoll.fabric_type === 'finished_fabric') {
      const { data: fabricData } = await supabase
        .from('finished_fabrics')
        .select('name, color')
        .eq('id', targetRoll.fabric_id)
        .single()
      fabricName = fabricData?.name || 'Unknown Finished Fabric'
      fabricColor = fabricData?.color || 'Natural'
    }

    // Parse QR data for additional context
    let qrData = null
    try {
      qrData = JSON.parse(targetRoll.qr_code)
    } catch (e) {
      qrData = {}
    }

    // Determine allocation status
    let allocationStatus = 'Available'
    
    if (targetRoll.roll_status === 'allocated') {
      if (targetRoll.production_batches?.production_orders?.customer_orders?.customers?.name) {
        allocationStatus = `Allocated to ${targetRoll.production_batches.production_orders.customer_orders.customers.name}`
      } else {
        allocationStatus = 'Allocated to customer order'
      }
    } else if (targetRoll.roll_status === 'partially_allocated') {
      allocationStatus = 'Partially allocated'
    } else if (targetRoll.roll_status === 'used') {
      allocationStatus = 'Used in fulfillment'
    } else if (targetRoll.roll_status === 'shipped') {
      allocationStatus = 'Shipped to customer'
    } else if (targetRoll.roll_status === 'delivered') {
      allocationStatus = 'Delivered to customer'
    } else if (targetRoll.roll_status === 'available') {
      // Check if it's for a customer order or stock building
      if (targetRoll.production_batches?.production_orders?.customer_orders?.customers?.name) {
        allocationStatus = `Available for ${targetRoll.production_batches.production_orders.customer_orders.customers.name}`
      } else {
        allocationStatus = 'Available for stock building'
      }
    }

    // Use the location field from the database
    const location = targetRoll.location || 'Warehouse'

    const rollInfo = {
      rollNumber: targetRoll.roll_number,
      batchId: targetRoll.batch_id,
      fabricType: targetRoll.fabric_type,
      fabricName,
      color: fabricColor,
      allocationStatus,
      location,
      rollLength: targetRoll.roll_length,
      remainingLength: targetRoll.remaining_length,
      rollStatus: targetRoll.roll_status,
      productionPurpose: qrData.productionPurpose || 'stock_building',
      customerOrderNumber: qrData.customerOrderNumber,
      customerName: qrData.customerName,
      productionOrderNumber: qrData.productionOrderNumber,
      batchNumber: targetRoll.production_batches?.batch_number,
      productionType: targetRoll.production_batches?.production_type,
      qrGeneratedAt: qrData.qrGeneratedAt || targetRoll.created_at,
    }

    if (format === 'txt' || format === 'text') {
      // Generate text file
      const textContent = generateTextContent(rollInfo)
      
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Content-Disposition', `attachment; filename="roll-${targetRoll.roll_number}-info.txt"`)
      res.send(textContent)
    } else {
      // Generate PDF file (default)
      const element = createElement(QRInfoTemplate, { qrData: rollInfo })
      const pdfBuffer = await renderToBuffer(element)

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Length', pdfBuffer.length)
      res.setHeader('Content-Disposition', `attachment; filename="roll-${targetRoll.roll_number}-info.pdf"`)
      res.end(pdfBuffer)
    }

  } catch (error) {
    console.error('Error generating QR download:', error)
    res.status(500).json({ 
      message: 'Failed to generate download',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function generateTextContent(rollInfo: any): string {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Helper function to format text to proper sentence case
  const formatToSentenceCase = (text?: string) => {
    if (!text) return 'N/A'
    
    return text
      .toLowerCase()
      .replace(/_/g, ' ') // Replace underscores with spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return `
FABRIC ROLL INFORMATION
=============================================

ROLL DETAILS
------------
Roll Number: ${rollInfo.rollNumber || 'N/A'}
Fabric Name: ${formatToSentenceCase(rollInfo.fabricName)}
Colour: ${rollInfo.color || 'Natural'}
Roll Length: ${rollInfo.rollLength ? `${rollInfo.rollLength}m` : 'N/A'}
Remaining Length: ${rollInfo.remainingLength ? `${rollInfo.remainingLength}m` : 'N/A'}
Status: ${rollInfo.allocationStatus || 'Available'}

PRODUCTION DETAILS
------------------
Batch Number: ${rollInfo.batchNumber || 'N/A'}
Production Type: ${formatToSentenceCase(rollInfo.productionType)}
Production Purpose: ${formatToSentenceCase(rollInfo.productionPurpose)}
${rollInfo.productionOrderNumber ? `Production Order: ${rollInfo.productionOrderNumber}\n` : ''}

${(rollInfo.customerName || rollInfo.customerOrderNumber) ? `CUSTOMER DETAILS
----------------
${rollInfo.customerName ? `Customer: ${formatToSentenceCase(rollInfo.customerName)}\n` : ''}${rollInfo.customerOrderNumber ? `Customer Order: ${rollInfo.customerOrderNumber}\n` : ''}
` : ''}
GENERATION INFO
---------------
Generated on: ${formatDate(new Date().toISOString())}
QR Code Generated: ${formatDate(rollInfo.qrGeneratedAt)}

=============================================
Generated by Unica Textile Mills Stock Management System
`.trim()
} 