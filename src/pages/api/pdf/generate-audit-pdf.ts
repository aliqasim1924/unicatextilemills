import { NextApiRequest, NextApiResponse } from 'next'
import { jsPDF } from 'jspdf'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { order, auditTrail, generatedAt, type } = req.body

    // Create new PDF document
    const doc = new jsPDF('p', 'mm', 'a4')
    
    // Configure monospace font for audit appearance
    doc.setFont('courier', 'normal')
    doc.setFontSize(10)

    let yPosition = 20

    // Header
    doc.setFontSize(16)
    doc.setFont('courier', 'bold')
    doc.text('UNICA TEXTILE MILLS', 20, yPosition)
    yPosition += 8
    
    doc.setFontSize(10)
    doc.setFont('courier', 'normal')
    doc.text('Quality Fabrics & Textiles', 20, yPosition)
    yPosition += 10

    // Title
    doc.setFontSize(14)
    doc.setFont('courier', 'bold')
    const title = type === 'customer_order' 
      ? 'CUSTOMER ORDER AUDIT TRAIL' 
      : 'PRODUCTION ORDER AUDIT TRAIL'
    doc.text(title, 20, yPosition)
    yPosition += 8

    doc.setFontSize(8)
    doc.setFont('courier', 'normal')
    doc.text('Complete Activity Log & Change History', 20, yPosition)
    yPosition += 15

    // Document info box
    doc.setLineWidth(0.5)
    doc.rect(20, yPosition, 170, 30)
    yPosition += 5

    doc.setFontSize(8)
    doc.setFont('courier', 'bold')
    doc.text('AUDIT DOCUMENT INFORMATION', 25, yPosition)
    yPosition += 5

    doc.setFont('courier', 'normal')
    doc.text(`DOCUMENT TYPE: ${title}`, 25, yPosition)
    yPosition += 4
    doc.text(`GENERATED ON: ${new Date(generatedAt).toLocaleString()}`, 25, yPosition)
    yPosition += 4
    doc.text(`TOTAL ENTRIES: ${auditTrail.length} RECORDS`, 25, yPosition)
    yPosition += 4
    doc.text(`ORDER NUMBER: ${order.internal_order_number}`, 25, yPosition)
    yPosition += 15

    // Order Summary
    doc.setFont('courier', 'bold')
    doc.setFontSize(10)
    doc.text('ORDER SUMMARY', 20, yPosition)
    yPosition += 5

    doc.setLineWidth(0.3)
    doc.rect(20, yPosition, 170, 25)
    yPosition += 5

    doc.setFontSize(8)
    doc.setFont('courier', 'normal')

    const summaryInfo = [
      `ORDER NUMBER: ${order.internal_order_number}`,
      `${type === 'customer_order' ? 'CUSTOMER PO' : 'PRODUCTION TYPE'}: ${
        type === 'customer_order' 
          ? (order.customer_po_number || 'N/A')
          : (order.production_type?.toUpperCase() || 'N/A')
      }`,
      `${type === 'customer_order' ? 'CUSTOMER' : 'LINKED ORDER'}: ${
        type === 'customer_order' 
          ? (order.customers?.name || 'N/A')
          : (order.customer_orders?.internal_order_number || 'N/A')
      }`,
      `QUANTITY: ${order.quantity_ordered || order.quantity_required}M`,
      `CURRENT STATUS: ${(order.order_status || order.production_status || 'N/A').replace(/_/g, ' ').toUpperCase()}`
    ]

    summaryInfo.forEach(info => {
      doc.text(info, 25, yPosition)
      yPosition += 4
    })

    yPosition += 10

    // Audit Trail Header
    doc.setFont('courier', 'bold')
    doc.setFontSize(10)
    doc.text('COMPLETE AUDIT TRAIL', 20, yPosition)
    yPosition += 5

    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.text('CHRONOLOGICAL LOG OF ALL CHANGES AND ACTIVITIES (OLDEST FIRST)', 20, yPosition)
    yPosition += 10

    // Audit Entries
    if (auditTrail.length === 0) {
      doc.text('NO AUDIT RECORDS FOUND', 25, yPosition)
    } else {
      auditTrail.forEach((entry: any, index: number) => {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage()
          yPosition = 20
        }

        // Entry header with background
        doc.setFillColor(248, 248, 248)
        doc.rect(20, yPosition - 2, 170, 8, 'F')
        
        doc.setFont('courier', 'bold')
        doc.setFontSize(9)
        const entryNumber = String(index + 1).padStart(3, '0')
        doc.text(`#${entryNumber}: ${entry.action_type.replace(/_/g, ' ').toUpperCase()}`, 25, yPosition + 3)
        
        doc.setFont('courier', 'normal')
        doc.setFontSize(8)
        const timestamp = new Date(entry.created_at).toLocaleString()
        doc.text(timestamp, 160, yPosition + 3, { align: 'right' })
        
        yPosition += 10

        // Description
        doc.setFont('courier', 'normal')
        doc.setFontSize(8)
        
        // Split long descriptions into multiple lines
        const maxWidth = 165
        const descriptionLines = doc.splitTextToSize(entry.change_description, maxWidth)
        
        descriptionLines.forEach((line: string) => {
          doc.text(line, 25, yPosition)
          yPosition += 4
        })

        // Field details if available
        if (entry.field_changed || entry.old_value || entry.new_value) {
          yPosition += 2
          
          if (entry.field_changed) {
            doc.text(`FIELD MODIFIED: ${entry.field_changed.toUpperCase()}`, 30, yPosition)
            yPosition += 4
          }
          
          if (entry.old_value) {
            const oldValueLines = doc.splitTextToSize(`PREVIOUS VALUE: ${entry.old_value}`, maxWidth - 10)
            oldValueLines.forEach((line: string) => {
              doc.text(line, 30, yPosition)
              yPosition += 4
            })
          }
          
          if (entry.new_value) {
            const newValueLines = doc.splitTextToSize(`NEW VALUE: ${entry.new_value}`, maxWidth - 10)
            newValueLines.forEach((line: string) => {
              doc.text(line, 30, yPosition)
              yPosition += 4
            })
          }
        }

        // Change reason if available
        if (entry.change_reason) {
          const reasonLines = doc.splitTextToSize(`REASON: ${entry.change_reason}`, maxWidth - 10)
          reasonLines.forEach((line: string) => {
            doc.text(line, 30, yPosition)
            yPosition += 4
          })
        }

        // Changed by
        doc.setFont('courier', 'oblique')
        doc.setFontSize(7)
        doc.text(`ACTION BY: ${entry.changed_by}`, 160, yPosition, { align: 'right' })
        
        yPosition += 8

        // Separator line
        doc.setLineWidth(0.1)
        doc.setDrawColor(200, 200, 200)
        doc.line(20, yPosition, 190, yPosition)
        yPosition += 6

        doc.setFont('courier', 'normal')
        doc.setFontSize(8)
      })
    }

    // Footer on last page
    const pageHeight = doc.internal.pageSize.height
    doc.setFont('courier', 'normal')
    doc.setFontSize(7)
    doc.text('*** CONFIDENTIAL AUDIT DOCUMENT - UNICA TEXTILE MILLS ***', 105, pageHeight - 15, { align: 'center' })
    doc.text('This document contains proprietary business information and is intended for authorized personnel only.', 105, pageHeight - 10, { align: 'center' })

    // Convert to buffer and send
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', pdfBuffer.length.toString())
    res.send(pdfBuffer)
  } catch (error) {
    console.error('Error generating audit PDF:', error)
    res.status(500).json({ error: 'Failed to generate audit PDF' })
  }
}
