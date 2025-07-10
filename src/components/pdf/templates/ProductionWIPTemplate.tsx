import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { getLogoBase64, getFallbackLogoSvg } from '@/lib/utils/logoUtils'

interface ProductionOrder {
  id: string
  internal_order_number: string
  production_type: 'weaving' | 'coating'
  customer_order_id: string | null
  base_fabric_id: string | null
  finished_fabric_id: string | null
  quantity_required: number
  quantity_produced: number
  production_status: string
  priority_level: number
  production_sequence: number | null
  planned_start_date: string | null
  planned_end_date: string | null
  target_completion_date: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  linked_production_order_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customer_orders?: {
    internal_order_number: string
    customers: {
      name: string
    }
  } | null
  base_fabrics?: {
    name: string
    stock_quantity: number
  } | null
  finished_fabrics?: {
    name: string
    stock_quantity: number
  } | null
}

interface ProductionWIPTemplateProps {
  data: {
    productionOrders: ProductionOrder[]
  }
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
  kpiGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: '#f1f5f9',
    padding: 15,
    borderRadius: 8,
  },
  kpiBox: {
    alignItems: 'center',
    flex: 1,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  kpiLabel: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
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
    break: false,
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  // Production table columns
  col1: { width: '15%' },
  col2: { width: '20%' },
  col3: { width: '15%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  col6: { width: '10%' },
  col7: { width: '10%' },
  
  // Analysis columns
  analysisCol1: { width: '30%' },
  analysisCol2: { width: '20%' },
  analysisCol3: { width: '15%' },
  analysisCol4: { width: '15%' },
  analysisCol5: { width: '20%' },
  
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
  statusPending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  statusInProgress: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  statusWaiting: {
    backgroundColor: '#fed7aa',
    color: '#c2410c',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
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
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginTop: 2,
  },
  progressFill: {
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
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

export default function ProductionWIPTemplate({ data, generatedAt }: ProductionWIPTemplateProps) {
  // Get logo as base64 for reliable PDF rendering
  const logoSrc = getLogoBase64() || getFallbackLogoSvg()
  
  const { productionOrders } = data

  // Calculate summary statistics
  const totalOrders = productionOrders.length
  const weavingOrders = productionOrders.filter(o => o.production_type === 'weaving')
  const coatingOrders = productionOrders.filter(o => o.production_type === 'coating')
  
  // Status breakdown
  const pendingOrders = productionOrders.filter(o => o.production_status === 'pending')
  const inProgressOrders = productionOrders.filter(o => o.production_status === 'in_progress')
  const waitingOrders = productionOrders.filter(o => o.production_status === 'waiting_materials')
  const completedOrders = productionOrders.filter(o => o.production_status === 'completed')
  
  // Customer orders vs Stock building
  const customerOrders = productionOrders.filter(o => o.customer_order_id !== null)
  const stockOrders = productionOrders.filter(o => o.customer_order_id === null)
  
  // Production volumes
  const totalRequired = productionOrders.reduce((sum, o) => sum + o.quantity_required, 0)
  const totalProduced = productionOrders.reduce((sum, o) => sum + o.quantity_produced, 0)
  
  // WIP Analysis
  const wipOrders = productionOrders.filter(o => 
    ['pending', 'in_progress', 'waiting_materials'].includes(o.production_status)
  )
  const wipValue = wipOrders.reduce((sum, o) => sum + o.quantity_required, 0)
  
  // Overdue orders
  const now = new Date()
  const overdueOrders = productionOrders.filter(o => 
    o.target_completion_date && 
    new Date(o.target_completion_date) < now && 
    o.production_status !== 'completed'
  )

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not Set'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return styles.statusPending
      case 'in_progress': return styles.statusInProgress
      case 'waiting_materials': return styles.statusWaiting
      case 'completed': return styles.statusCompleted
      default: return styles.statusPending
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

  const getProgressPercentage = (order: ProductionOrder) => {
    if (order.quantity_required === 0) return 0
    return Math.min(100, Math.round((order.quantity_produced / order.quantity_required) * 100))
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
      {/* Page 1: Production Dashboard */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <HeaderComponent />

        <Text style={styles.title}>Production & Work-In-Progress Report</Text>
        <Text style={styles.subtitle}>Comprehensive production monitoring and WIP analysis</Text>

        {/* Executive Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Orders</Text>
            <Text style={styles.summaryValue}>{totalOrders}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>In Progress</Text>
            <Text style={styles.summaryValue}>{inProgressOrders.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>WIP Value</Text>
            <Text style={styles.summaryValue}>{wipValue.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Completion Rate</Text>
            <Text style={styles.summaryValue}>{totalRequired > 0 ? Math.round((totalProduced / totalRequired) * 100) : 0}%</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Overdue Orders</Text>
            <Text style={styles.summaryValue}>{overdueOrders.length}</Text>
          </View>
        </View>

        {/* Key Performance Indicators */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{weavingOrders.length}</Text>
            <Text style={styles.kpiLabel}>Weaving Orders</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{coatingOrders.length}</Text>
            <Text style={styles.kpiLabel}>Coating Orders</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{customerOrders.length}</Text>
            <Text style={styles.kpiLabel}>Customer Orders</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{stockOrders.length}</Text>
            <Text style={styles.kpiLabel}>Stock Building</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>{waitingOrders.length}</Text>
            <Text style={styles.kpiLabel}>Waiting Materials</Text>
          </View>
        </View>

        {/* Current WIP Status */}
        <Text style={styles.sectionTitle}>Work-In-Progress Status Overview</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.col1}><Text style={styles.cellHeader}>Order #</Text></View>
            <View style={styles.col2}><Text style={styles.cellHeader}>Type & Material</Text></View>
            <View style={styles.col3}><Text style={styles.cellHeader}>Customer/Purpose</Text></View>
            <View style={styles.col4}><Text style={styles.cellHeader}>Progress</Text></View>
            <View style={styles.col5}><Text style={styles.cellHeader}>Status</Text></View>
            <View style={styles.col6}><Text style={styles.cellHeader}>Priority</Text></View>
            <View style={styles.col7}><Text style={styles.cellHeader}>Target Date</Text></View>
          </View>

          {wipOrders.slice(0, 15).map((order, index) => (
            <View key={order.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
              <View style={styles.col1}>
                <Text style={styles.cellTextBold}>{order.internal_order_number}</Text>
              </View>
              <View style={styles.col2}>
                <Text style={styles.cellTextBold}>{order.production_type.toUpperCase()}</Text>
                <Text style={styles.cellText}>
                  {order.production_type === 'weaving' 
                    ? order.base_fabrics?.name 
                    : order.finished_fabrics?.name}
                </Text>
              </View>
              <View style={styles.col3}>
                {order.customer_order_id ? (
                  <>
                    <Text style={styles.cellTextBold}>Customer Order</Text>
                    <Text style={styles.cellText}>
                      {order.customer_orders?.customers?.name || 'Unknown'}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.cellText}>Stock Building</Text>
                )}
              </View>
              <View style={styles.col4}>
                <Text style={styles.cellText}>
                  {order.quantity_produced}/{order.quantity_required}m
                </Text>
                <Text style={styles.cellText}>({getProgressPercentage(order)}%)</Text>
              </View>
              <View style={styles.col5}>
                <Text style={getStatusStyle(order.production_status)}>
                  {formatStatus(order.production_status)}
                </Text>
              </View>
              <View style={styles.col6}>
                <Text style={getPriorityStyle(order.priority_level)}>
                  {order.priority_level === 0 ? 'Normal' : `Priority ${order.priority_level}`}
                </Text>
              </View>
              <View style={styles.col7}>
                <Text style={styles.cellText}>{formatDate(order.target_completion_date)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Production & WIP Report • Page 1 of 4 • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>

      {/* Page 2: Weaving Operations */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <HeaderComponent />

        <Text style={styles.title}>Weaving Operations Analysis</Text>
        <Text style={styles.subtitle}>Base fabric production monitoring and performance</Text>

        {/* Weaving Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Active Orders</Text>
            <Text style={styles.summaryValue}>{weavingOrders.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Required Volume</Text>
            <Text style={styles.summaryValue}>
              {weavingOrders.reduce((sum, o) => sum + o.quantity_required, 0).toLocaleString()}
            </Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Produced Volume</Text>
            <Text style={styles.summaryValue}>
              {weavingOrders.reduce((sum, o) => sum + o.quantity_produced, 0).toLocaleString()}
            </Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Efficiency</Text>
            <Text style={styles.summaryValue}>
              {weavingOrders.reduce((sum, o) => sum + o.quantity_required, 0) > 0 
                ? Math.round((weavingOrders.reduce((sum, o) => sum + o.quantity_produced, 0) / weavingOrders.reduce((sum, o) => sum + o.quantity_required, 0)) * 100)
                : 0}%
            </Text>
          </View>
        </View>

        {/* Weaving Orders Table */}
        <Text style={styles.sectionTitle}>Active Weaving Production Orders</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.col1}><Text style={styles.cellHeader}>Order #</Text></View>
            <View style={styles.col2}><Text style={styles.cellHeader}>Base Fabric</Text></View>
            <View style={styles.col3}><Text style={styles.cellHeader}>Customer/Purpose</Text></View>
            <View style={styles.col4}><Text style={styles.cellHeader}>Required</Text></View>
            <View style={styles.col5}><Text style={styles.cellHeader}>Produced</Text></View>
            <View style={styles.col6}><Text style={styles.cellHeader}>Status</Text></View>
            <View style={styles.col7}><Text style={styles.cellHeader}>Target Date</Text></View>
          </View>

          {weavingOrders.map((order, index) => (
            <View key={order.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
              <View style={styles.col1}>
                <Text style={styles.cellTextBold}>{order.internal_order_number}</Text>
                {order.linked_production_order_id && (
                  <Text style={styles.cellText}>↗ Linked</Text>
                )}
              </View>
              <View style={styles.col2}>
                <Text style={styles.cellTextBold}>{order.base_fabrics?.name || 'Unknown'}</Text>
                <Text style={styles.cellText}>Current: {order.base_fabrics?.stock_quantity || 0}m</Text>
              </View>
              <View style={styles.col3}>
                {order.customer_order_id ? (
                  <>
                    <Text style={styles.cellTextBold}>Customer</Text>
                    <Text style={styles.cellText}>
                      {order.customer_orders?.customers?.name || 'Unknown'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cellTextBold}>Stock Building</Text>
                    <Text style={styles.cellText}>Inventory</Text>
                  </>
                )}
              </View>
              <View style={styles.col4}>
                <Text style={styles.cellTextBold}>{order.quantity_required.toLocaleString()}m</Text>
              </View>
              <View style={styles.col5}>
                <Text style={styles.cellTextBold}>{order.quantity_produced.toLocaleString()}m</Text>
                <Text style={styles.cellText}>({getProgressPercentage(order)}%)</Text>
              </View>
              <View style={styles.col6}>
                <Text style={getStatusStyle(order.production_status)}>
                  {formatStatus(order.production_status)}
                </Text>
              </View>
              <View style={styles.col7}>
                <Text style={styles.cellText}>{formatDate(order.target_completion_date)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Weaving Operations • Page 2 of 4 • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>

      {/* Page 3: Coating Operations */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <HeaderComponent />

        <Text style={styles.title}>Coating Operations Analysis</Text>
        <Text style={styles.subtitle}>Finished fabric production and coating process monitoring</Text>

        {/* Coating Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Active Orders</Text>
            <Text style={styles.summaryValue}>{coatingOrders.length}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Required Volume</Text>
            <Text style={styles.summaryValue}>
              {coatingOrders.reduce((sum, o) => sum + o.quantity_required, 0).toLocaleString()}
            </Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Produced Volume</Text>
            <Text style={styles.summaryValue}>
              {coatingOrders.reduce((sum, o) => sum + o.quantity_produced, 0).toLocaleString()}
            </Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Efficiency</Text>
            <Text style={styles.summaryValue}>
              {coatingOrders.reduce((sum, o) => sum + o.quantity_required, 0) > 0 
                ? Math.round((coatingOrders.reduce((sum, o) => sum + o.quantity_produced, 0) / coatingOrders.reduce((sum, o) => sum + o.quantity_required, 0)) * 100)
                : 0}%
            </Text>
          </View>
        </View>

        {/* Coating Orders Table */}
        <Text style={styles.sectionTitle}>Active Coating Production Orders</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.col1}><Text style={styles.cellHeader}>Order #</Text></View>
            <View style={styles.col2}><Text style={styles.cellHeader}>Finished Fabric</Text></View>
            <View style={styles.col3}><Text style={styles.cellHeader}>Customer/Purpose</Text></View>
            <View style={styles.col4}><Text style={styles.cellHeader}>Required</Text></View>
            <View style={styles.col5}><Text style={styles.cellHeader}>Produced</Text></View>
            <View style={styles.col6}><Text style={styles.cellHeader}>Status</Text></View>
            <View style={styles.col7}><Text style={styles.cellHeader}>Target Date</Text></View>
          </View>

          {coatingOrders.map((order, index) => (
            <View key={order.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
              <View style={styles.col1}>
                <Text style={styles.cellTextBold}>{order.internal_order_number}</Text>
                {order.linked_production_order_id && (
                  <Text style={styles.cellText}>↙ Dependent</Text>
                )}
              </View>
              <View style={styles.col2}>
                <Text style={styles.cellTextBold}>{order.finished_fabrics?.name || 'Unknown'}</Text>
                <Text style={styles.cellText}>Current: {order.finished_fabrics?.stock_quantity || 0}m</Text>
              </View>
              <View style={styles.col3}>
                {order.customer_order_id ? (
                  <>
                    <Text style={styles.cellTextBold}>Customer</Text>
                    <Text style={styles.cellText}>
                      {order.customer_orders?.customers?.name || 'Unknown'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cellTextBold}>Stock Building</Text>
                    <Text style={styles.cellText}>Inventory</Text>
                  </>
                )}
              </View>
              <View style={styles.col4}>
                <Text style={styles.cellTextBold}>{order.quantity_required.toLocaleString()}m</Text>
              </View>
              <View style={styles.col5}>
                <Text style={styles.cellTextBold}>{order.quantity_produced.toLocaleString()}m</Text>
                <Text style={styles.cellText}>({getProgressPercentage(order)}%)</Text>
              </View>
              <View style={styles.col6}>
                <Text style={getStatusStyle(order.production_status)}>
                  {formatStatus(order.production_status)}
                </Text>
              </View>
              <View style={styles.col7}>
                <Text style={styles.cellText}>{formatDate(order.target_completion_date)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Coating Operations • Page 3 of 4 • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>

      {/* Page 4: Order Type Analysis */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <HeaderComponent />

        <Text style={styles.title}>Order Type & Strategic Analysis</Text>
        <Text style={styles.subtitle}>Customer orders vs. stock building analysis and recommendations</Text>

        {/* Order Type Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Customer Orders</Text>
            <Text style={styles.summaryValue}>{customerOrders.length}</Text>
            <Text style={styles.summaryUnit}>orders</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Stock Building</Text>
            <Text style={styles.summaryValue}>{stockOrders.length}</Text>
            <Text style={styles.summaryUnit}>orders</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Customer Ratio</Text>
            <Text style={styles.summaryValue}>
              {totalOrders > 0 ? Math.round((customerOrders.length / totalOrders) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Stock Ratio</Text>
            <Text style={styles.summaryValue}>
              {totalOrders > 0 ? Math.round((stockOrders.length / totalOrders) * 100) : 0}%
            </Text>
          </View>
        </View>

        {/* Order Analysis Table */}
        <Text style={styles.sectionTitle}>Strategic Order Analysis - Customer vs. Inventory Building</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.analysisCol1}><Text style={styles.cellHeader}>Order Details</Text></View>
            <View style={styles.analysisCol2}><Text style={styles.cellHeader}>Type & Purpose</Text></View>
            <View style={styles.analysisCol3}><Text style={styles.cellHeader}>Volume</Text></View>
            <View style={styles.analysisCol4}><Text style={styles.cellHeader}>Progress</Text></View>
            <View style={styles.analysisCol5}><Text style={styles.cellHeader}>Business Impact</Text></View>
          </View>

          {productionOrders.slice(0, 20).map((order, index) => (
            <View key={order.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
              <View style={styles.analysisCol1}>
                <Text style={styles.cellTextBold}>{order.internal_order_number}</Text>
                <Text style={styles.cellText}>{order.production_type.toUpperCase()}</Text>
                <Text style={styles.cellText}>
                  {order.production_type === 'weaving' 
                    ? order.base_fabrics?.name 
                    : order.finished_fabrics?.name}
                </Text>
              </View>
              <View style={styles.analysisCol2}>
                {order.customer_order_id ? (
                  <>
                    <Text style={styles.cellTextBold}>CUSTOMER ORDER</Text>
                    <Text style={styles.cellText}>
                      {order.customer_orders?.customers?.name || 'Unknown Customer'}
                    </Text>
                    <Text style={styles.cellText}>
                      Ref: {order.customer_orders?.internal_order_number || 'N/A'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cellTextBold}>STOCK BUILDING</Text>
                    <Text style={styles.cellText}>Inventory Replenishment</Text>
                    <Text style={styles.cellText}>Strategic Stock</Text>
                  </>
                )}
              </View>
              <View style={styles.analysisCol3}>
                <Text style={styles.cellTextBold}>{order.quantity_required.toLocaleString()}m</Text>
                <Text style={styles.cellText}>Target</Text>
              </View>
              <View style={styles.analysisCol4}>
                <Text style={styles.cellTextBold}>{getProgressPercentage(order)}%</Text>
                <Text style={styles.cellText}>
                  {order.quantity_produced}/{order.quantity_required}m
                </Text>
                <Text style={getStatusStyle(order.production_status)}>
                  {formatStatus(order.production_status)}
                </Text>
              </View>
              <View style={styles.analysisCol5}>
                {order.customer_order_id ? (
                  <>
                    <Text style={styles.cellText}>Revenue Generation</Text>
                    <Text style={styles.cellText}>Customer Satisfaction</Text>
                    <Text style={getPriorityStyle(order.priority_level)}>
                      {order.priority_level === 0 ? 'Normal Priority' : `Priority ${order.priority_level}`}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cellText}>Stock Buffer</Text>
                    <Text style={styles.cellText}>Future Demand</Text>
                    <Text style={styles.cellText}>Operational Efficiency</Text>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Strategic Recommendations */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>
              {customerOrders.filter(o => o.production_status !== 'completed').length}
            </Text>
            <Text style={styles.kpiLabel}>Pending Customer Orders</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>
              {stockOrders.filter(o => o.production_status !== 'completed').length}
            </Text>
            <Text style={styles.kpiLabel}>Pending Stock Orders</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>
              {productionOrders.filter(o => o.priority_level >= 5).length}
            </Text>
            <Text style={styles.kpiLabel}>High Priority Orders</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiValue}>
              {overdueOrders.length}
            </Text>
            <Text style={styles.kpiLabel}>Overdue Orders</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Order Type Analysis • Page 4 of 4 • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>
    </Document>
  )
} 