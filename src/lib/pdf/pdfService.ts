import { supabase } from '@/lib/supabase/client'

// PDF Generation Service for Unica Textile Mills
export class PDFService {
  
  // Company information
  static readonly COMPANY_INFO = {
    name: 'UNICA TEXTILE MILLS',
    address: 'Industrial Area, Textile City',
    phone: '+1 (555) 123-4567',
    email: 'info@unicatextiles.com',
    website: 'www.unicatextiles.com',
    logo: '/images/company-logo.png'
  }

  // Generate Production Order PDF
  static async generateProductionOrder(orderId: string): Promise<Blob> {
    try {
      const orderData = await this.fetchProductionOrderData(orderId)
      
      // Use React-PDF for high-quality production documents
      const response = await fetch('/api/pdf/production-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      })

      if (!response.ok) {
        throw new Error('Failed to generate production order PDF')
      }

      return await response.blob()
    } catch (error) {
      console.error('Error generating production order PDF:', error)
      throw error
    }
  }

  // Generate Customer Order PDF (Invoice/Confirmation)
  static async generateCustomerOrder(orderId: string, type: 'invoice' | 'confirmation' = 'confirmation'): Promise<Blob> {
    try {
      const orderData = await this.fetchCustomerOrderData(orderId)
      
      const response = await fetch('/api/pdf/customer-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...orderData, type })
      })

      if (!response.ok) {
        throw new Error('Failed to generate customer order PDF')
      }

      return await response.blob()
    } catch (error) {
      console.error('Error generating customer order PDF:', error)
      throw error
    }
  }

  // Generate Stock Report PDF
  static async generateStockReport(options?: {
    includeBaseFabrics?: boolean
    includeFinishedFabrics?: boolean
    lowStockOnly?: boolean
    dateRange?: { from: string; to: string }
  }): Promise<Blob> {
    try {
      const stockData = await this.fetchStockData(options)
      
      const response = await fetch('/api/pdf/stock-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stockData, options })
      })

      if (!response.ok) {
        throw new Error('Failed to generate stock report PDF')
      }

      return await response.blob()
    } catch (error) {
      console.error('Error generating stock report PDF:', error)
      throw error
    }
  }

  // Generate Management Dashboard Report PDF
  static async generateManagementReport(options?: {
    dateRange?: { from: string; to: string }
    includeProduction?: boolean
    includeOrders?: boolean
    includeFinancials?: boolean
  }): Promise<Blob> {
    try {
      const dashboardData = await this.fetchDashboardData(options)
      
      const response = await fetch('/api/pdf/management-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dashboardData, options })
      })

      if (!response.ok) {
        throw new Error('Failed to generate management report PDF')
      }

      return await response.blob()
    } catch (error) {
      console.error('Error generating management report PDF:', error)
      throw error
    }
  }

  // Generate Customer Order Audit Trail PDF
  static async generateCustomerOrderAuditTrail(orderId: string): Promise<Blob> {
    try {
      const response = await fetch(`/api/pdf/customer-order-audit?orderId=${orderId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch audit trail data')
      }

      const auditData = await response.json()
      
      // Generate the PDF using a simple method for audit trails
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

      return await pdfResponse.blob()
    } catch (error) {
      console.error('Error generating customer order audit trail PDF:', error)
      throw error
    }
  }

  // Generate Production Order Audit Trail PDF
  static async generateProductionOrderAuditTrail(orderId: string): Promise<Blob> {
    try {
      const response = await fetch(`/api/pdf/production-order-audit?orderId=${orderId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch production audit trail data')
      }

      const auditData = await response.json()
      
      // Generate the PDF using a simple method for audit trails
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

      return await pdfResponse.blob()
    } catch (error) {
      console.error('Error generating production order audit trail PDF:', error)
      throw error
    }
  }

  // Download blob as PDF file
  static downloadPDF(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  // Fetch production order data with all related information
  private static async fetchProductionOrderData(orderId: string) {
    const { data: order, error } = await supabase
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
          stock_quantity,
          base_fabrics (
            name,
            gsm,
            width_meters,
            color
          )
        )
      `)
      .eq('id', orderId)
      .single()

    if (error) throw error
    return order
  }

  // Fetch customer order data with all related information
  private static async fetchCustomerOrderData(orderId: string) {
    const { data: order, error } = await supabase
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

    // Get related production orders
    const { data: productionOrders } = await supabase
      .from('production_orders')
      .select(`
        internal_order_number,
        production_type,
        production_status,
        quantity_required,
        quantity_produced,
        target_completion_date
      `)
      .eq('customer_order_id', orderId)

    return { ...order, production_orders: productionOrders || [] }
  }

  // Fetch comprehensive stock data
  private static async fetchStockData(options?: any) {
    const stockData: any = {}

    if (options?.includeBaseFabrics !== false) {
      const { data: baseFabrics, error: baseError } = await supabase
        .from('base_fabrics')
        .select('*')
        .order('name')

      if (baseError) throw baseError
      stockData.baseFabrics = baseFabrics
    }

    if (options?.includeFinishedFabrics !== false) {
      const { data: finishedFabrics, error: finishedError } = await supabase
        .from('finished_fabrics')
        .select(`
          *,
          base_fabrics (
            name,
            gsm,
            width_meters,
            color
          )
        `)
        .order('name')

      if (finishedError) throw finishedError
      stockData.finishedFabrics = finishedFabrics
    }

    // Get recent stock movements
    const { data: stockMovements, error: movementError } = await supabase
      .from('stock_movements')
      .select(`
        *,
        base_fabrics (name),
        finished_fabrics (name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (movementError) throw movementError
    stockData.recentMovements = stockMovements

    return stockData
  }

  // Fetch comprehensive dashboard data
  private static async fetchDashboardData(options?: any) {
    const dashboardData: any = {}

    // Production statistics
    if (options?.includeProduction !== false) {
      const { data: productionOrders, error: prodError } = await supabase
        .from('production_orders')
        .select(`
          *,
          customer_orders (
            customers (name)
          ),
          base_fabrics (name),
          finished_fabrics (name)
        `)
        .order('created_at', { ascending: false })

      if (prodError) throw prodError
      dashboardData.productionOrders = productionOrders
    }

    // Order statistics
    if (options?.includeOrders !== false) {
      const { data: customerOrders, error: orderError } = await supabase
        .from('customer_orders')
        .select(`
          *,
          customers (name),
          finished_fabrics (name)
        `)
        .order('created_at', { ascending: false })

      if (orderError) throw orderError
      dashboardData.customerOrders = customerOrders
    }

    // Stock summary
    const { data: stockSummary, error: stockError } = await supabase
      .rpc('get_stock_summary')

    if (!stockError && stockSummary) {
      dashboardData.stockSummary = stockSummary
    }

    return dashboardData
  }

  // Utility function to format currency
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  // Utility function to format date
  static formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // Utility function to get status color for documents
  static getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'pending': '#F59E0B',
      'confirmed': '#3B82F6',
      'in_production': '#6366F1',
      'production_complete': '#10B981',
      'ready_for_dispatch': '#8B5CF6',
      'dispatched': '#F97316',
      'delivered': '#059669',
      'cancelled': '#EF4444',
      'completed': '#10B981',
      'on_hold': '#EF4444',
      'waiting_materials': '#F59E0B'
    }
    return colors[status] || '#6B7280'
  }
}

export default PDFService 