'use client'

import { useState } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { DocumentIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'

// Utility function for generating reports from the reports page
export const generateReportPDF = async (reportData: any) => {
  try {
    const pdf = new jsPDF()
    const { reportType, dateRange, summary, data } = reportData

    // Add header
    pdf.setFontSize(20)
    pdf.text('Unica Textiles', 20, 30)
    pdf.setFontSize(16)
    pdf.text(`${(reportType || 'Unknown').charAt(0).toUpperCase() + (reportType || 'Unknown').slice(1)} Report`, 20, 45)
    
    // Add date range
    pdf.setFontSize(12)
    pdf.text(`Period: ${new Date(dateRange?.startDate || '').toLocaleDateString()} - ${new Date(dateRange?.endDate || '').toLocaleDateString()}`, 20, 60)
    pdf.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 20, 75)

    let yPosition = 95

    // Add summary if available
    if (summary) {
      pdf.setFontSize(14)
      pdf.text('Summary', 20, yPosition)
      yPosition += 15

      pdf.setFontSize(10)
      const summaryItems = [
        `Total Orders: ${summary.totalOrders || 0}`,
        `Total Production: ${summary.totalProduction || 0}`,
        `Total Customers: ${summary.totalCustomers || 0}`,
        `Stock Value: $${(summary.totalStockValue || 0).toLocaleString()}`,
        `Pending Orders: ${summary.pendingOrders || 0}`,
        `In Progress Production: ${summary.inProgressProduction || 0}`,
        `Low Stock Items: ${summary.lowStock || 0}`,
        `Overdue Orders: ${summary.overdueOrders || 0}`
      ]

      summaryItems.forEach((item, index) => {
        if (index % 2 === 0) {
          pdf.text(item, 20, yPosition)
        } else {
          pdf.text(item, 110, yPosition)
          yPosition += 12
        }
      })

      yPosition += 20
    }

    // Add data table based on report type
    if (Array.isArray(data) && data.length > 0) {
      pdf.setFontSize(14)
      pdf.text('Details', 20, yPosition)
      yPosition += 15

      // Table headers and data based on report type
      let headers: string[] = []
      let tableData: string[][] = []

      switch (reportType) {
        case 'orders':
          headers = ['Order Number', 'Customer', 'Product', 'Status', 'Quantity', 'Due Date']
          tableData = data.map(order => [
            order.internal_order_number || '',
            order.customers?.name || 'Unknown',
            order.finished_fabrics?.name || 'Unknown',
            order.order_status?.replace('_', ' ') || '',
            order.quantity_ordered?.toLocaleString() || '0',
            new Date(order.due_date).toLocaleDateString()
          ])
          break

        case 'production':
          headers = ['Order Number', 'Type', 'Status', 'Required', 'Produced', 'Progress']
          tableData = data.map(prod => [
            prod.internal_order_number || 'N/A',
            prod.production_type || '',
            prod.production_status?.replace('_', ' ') || '',
            prod.quantity_required?.toLocaleString() || '0',
            prod.quantity_produced?.toLocaleString() || '0',
            `${prod.quantity_required > 0 ? Math.round((prod.quantity_produced / prod.quantity_required) * 100) : 0}%`
          ])
          break

        case 'stock':
          headers = ['Item Name', 'Type', 'Current Stock', 'Minimum Stock', 'Status']
          tableData = data.map(item => {
            const currentStock = item.type === 'yarn' ? item.stock_quantity_kg : 
                               item.type === 'chemical' ? item.stock_quantity_liters : 
                               item.stock_quantity
            const minStock = item.type === 'yarn' ? item.minimum_stock_kg : 
                            item.type === 'chemical' ? item.minimum_stock_liters : 
                            item.minimum_stock
            const isLowStock = currentStock <= minStock

            return [
              item.name || item.yarn_type || item.chemical_name || '',
              item.type?.replace('_', ' ') || '',
              currentStock?.toLocaleString() || '0',
              minStock?.toLocaleString() || '0',
              isLowStock ? 'Low Stock' : 'Normal'
            ]
          })
          break

        default:
          headers = ['Item', 'Value']
          tableData = data.slice(0, 20).map((item, index) => [
            `Item ${index + 1}`,
            JSON.stringify(item).substring(0, 50) + '...'
          ])
      }

      // Draw table
      const cellHeight = 8
      const cellWidth = 25
      const startX = 20

      // Draw headers
      pdf.setFontSize(8)
      pdf.setFont(undefined, 'bold')
      headers.forEach((header, index) => {
        pdf.text(header, startX + (index * cellWidth), yPosition)
      })
      yPosition += cellHeight

      // Draw data rows
      pdf.setFont(undefined, 'normal')
      tableData.slice(0, 25).forEach(row => { // Limit to 25 rows to fit on page
        if (yPosition > 250) { // Add new page if needed
          pdf.addPage()
          yPosition = 30
        }
        
        row.forEach((cell, index) => {
          const cellText = cell.length > 20 ? cell.substring(0, 17) + '...' : cell
          pdf.text(cellText, startX + (index * cellWidth), yPosition)
        })
        yPosition += cellHeight
      })
    }

    // Add footer
    const pageCount = pdf.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      pdf.text(`Page ${i} of ${pageCount}`, 20, 285)
      pdf.text('Unica Textiles Stock Management System', 120, 285)
    }

    // Save the PDF
    const fileName = `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`
    pdf.save(fileName)

  } catch (error) {
    console.error('Error generating report PDF:', error)
    throw error
  }
}

interface PDFGeneratorProps {
  type: 'production-order' | 'customer-order' | 'stock-report' | 'management-report' | 'customer-orders-report' | 'stock-management-report' | 'production-wip-report' | 'customer-order-audit' | 'production-order-audit' | 'analytics-report' | 'overview-report' | 'orders-report' | 'production-report' | 'performance-report'
  orderId?: string
  options?: any
  buttonText?: string
  buttonClassName?: string
}

export default function PDFGenerator({ 
  type, 
  orderId, 
  options = {}, 
  buttonText,
  buttonClassName = "inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
}: PDFGeneratorProps) {
  const [generating, setGenerating] = useState(false)

  // Generate Customer Orders Report using React-PDF API
  const generateCustomerOrdersReport = async (options: any) => {
    try {
      const response = await fetch('/api/pdf/customer-orders-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ options })
      })

      if (!response.ok) {
        throw new Error('Failed to generate customer orders report PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `customer-orders-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error generating customer orders report:', error)
      throw error
    }
  }

  // Generate Stock Management Report using React-PDF API
  const generateStockManagementReport = async (options: any) => {
    try {
      const response = await fetch('/api/pdf/stock-management-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ options })
      })

      if (!response.ok) {
        throw new Error('Failed to generate stock management report PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `stock-management-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error generating stock management report:', error)
      throw error
    }
  }

  // Generate Production WIP Report using React-PDF API
  const generateProductionWIPReport = async (options: any) => {
    try {
      const response = await fetch('/api/pdf/production-wip-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ options })
      })

      if (!response.ok) {
        throw new Error('Failed to generate production WIP report PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `production-wip-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error generating production WIP report:', error)
      throw error
    }
  }

  // Generate Customer Order Audit Trail PDF
  const generateCustomerOrderAuditTrail = async (orderId: string) => {
    try {
      const response = await fetch(`/api/pdf/customer-order-audit?orderId=${orderId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch audit trail data')
      }

      const auditData = await response.json()
      
      const pdfResponse = await fetch('/api/pdf/generate-audit-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...auditData, type: 'customer_order' })
      })

      if (!pdfResponse.ok) {
        throw new Error('Failed to generate customer order audit trail PDF')
      }

      const blob = await pdfResponse.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `customer-order-audit-${auditData.order.internal_order_number}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error generating customer order audit trail:', error)
      throw error
    }
  }

  // Generate Production Order Audit Trail PDF
  const generateProductionOrderAuditTrail = async (orderId: string) => {
    try {
      const response = await fetch(`/api/pdf/production-order-audit?orderId=${orderId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch production audit trail data')
      }

      const auditData = await response.json()
      
      const pdfResponse = await fetch('/api/pdf/generate-audit-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...auditData, type: 'production_order' })
      })

      if (!pdfResponse.ok) {
        throw new Error('Failed to generate production order audit trail PDF')
      }

      const blob = await pdfResponse.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `production-order-audit-${auditData.order.internal_order_number}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Error generating production order audit trail:', error)
      throw error
    }
  }

  const generatePDF = async () => {
    try {
      setGenerating(true)

      let data: any = null
      let filename = `document-${Date.now()}`

      // Fetch data based on type
      switch (type) {
        case 'production-order':
          if (!orderId) throw new Error('Order ID required for production order PDF')
          data = await fetchProductionOrderData(orderId)
          filename = `production-order-${data.internal_order_number}`
          break
        
        case 'customer-order':
          if (!orderId) throw new Error('Order ID required for customer order PDF')
          data = await fetchCustomerOrderData(orderId)
          filename = `customer-order-${data.internal_order_number}`
          break
        
        case 'stock-report':
          data = await fetchStockData(options)
          filename = `stock-report-${new Date().toISOString().split('T')[0]}`
          break
        
        case 'management-report':
          data = await fetchDashboardData(options)
          filename = `management-report-${new Date().toISOString().split('T')[0]}`
          break
        
        case 'customer-orders-report':
          // Use React-PDF API for comprehensive report
          await generateCustomerOrdersReport(options)
          return // Exit early since download is handled in the function
        
        case 'stock-management-report':
          // Use React-PDF API for comprehensive stock report
          await generateStockManagementReport(options)
          return // Exit early since download is handled in the function
        
        case 'production-wip-report':
          // Use React-PDF API for comprehensive production WIP report
          await generateProductionWIPReport(options)
          return // Exit early since download is handled in the function
        
        case 'customer-order-audit':
          // Generate customer order audit trail PDF
          if (!orderId) throw new Error('Order ID required for customer order audit trail PDF')
          await generateCustomerOrderAuditTrail(orderId)
          return // Exit early since download is handled in the function
        
        case 'production-order-audit':
          // Generate production order audit trail PDF
          if (!orderId) throw new Error('Order ID required for production order audit trail PDF')
          await generateProductionOrderAuditTrail(orderId)
          return // Exit early since download is handled in the function
      }

      // Generate PDF based on type
      let pdf: jsPDF
      switch (type) {
        case 'production-order':
          pdf = generateProductionOrderPDF(data)
          break
        case 'customer-order':
          pdf = generateCustomerOrderPDF(data, options.type || 'confirmation')
          break
        case 'stock-report':
          pdf = generateStockReportPDF(data, options)
          break
        case 'management-report':
          pdf = generateManagementReportPDF(data, options)
          break
        default:
          throw new Error('Invalid PDF type')
      }

      // Download the PDF
      pdf.save(`${filename}.pdf`)

    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Fetch production order data
  const fetchProductionOrderData = async (orderId: string) => {
    const { data, error } = await supabase
      .from('production_orders')
      .select(`
        *,
        customer_orders (
          *,
          customers (
            name,
            email,
            phone,
            address
          )
        ),
        base_fabrics (
          name,
          gsm,
          width_meters,
          color,
          stock_quantity
        ),
        finished_fabrics (
          name,
          gsm,
          width_meters,
          color,
          coating_type,
          stock_quantity
        )
      `)
      .eq('id', orderId)
      .single()

    if (error) throw error
    return data
  }

  // Fetch customer order data  
  const fetchCustomerOrderData = async (orderId: string) => {
    const { data, error } = await supabase
      .from('customer_orders')
      .select(`
        *,
        customers (
          name,
          email,
          phone,
          address,
          contact_person
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

    if (error) throw error
    return data
  }

  // Fetch stock data
  const fetchStockData = async (options: any) => {
    const stockData: any = {}

    const [baseFabricsResponse, finishedFabricsResponse, movementsResponse] = await Promise.all([
      supabase.from('base_fabrics').select('*').order('name'),
      supabase.from('finished_fabrics').select('*').order('name'),
      supabase.from('stock_movements').select(`
        *,
        base_fabrics (name),
        finished_fabrics (name)
      `).order('created_at', { ascending: false }).limit(20)
    ])

    stockData.baseFabrics = baseFabricsResponse.data || []
    stockData.finishedFabrics = finishedFabricsResponse.data || []
    stockData.recentMovements = movementsResponse.data || []

    return stockData
  }

  // Fetch dashboard data
  const fetchDashboardData = async (options: any) => {
    const dashboardData: any = {}

    const [ordersResponse, productionResponse] = await Promise.all([
      supabase.from('customer_orders').select(`
        *,
        customers (name),
        finished_fabrics (name)
      `).order('created_at', { ascending: false }),
      supabase.from('production_orders').select(`
        *,
        customer_orders (customers (name)),
        base_fabrics (name),
        finished_fabrics (name)
      `).order('created_at', { ascending: false })
    ])

    dashboardData.customerOrders = ordersResponse.data || []
    dashboardData.productionOrders = productionResponse.data || []

    return dashboardData
  }

  // Generate Production Order PDF
  const generateProductionOrderPDF = (order: any): jsPDF => {
    const pdf = new jsPDF()

    // Company Header
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('UNICA TEXTILE MILLS', 20, 25)
    
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Industrial Area, Textile City', 20, 35)
    pdf.text('Phone: +1 (555) 123-4567', 20, 42)
    pdf.text('Email: info@unicatextiles.com', 20, 49)

    // Document Title
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PRODUCTION WORK ORDER', 20, 70)

    // Order Details
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('ORDER DETAILS', 20, 90)
    
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Order Number: ${order.internal_order_number}`, 20, 105)
    pdf.text(`Production Type: ${order.production_type?.toUpperCase()}`, 20, 115)
    pdf.text(`Status: ${order.production_status?.replace('_', ' ').toUpperCase()}`, 20, 125)
    pdf.text(`Priority: ${order.priority_level >= 5 ? 'URGENT' : order.priority_level >= 3 ? 'HIGH' : 'NORMAL'}`, 20, 135)

    // Timeline
    pdf.text(`Created: ${formatDate(order.created_at)}`, 120, 105)
    pdf.text(`Target Date: ${order.target_completion_date ? formatDate(order.target_completion_date) : 'Not set'}`, 120, 115)

    // Material Specifications
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('MATERIAL SPECIFICATIONS', 20, 155)

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    let yPos = 170

    if (order.production_type === 'weaving' && order.base_fabrics) {
      pdf.text(`Base Fabric: ${order.base_fabrics.name}`, 20, yPos)
      pdf.text(`GSM: ${order.base_fabrics.gsm}`, 20, yPos + 10)
      pdf.text(`Width: ${order.base_fabrics.width_meters}m`, 20, yPos + 20)
      pdf.text(`Color: ${order.base_fabrics.color || 'Natural'}`, 120, yPos)
    }

    if (order.production_type === 'coating' && order.finished_fabrics) {
      pdf.text(`Finished Fabric: ${order.finished_fabrics.name}`, 20, yPos)
      pdf.text(`GSM: ${order.finished_fabrics.gsm}`, 20, yPos + 10)
      pdf.text(`Width: ${order.finished_fabrics.width_meters}m`, 20, yPos + 20)
      pdf.text(`Coating: ${order.finished_fabrics.coating_type || 'Standard'}`, 120, yPos)
      pdf.text(`Color: ${order.finished_fabrics.color || 'Natural'}`, 120, yPos + 10)
    }

    // Production Summary
    yPos += 50
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PRODUCTION SUMMARY', 20, yPos)

    yPos += 15
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Quantity Required: ${order.quantity_required}m`, 20, yPos)
    pdf.text(`Quantity Produced: ${order.quantity_produced}m`, 20, yPos + 10)
    pdf.text(`Progress: ${Math.round((order.quantity_produced / order.quantity_required) * 100)}%`, 20, yPos + 20)

    // Notes
    if (order.notes) {
      yPos += 40
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text('NOTES', 20, yPos)
      
      yPos += 15
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      const noteLines = pdf.splitTextToSize(order.notes, 170)
      pdf.text(noteLines, 20, yPos)
    }

    return pdf
  }

  // Generate Customer Order PDF
  const generateCustomerOrderPDF = (order: any, type: string): jsPDF => {
    const pdf = new jsPDF()

    // Company Header
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('UNICA TEXTILE MILLS', 20, 25)
    
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Industrial Area, Textile City', 20, 35)
    pdf.text('Phone: +1 (555) 123-4567', 20, 42)

    // Document Title
    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    const title = type === 'invoice' ? 'INVOICE' : 'ORDER CONFIRMATION'
    pdf.text(title, 20, 70)

    // Order & Customer Details
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('ORDER INFORMATION', 20, 90)
    
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Order Number: ${order.internal_order_number}`, 20, 105)
    pdf.text(`Customer PO: ${order.customer_po_number || 'N/A'}`, 20, 115)
    pdf.text(`Order Date: ${formatDate(order.created_at)}`, 20, 125)
    pdf.text(`Due Date: ${formatDate(order.due_date)}`, 20, 135)

    // Customer Information
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('CUSTOMER DETAILS', 120, 90)
    
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Customer: ${order.customers?.name || 'N/A'}`, 120, 105)
    pdf.text(`Contact: ${order.customers?.contact_person || 'N/A'}`, 120, 115)
    pdf.text(`Phone: ${order.customers?.phone || 'N/A'}`, 120, 125)

    // Product Details
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PRODUCT DETAILS', 20, 165)

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Product: ${order.finished_fabrics?.name || 'N/A'}`, 20, 180)
    pdf.text(`GSM: ${order.finished_fabrics?.gsm || 'N/A'}`, 20, 190)
    pdf.text(`Width: ${order.finished_fabrics?.width_meters || 'N/A'}m`, 20, 200)
    pdf.text(`Color: ${order.finished_fabrics?.color || 'Natural'}`, 120, 180)
    pdf.text(`Coating: ${order.finished_fabrics?.coating_type || 'Standard'}`, 120, 190)

    // Order Summary
    pdf.text(`Quantity Ordered: ${order.quantity_ordered}m`, 20, 220)
    pdf.text(`Quantity Allocated: ${order.quantity_allocated}m`, 20, 230)
    pdf.text(`Status: ${order.order_status?.replace('_', ' ').toUpperCase()}`, 20, 240)

    return pdf
  }

  // Generate Stock Report PDF
  const generateStockReportPDF = (data: any, options: any): jsPDF => {
    const pdf = new jsPDF()

    // Header
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('STOCK REPORT', 20, 25)
    
    pdf.setFontSize(10)
    pdf.text(`Generated: ${formatDate(new Date().toISOString())}`, 20, 35)

    let yPos = 60

    // Base Fabrics
    if (data.baseFabrics?.length > 0) {
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.text('BASE FABRICS', 20, yPos)
      yPos += 15

      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      data.baseFabrics.forEach((fabric: any) => {
        pdf.text(`${fabric.name} - ${fabric.stock_quantity}m (${fabric.gsm}GSM)`, 20, yPos)
        yPos += 10
      })
      yPos += 10
    }

    // Finished Fabrics
    if (data.finishedFabrics?.length > 0) {
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'bold')
      pdf.text('FINISHED FABRICS', 20, yPos)
      yPos += 15

      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      data.finishedFabrics.forEach((fabric: any) => {
        pdf.text(`${fabric.name} - ${fabric.stock_quantity}m (${fabric.gsm}GSM)`, 20, yPos)
        yPos += 10
      })
    }

    return pdf
  }

  // Generate Management Report PDF
  const generateManagementReportPDF = (data: any, options: any): jsPDF => {
    const pdf = new jsPDF()

    // Header
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('MANAGEMENT REPORT', 20, 25)
    
    pdf.setFontSize(10)
    pdf.text(`Generated: ${formatDate(new Date().toISOString())}`, 20, 35)

    let yPos = 60

    // Order Statistics
    const orders = data.customerOrders || []
    const pendingOrders = orders.filter((o: any) => o.order_status === 'pending').length
    const completedOrders = orders.filter((o: any) => o.order_status === 'delivered').length

    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('ORDER SUMMARY', 20, yPos)
    yPos += 15

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Total Orders: ${orders.length}`, 20, yPos)
    pdf.text(`Pending Orders: ${pendingOrders}`, 20, yPos + 10)
    pdf.text(`Completed Orders: ${completedOrders}`, 20, yPos + 20)

    // Production Statistics
    yPos += 40
    const production = data.productionOrders || []
    const activeProduction = production.filter((p: any) => ['pending', 'in_progress'].includes(p.production_status)).length
    const completedProduction = production.filter((p: any) => p.production_status === 'completed').length

    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text('PRODUCTION SUMMARY', 20, yPos)
    yPos += 15

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Total Production Orders: ${production.length}`, 20, yPos)
    pdf.text(`Active Production: ${activeProduction}`, 20, yPos + 10)
    pdf.text(`Completed Production: ${completedProduction}`, 20, yPos + 20)

    return pdf
  }

  // Format date helper
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getButtonText = () => {
    if (generating) return 'Generating...'
    if (buttonText) return buttonText
    
    switch (type) {
      case 'production-order': return 'Production Order PDF'
      case 'customer-order': return 'Order PDF'
      case 'stock-report': return 'Stock Report PDF'
      case 'management-report': return 'Management Report PDF'
      case 'customer-orders-report': return 'Orders Report PDF'
      case 'customer-order-audit': return 'Audit Trail PDF'
      case 'production-order-audit': return 'Audit Trail PDF'
      default: return 'Generate PDF'
    }
  }

  return (
    <button
      onClick={generatePDF}
      disabled={generating}
      className={buttonClassName}
      title={`Generate ${type.replace('-', ' ')} PDF`}
    >
      <DocumentIcon className="h-4 w-4 mr-2" />
      {getButtonText()}
    </button>
  )
} 