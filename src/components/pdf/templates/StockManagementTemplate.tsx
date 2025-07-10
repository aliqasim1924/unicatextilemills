import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { getLogoBase64, getFallbackLogoSvg } from '@/lib/utils/logoUtils'

interface BaseFabric {
  id: string
  name: string
  gsm: number
  width_meters: number
  color: string | null
  stock_quantity: number
  minimum_stock: number
  created_at: string
  updated_at: string
}

interface FinishedFabric {
  id: string
  name: string
  base_fabric_id: string | null
  gsm: number
  width_meters: number
  color: string | null
  coating_type: string | null
  stock_quantity: number
  minimum_stock: number
  created_at: string
  updated_at: string
  base_fabrics?: {
    name: string
  }
}

interface StockMovement {
  id: string
  fabric_type: string
  fabric_id: string
  movement_type: string
  quantity: number
  reference_id: string | null
  reference_type: string | null
  notes: string | null
  created_at: string
  base_fabrics?: {
    name: string
  }
  finished_fabrics?: {
    name: string
  }
}

interface StockManagementTemplateProps {
  data: {
    baseFabrics: BaseFabric[]
    finishedFabrics: FinishedFabric[]
    recentMovements: StockMovement[]
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
  col1: { width: '25%' },
  col2: { width: '20%' },
  col3: { width: '15%' },
  col4: { width: '15%' },
  col5: { width: '15%' },
  col6: { width: '10%' },
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
  alertText: {
    fontSize: 8,
    color: '#dc2626',
    fontWeight: 'bold',
  },
  okText: {
    fontSize: 8,
    color: '#059669',
  },
  warningText: {
    fontSize: 8,
    color: '#d97706',
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

export default function StockManagementTemplate({ data, generatedAt }: StockManagementTemplateProps) {
  // Get logo as base64 for reliable PDF rendering
  const logoSrc = getLogoBase64() || getFallbackLogoSvg()
  
  const { baseFabrics, finishedFabrics, recentMovements } = data

  // Calculate summary statistics
  const totalBaseFabrics = baseFabrics?.length || 0
  const totalFinishedFabrics = finishedFabrics?.length || 0
  const totalBaseStock = baseFabrics?.reduce((sum, fabric) => sum + fabric.stock_quantity, 0) || 0
  const totalFinishedStock = finishedFabrics?.reduce((sum, fabric) => sum + fabric.stock_quantity, 0) || 0
  
  // Low stock analysis
  const lowStockBaseFabrics = baseFabrics?.filter(f => f.stock_quantity <= f.minimum_stock) || []
  const lowStockFinishedFabrics = finishedFabrics?.filter(f => f.stock_quantity <= f.minimum_stock) || []
  const totalLowStockItems = lowStockBaseFabrics.length + lowStockFinishedFabrics.length

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStockStatus = (current: number, minimum: number) => {
    if (current <= minimum) return 'critical'
    if (current <= minimum * 1.5) return 'low'
    return 'ok'
  }

  const getStockStyle = (current: number, minimum: number) => {
    const status = getStockStatus(current, minimum)
    switch (status) {
      case 'critical': return styles.alertText
      case 'low': return styles.warningText
      default: return styles.okText
    }
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
      {/* Page 1: Stock Overview Dashboard */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <HeaderComponent />

        <Text style={styles.title}>Stock Management Overview</Text>
        <Text style={styles.subtitle}>Comprehensive inventory analysis and control dashboard</Text>

        {/* Executive Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Stock Value</Text>
            <Text style={styles.summaryValue}>{(totalBaseStock + totalFinishedStock).toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Base Fabrics</Text>
            <Text style={styles.summaryValue}>{totalBaseStock.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Finished Fabrics</Text>
            <Text style={styles.summaryValue}>{totalFinishedStock.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Low Stock Alerts</Text>
            <Text style={styles.summaryValue}>{totalLowStockItems}</Text>
            <Text style={styles.summaryUnit}>items</Text>
          </View>
        </View>

        {/* Critical Low Stock Items */}
        <Text style={styles.sectionTitle}>Critical Stock Alerts - Immediate Attention Required</Text>
        
        {totalLowStockItems > 0 ? (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={styles.col1}><Text style={styles.cellHeader}>Fabric Name</Text></View>
              <View style={styles.col2}><Text style={styles.cellHeader}>Type & Specifications</Text></View>
              <View style={styles.col3}><Text style={styles.cellHeader}>Current Stock</Text></View>
              <View style={styles.col4}><Text style={styles.cellHeader}>Minimum Stock</Text></View>
              <View style={styles.col5}><Text style={styles.cellHeader}>Shortage</Text></View>
              <View style={styles.col6}><Text style={styles.cellHeader}>Status</Text></View>
            </View>

            {[...lowStockBaseFabrics, ...lowStockFinishedFabrics].slice(0, 20).map((fabric, index) => (
              <View key={fabric.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
                <View style={styles.col1}>
                  <Text style={styles.cellTextBold}>{fabric.name}</Text>
                  <Text style={styles.cellText}>{fabric.color || 'Natural'}</Text>
                </View>
                <View style={styles.col2}>
                  <Text style={styles.cellText}>
                    {'coating_type' in fabric ? 'Finished Fabric' : 'Base Fabric'}
                  </Text>
                  <Text style={styles.cellText}>{fabric.gsm}GSM • {fabric.width_meters}m</Text>
                </View>
                <View style={styles.col3}>
                  <Text style={getStockStyle(fabric.stock_quantity, fabric.minimum_stock)}>
                    {fabric.stock_quantity.toLocaleString()}m
                  </Text>
                </View>
                <View style={styles.col4}>
                  <Text style={styles.cellText}>{fabric.minimum_stock.toLocaleString()}m</Text>
                </View>
                <View style={styles.col5}>
                  <Text style={styles.alertText}>
                    {Math.max(0, fabric.minimum_stock - fabric.stock_quantity).toLocaleString()}m
                  </Text>
                </View>
                <View style={styles.col6}>
                  <Text style={styles.alertText}>CRITICAL</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.summaryContainer}>
            <View style={styles.summaryBox}>
              <Text style={styles.okText}>✓ All items are above minimum stock levels</Text>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Stock Management Overview • Page 1 of 2 • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>

      {/* Page 2: Detailed Inventory */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        <HeaderComponent />

        <Text style={styles.title}>Detailed Inventory Report</Text>
        <Text style={styles.subtitle}>Complete base and finished fabrics inventory analysis</Text>

        {/* Base Fabrics */}
        <Text style={styles.sectionTitle}>Base Fabrics Inventory</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.col1}><Text style={styles.cellHeader}>Fabric Details</Text></View>
            <View style={styles.col2}><Text style={styles.cellHeader}>Specifications</Text></View>
            <View style={styles.col3}><Text style={styles.cellHeader}>Current Stock</Text></View>
            <View style={styles.col4}><Text style={styles.cellHeader}>Minimum Stock</Text></View>
            <View style={styles.col5}><Text style={styles.cellHeader}>Stock Status</Text></View>
            <View style={styles.col6}><Text style={styles.cellHeader}>Last Update</Text></View>
          </View>

          {baseFabrics?.slice(0, 15).map((fabric, index) => (
            <View key={fabric.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
              <View style={styles.col1}>
                <Text style={styles.cellTextBold}>{fabric.name}</Text>
                <Text style={styles.cellText}>{fabric.color || 'Natural'}</Text>
              </View>
              <View style={styles.col2}>
                <Text style={styles.cellText}>{fabric.gsm}GSM</Text>
                <Text style={styles.cellText}>{fabric.width_meters}m wide</Text>
              </View>
              <View style={styles.col3}>
                <Text style={getStockStyle(fabric.stock_quantity, fabric.minimum_stock)}>
                  {fabric.stock_quantity.toLocaleString()}m
                </Text>
              </View>
              <View style={styles.col4}>
                <Text style={styles.cellText}>{fabric.minimum_stock.toLocaleString()}m</Text>
              </View>
              <View style={styles.col5}>
                <Text style={getStockStyle(fabric.stock_quantity, fabric.minimum_stock)}>
                  {getStockStatus(fabric.stock_quantity, fabric.minimum_stock).toUpperCase()}
                </Text>
              </View>
              <View style={styles.col6}>
                <Text style={styles.cellText}>{formatDate(fabric.updated_at)}</Text>
              </View>
            </View>
          )) || []}
        </View>

        {/* Finished Fabrics */}
        <Text style={styles.sectionTitle}>Finished Fabrics Inventory</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.col1}><Text style={styles.cellHeader}>Product Details</Text></View>
            <View style={styles.col2}><Text style={styles.cellHeader}>Specifications</Text></View>
            <View style={styles.col3}><Text style={styles.cellHeader}>Current Stock</Text></View>
            <View style={styles.col4}><Text style={styles.cellHeader}>Minimum Stock</Text></View>
            <View style={styles.col5}><Text style={styles.cellHeader}>Stock Status</Text></View>
            <View style={styles.col6}><Text style={styles.cellHeader}>Base Fabric</Text></View>
          </View>

          {finishedFabrics?.slice(0, 15).map((fabric, index) => (
            <View key={fabric.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
              <View style={styles.col1}>
                <Text style={styles.cellTextBold}>{fabric.name}</Text>
                <Text style={styles.cellText}>{fabric.color || 'Natural'}</Text>
              </View>
              <View style={styles.col2}>
                <Text style={styles.cellText}>{fabric.gsm}GSM</Text>
                <Text style={styles.cellText}>{fabric.width_meters}m wide</Text>
              </View>
              <View style={styles.col3}>
                <Text style={getStockStyle(fabric.stock_quantity, fabric.minimum_stock)}>
                  {fabric.stock_quantity.toLocaleString()}m
                </Text>
              </View>
              <View style={styles.col4}>
                <Text style={styles.cellText}>{fabric.minimum_stock.toLocaleString()}m</Text>
              </View>
              <View style={styles.col5}>
                <Text style={getStockStyle(fabric.stock_quantity, fabric.minimum_stock)}>
                  {getStockStatus(fabric.stock_quantity, fabric.minimum_stock).toUpperCase()}
                </Text>
              </View>
              <View style={styles.col6}>
                <Text style={styles.cellText}>{fabric.base_fabrics?.name || 'N/A'}</Text>
              </View>
            </View>
          )) || []}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Detailed Inventory Report • Page 2 of 2 • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>
    </Document>
  )
} 