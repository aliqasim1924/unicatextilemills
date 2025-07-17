import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { getLogoBase64, getFallbackLogoSvg } from '@/lib/utils/logoUtils'

interface CustomerOrder {
  id: string
  internal_order_number: string
  customer_po_number: string | null
  quantity_ordered: number
  quantity_allocated: number
  due_date: string
  order_status: string
  priority_override: number
  created_at: string
  customers?: {
    name: string
    contact_person: string | null
  }
  finished_fabrics?: {
    name: string
    gsm: number
    width_meters: number
    color: string | null
    coating_type: string | null
  }
  customer_order_items?: Array<{
    id: string
    color: string
    quantity_ordered: number
    quantity_allocated: number
    unit_price?: number
    notes?: string
    finished_fabrics?: {
      name: string
      gsm: number
      width_meters: number
      coating_type: string | null
    }
  }>
}

interface CustomerOrderTemplateProps {
  orders: CustomerOrder[]
  generatedAt: string
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  logo: {
    width: 120,
    height: 60,
    objectFit: 'contain',
  },
  companyInfo: {
    alignItems: 'flex-end',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  companyTagline: {
    fontSize: 10,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 8,
  },
  summaryBox: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  summaryUnit: {
    fontSize: 8,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 20,
  },
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  col1: { width: '12%' },
  col2: { width: '15%' },
  col3: { width: '18%' },
  col4: { width: '15%' },
  col5: { width: '12%' },
  col6: { width: '10%' },
  col7: { width: '10%' },
  col8: { width: '8%' },
  
  // Fabric summary table columns
  fabricCol1: { width: '40%' },
  fabricCol2: { width: '15%' },
  fabricCol3: { width: '15%' },
  fabricCol4: { width: '15%' },
  fabricCol5: { width: '15%' },
  
  cellHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
  },
  cellText: {
    fontSize: 8,
    color: '#1f2937',
  },
  cellTextBold: {
    fontSize: 8,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  // Inline text container for count and label
  inlineText: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  statusConfirmed: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  statusInProduction: {
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  statusDelivered: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  priorityHigh: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  priorityMedium: {
    color: '#ea580c',
    fontWeight: 'bold',
  },
  priorityNormal: {
    color: '#059669',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#6b7280',
  },
})

export default function CustomerOrderTemplate({ orders, generatedAt }: CustomerOrderTemplateProps) {
  // Get logo as base64 for reliable PDF rendering
  const logoSrc = getLogoBase64() || getFallbackLogoSvg()
  
  // Calculate summary statistics
  const totalOrders = orders.length
  const totalOrderedMeters = orders.reduce((sum, order) => sum + order.quantity_ordered, 0)
  const totalAllocatedMeters = orders.reduce((sum, order) => sum + order.quantity_allocated, 0)
  const pendingOrders = orders.filter(o => o.order_status === 'pending').length
  const completedOrders = orders.filter(o => ['delivered', 'completed'].includes(o.order_status)).length

  // Calculate fabric demand summary
  const fabricDemand = orders.reduce((acc, order) => {
    if (!order.finished_fabrics) return acc
    
    const fabric = order.finished_fabrics
    const key = `${fabric.name}_${fabric.gsm}_${fabric.width_meters}_${fabric.color || 'Natural'}`
    
    if (!acc[key]) {
      acc[key] = {
        name: fabric.name,
        gsm: fabric.gsm,
        width: fabric.width_meters,
        color: fabric.color || 'Natural',
        coating: fabric.coating_type || 'N/A',
        totalOrdered: 0,
        totalAllocated: 0,
        orderCount: 0
      }
    }
    
    acc[key].totalOrdered += order.quantity_ordered
    acc[key].totalAllocated += order.quantity_allocated
    acc[key].orderCount += 1
    
    return acc
  }, {} as Record<string, any>)

  const fabricSummary = Object.values(fabricDemand)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return [styles.statusBadge, styles.statusPending]
      case 'confirmed': return [styles.statusBadge, styles.statusConfirmed]
      case 'in_production': return [styles.statusBadge, styles.statusInProduction]
      case 'production_complete':
      case 'completed': return [styles.statusBadge, styles.statusCompleted]
      case 'delivered': return [styles.statusBadge, styles.statusDelivered]
      default: return [styles.statusBadge, styles.statusPending]
    }
  }

  const getPriorityStyle = (priority: number) => {
    if (priority >= 5) return styles.priorityHigh
    if (priority >= 3) return styles.priorityMedium
    return styles.priorityNormal
  }

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const HeaderComponent = () => (
    <View style={styles.header}>
      {logoSrc && <Image style={styles.logo} src={logoSrc} />}
      <View style={styles.companyInfo}>
        <Text style={styles.companyName}>UNICA TEXTILE MILLS SA</Text>
        <Text style={styles.companyTagline}>Excellence in Textile Manufacturing</Text>
      </View>
    </View>
  )

  return (
    <Document>
      {/* First Page - Customer Orders */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <HeaderComponent />

        {/* Title */}
        <Text style={styles.title}>Customer Orders Management Report</Text>
        <Text style={styles.subtitle}>Generated on {new Date(generatedAt).toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</Text>

        {/* Summary Statistics */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Orders</Text>
            <Text style={styles.summaryValue}>{totalOrders}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Ordered</Text>
            <Text style={styles.summaryValue}>{totalOrderedMeters.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Allocated</Text>
            <Text style={styles.summaryValue}>{totalAllocatedMeters.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Pending Orders</Text>
            <Text style={styles.summaryValue}>{pendingOrders}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Completed</Text>
            <Text style={styles.summaryValue}>{completedOrders}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Allocation Rate</Text>
            <Text style={styles.summaryValue}>{Math.round((totalAllocatedMeters / totalOrderedMeters) * 100)}%</Text>
          </View>
        </View>

        {/* Customer Orders Table */}
        <Text style={styles.sectionTitle}>Customer Orders Details</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.col1}><Text style={styles.cellHeader}>Order #</Text></View>
            <View style={styles.col2}><Text style={styles.cellHeader}>Customer</Text></View>
            <View style={styles.col3}><Text style={styles.cellHeader}>Fabric</Text></View>
            <View style={styles.col4}><Text style={styles.cellHeader}>Specifications</Text></View>
            <View style={styles.col5}><Text style={styles.cellHeader}>Ordered</Text></View>
            <View style={styles.col6}><Text style={styles.cellHeader}>Allocated</Text></View>
            <View style={styles.col7}><Text style={styles.cellHeader}>Due Date</Text></View>
            <View style={styles.col8}><Text style={styles.cellHeader}>Status</Text></View>
          </View>

          {orders.map((order, index) => (
            <View key={order.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
              <View style={styles.col1}>
                <Text style={styles.cellTextBold}>{order.internal_order_number}</Text>
                {order.customer_po_number && (
                  <Text style={styles.cellText}>PO: {order.customer_po_number}</Text>
                )}
              </View>
              <View style={styles.col2}>
                <Text style={styles.cellTextBold}>{order.customers?.name || 'Unknown'}</Text>
                {order.customers?.contact_person && (
                  <Text style={styles.cellText}>{order.customers.contact_person}</Text>
                )}
              </View>
              <View style={styles.col3}>
                {order.customer_order_items && order.customer_order_items.length > 0 ? (
                  order.customer_order_items.map((item, index) => (
                    <View key={item.id} style={{ marginBottom: index < order.customer_order_items!.length - 1 ? 4 : 0 }}>
                      <Text style={styles.cellTextBold}>
                        {item.finished_fabrics?.name || order.finished_fabrics?.name || 'Unknown'}
                      </Text>
                      <Text style={styles.cellText}>Color: {item.color}</Text>
                      <Text style={styles.cellText}>{item.quantity_ordered}m</Text>
                    </View>
                  ))
                ) : (
                  <View>
                    <Text style={styles.cellTextBold}>{order.finished_fabrics?.name || 'Unknown'}</Text>
                    {order.finished_fabrics?.color && (
                      <Text style={styles.cellText}>{order.finished_fabrics.color}</Text>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.col4}>
                {order.customer_order_items && order.customer_order_items.length > 0 ? (
                  <View>
                    <Text style={styles.cellText}>
                      {order.customer_order_items[0].finished_fabrics?.gsm || order.finished_fabrics?.gsm || 'N/A'}GSM
                    </Text>
                    <Text style={styles.cellText}>
                      {order.customer_order_items[0].finished_fabrics?.width_meters || order.finished_fabrics?.width_meters || 'N/A'}m wide
                    </Text>
                    {(order.customer_order_items[0].finished_fabrics?.coating_type || order.finished_fabrics?.coating_type) && (
                      <Text style={styles.cellText}>
                        {order.customer_order_items[0].finished_fabrics?.coating_type || order.finished_fabrics?.coating_type}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={styles.cellText}>{order.finished_fabrics?.gsm || 'N/A'}GSM</Text>
                    <Text style={styles.cellText}>{order.finished_fabrics?.width_meters || 'N/A'}m wide</Text>
                    {order.finished_fabrics?.coating_type && (
                      <Text style={styles.cellText}>{order.finished_fabrics.coating_type}</Text>
                    )}
                  </View>
                )}
              </View>
              <View style={styles.col5}>
                <Text style={styles.cellTextBold}>{order.quantity_ordered}m</Text>
                <Text style={[styles.cellText, getPriorityStyle(order.priority_override)]}>
                  {order.priority_override === 0 ? 'Normal' : `Priority ${order.priority_override}`}
                </Text>
              </View>
              <View style={styles.col6}>
                <Text style={styles.cellTextBold}>{order.quantity_allocated}m</Text>
                <Text style={styles.cellText}>
                  {Math.round((order.quantity_allocated / order.quantity_ordered) * 100)}%
                </Text>
              </View>
              <View style={styles.col7}>
                <Text style={styles.cellText}>{formatDate(order.due_date)}</Text>
              </View>
              <View style={styles.col8}>
                <Text style={getStatusStyle(order.order_status)}>
                  {formatStatus(order.order_status)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Customer Orders Report • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>

      {/* Second Page - Fabric Demand Summary */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <HeaderComponent />

        {/* Title for Fabric Demand Page */}
        <Text style={styles.title}>Fabric Demand Summary</Text>
        <Text style={styles.subtitle}>Comprehensive overview of fabric requirements across all orders</Text>

        {/* Fabric Demand Summary Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.fabricCol1}><Text style={styles.cellHeader}>Fabric & Specifications</Text></View>
            <View style={styles.fabricCol2}><Text style={styles.cellHeader}>Total Ordered</Text></View>
            <View style={styles.fabricCol3}><Text style={styles.cellHeader}>Total Allocated</Text></View>
            <View style={styles.fabricCol4}><Text style={styles.cellHeader}>Remaining</Text></View>
            <View style={styles.fabricCol5}><Text style={styles.cellHeader}>Orders Count</Text></View>
          </View>

          {fabricSummary.map((fabric, index) => (
            <View key={index} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
              <View style={styles.fabricCol1}>
                <Text style={styles.cellTextBold}>{fabric.name}</Text>
                <Text style={styles.cellText}>
                  {fabric.gsm}GSM • {fabric.width}m • {fabric.color}
                </Text>
                {fabric.coating !== 'N/A' && (
                  <Text style={styles.cellText}>Coating: {fabric.coating}</Text>
                )}
              </View>
              <View style={styles.fabricCol2}>
                <Text style={styles.cellTextBold}>{fabric.totalOrdered.toLocaleString()}m</Text>
              </View>
              <View style={styles.fabricCol3}>
                <Text style={styles.cellTextBold}>{fabric.totalAllocated.toLocaleString()}m</Text>
                <Text style={styles.cellText}>
                  {Math.round((fabric.totalAllocated / fabric.totalOrdered) * 100)}%
                </Text>
              </View>
              <View style={styles.fabricCol4}>
                <Text style={styles.cellTextBold}>
                  {(fabric.totalOrdered - fabric.totalAllocated).toLocaleString()}m
                </Text>
              </View>
              <View style={styles.fabricCol5}>
                <Text style={styles.cellTextBold}>{fabric.orderCount} orders</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary Stats for Fabric Demand */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Fabric Types</Text>
            <Text style={styles.summaryValue}>{fabricSummary.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Avg Orders per Fabric</Text>
            <Text style={styles.summaryValue}>
              {fabricSummary.length > 0 ? Math.round(fabricSummary.reduce((sum, f) => sum + f.orderCount, 0) / fabricSummary.length) : 0}
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Remaining</Text>
            <Text style={styles.summaryValue}>
              {fabricSummary.reduce((sum, f) => sum + (f.totalOrdered - f.totalAllocated), 0).toLocaleString()}
            </Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Fabric Demand Summary • Page 2 of 2 • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>
    </Document>
  )
} 