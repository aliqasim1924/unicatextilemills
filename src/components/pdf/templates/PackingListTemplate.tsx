import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { getLogoBase64, getFallbackLogoSvg } from '@/lib/utils/logoUtils'

interface PackingListRoll {
  id: string
  roll_number: string
  roll_length: number
  remaining_length: number
  quality_grade: string
  customer_color: string
  production_batches?: { batch_number?: string | null }
}

interface PackingListTemplateProps {
  order: {
    id: string
    internal_order_number: string
    customer_po_number?: string | null
    quantity_ordered: number
    quantity_allocated: number
    due_date: string
    order_status: string
    invoice_number?: string | null
    gate_pass_number?: string | null
    delivery_note_number?: string | null
    dispatch_date?: string | null
    created_at?: string
    customers?: {
      name: string
      contact_person?: string | null
      address?: string | null
      email?: string | null
      phone?: string | null
    }
    finished_fabrics?: {
      name: string
      gsm: number
      width_meters: number
      color: string | null
      coating_type: string | null
    }
  }
  allocatedRolls: PackingListRoll[]
  generatedAt: string
  shipmentNumber?: string
  shippedDate?: string
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  
  // Cover Page Styles
  coverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
    paddingBottom: 20,
    borderBottomWidth: 3,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  companyTagline: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  coverTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  
  // Cover Information Grid
  coverGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  coverColumn: {
    width: '48%',
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  coverSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 15,
    textTransform: 'uppercase',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 5,
  },
  coverInfoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  coverLabel: {
    width: '45%',
    fontSize: 10,
    color: '#374151',
    fontWeight: 'bold',
  },
  coverValue: {
    width: '55%',
    fontSize: 10,
    color: '#1f2937',
  },
  
  // Summary Box
  summaryBox: {
    backgroundColor: '#eff6ff',
    padding: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2563eb',
    marginBottom: 30,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    textAlign: 'center',
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  summaryLabel: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  
  // Detail Page Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  documentInfo: {
    alignItems: 'flex-end',
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  documentNumber: {
    fontSize: 11,
    color: '#374151',
    marginBottom: 3,
  },
  
  // Table Styles
  table: {
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  tableCell: {
    fontSize: 8,
    color: '#334155',
    textAlign: 'center',
  },
  tableCellBold: {
    fontSize: 8,
    color: '#1e293b',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // Column widths for detailed table
  col1: { width: '20%' }, // Roll Number
  col2: { width: '12%' }, // Meters
  col3: { width: '12%' }, // Running Meters
  col4: { width: '12%' }, // Weight
  col5: { width: '12%' }, // Running Weight
  col6: { width: '15%' }, // Color
  col7: { width: '17%' }, // Batch Number
  
  // Totals row
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 2,
    borderTopColor: '#1e40af',
  },
  totalsCellHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  totalsCell: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  
  // Footer
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
  
  // Signature section
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingTop: 20,
  },
  signatureBox: {
    width: '30%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 8,
    height: 30,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: 'bold',
  },
})

const PackingListTemplate: React.FC<PackingListTemplateProps> = ({ 
  order, 
  allocatedRolls, 
  generatedAt, 
  shipmentNumber,
  shippedDate 
}) => {
  // Get logo as base64 for reliable PDF rendering
  const logoSrc = getLogoBase64() || getFallbackLogoSvg()
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Calculate weights and totals
  const gsm = order.finished_fabrics?.gsm || 400
  const width = order.finished_fabrics?.width_meters || 1.8
  
  let runningMeters = 0
  let runningWeight = 0
  const totalRolls = allocatedRolls.length
  
  const rollsWithWeights = allocatedRolls.map((roll, index) => {
    const allocatedLength = roll.roll_length - roll.remaining_length
    runningMeters += allocatedLength
    const rollWeight = ((gsm * width * allocatedLength) / 1000) + 1 // +1kg for tubing
    runningWeight += rollWeight
    
    return {
      ...roll,
      allocatedLength,
      rollWeight,
      runningMeters: runningMeters,
      runningWeight: runningWeight
    }
  })

  const totalWeight = runningWeight
  const totalMeters = runningMeters

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverHeader}>
          {logoSrc && <Image style={styles.logo} src={logoSrc} />}
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>UNICA TEXTILE MILLS SA</Text>
            <Text style={styles.companyTagline}>Excellence in Textile Manufacturing</Text>
          </View>
        </View>

        <Text style={styles.coverTitle}>Packing List</Text>
        <Text style={styles.coverSubtitle}>Customer Order Dispatch Documentation</Text>

        {/* Cover Information Grid */}
        <View style={styles.coverGrid}>
          {/* Customer & Order Information */}
          <View style={styles.coverColumn}>
            <Text style={styles.coverSectionTitle}>Customer Information</Text>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Customer:</Text>
              <Text style={styles.coverValue}>{order.customers?.name || 'N/A'}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Contact:</Text>
              <Text style={styles.coverValue}>{order.customers?.contact_person || 'N/A'}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Phone:</Text>
              <Text style={styles.coverValue}>{order.customers?.phone || 'N/A'}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Email:</Text>
              <Text style={styles.coverValue}>{order.customers?.email || 'N/A'}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Order Number:</Text>
              <Text style={styles.coverValue}>{order.internal_order_number}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Customer PO:</Text>
              <Text style={styles.coverValue}>{order.customer_po_number || 'N/A'}</Text>
            </View>
          </View>

          {/* Shipment & Documentation */}
          <View style={styles.coverColumn}>
            <Text style={styles.coverSectionTitle}>Shipment Documentation</Text>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Shipment No:</Text>
              <Text style={styles.coverValue}>{shipmentNumber || 'N/A'}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Invoice No:</Text>
              <Text style={styles.coverValue}>{order.invoice_number || 'N/A'}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Gate Pass No:</Text>
              <Text style={styles.coverValue}>{order.gate_pass_number || 'N/A'}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Delivery Note:</Text>
              <Text style={styles.coverValue}>{order.delivery_note_number || 'N/A'}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Dispatch Date:</Text>
              <Text style={styles.coverValue}>{order.dispatch_date ? formatDate(order.dispatch_date) : 'N/A'}</Text>
            </View>
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverLabel}>Generated:</Text>
              <Text style={styles.coverValue}>{formatDate(generatedAt)}</Text>
            </View>
          </View>
        </View>

        {/* Summary Box */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>SHIPMENT SUMMARY</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{totalRolls}</Text>
              <Text style={styles.summaryLabel}>Total Rolls</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{totalMeters.toFixed(1)}m</Text>
              <Text style={styles.summaryLabel}>Total Meters</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{totalWeight.toFixed(1)}kg</Text>
              <Text style={styles.summaryLabel}>Total Weight</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{order.finished_fabrics?.gsm || 'N/A'}</Text>
              <Text style={styles.summaryLabel}>GSM</Text>
            </View>
          </View>
        </View>



        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Packing List Cover Page • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Page 1 of 2 • Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>

      {/* Detailed Packing List Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoSrc && <Image style={styles.logo} src={logoSrc} />}
          <View style={styles.documentInfo}>
            <Text style={styles.documentTitle}>Detailed Packing List</Text>
            <Text style={styles.documentNumber}>Order: {order.internal_order_number}</Text>
            {shipmentNumber && (
              <Text style={styles.documentNumber}>Shipment: {shipmentNumber}</Text>
            )}
          </View>
        </View>

        {/* Detailed Roll Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.col1}><Text style={styles.tableHeaderCell}>Roll Number</Text></View>
            <View style={styles.col2}><Text style={styles.tableHeaderCell}>Meters</Text></View>
            <View style={styles.col3}><Text style={styles.tableHeaderCell}>Running Meters</Text></View>
            <View style={styles.col4}><Text style={styles.tableHeaderCell}>Weight (kg)</Text></View>
            <View style={styles.col5}><Text style={styles.tableHeaderCell}>Running Weight</Text></View>
            <View style={styles.col6}><Text style={styles.tableHeaderCell}>Color</Text></View>
            <View style={styles.col7}><Text style={styles.tableHeaderCell}>Batch Number</Text></View>
          </View>

                      {rollsWithWeights.map((roll, index) => {
              // Create shorter roll number by removing prefix and keeping essential parts
              const shortRollNumber = roll.roll_number
                .replace(/^(COATING|WEAVING)-/, '') // Remove COATING- or WEAVING- prefix
                .replace(/^(\d{8})-/, '') // Remove date prefix
                .replace(/^(\d{3})-/, '') // Remove order number prefix
                .replace(/^([A-Z]+)-/, '') // Remove grade prefix
                .replace(/^R(\d+)$/, 'R$1') // Keep roll number
                .substring(0, 12) // Limit to 12 characters max
              
              return (
                <View key={roll.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
                  <View style={styles.col1}>
                    <Text style={styles.tableCellBold}>{shortRollNumber}</Text>
                  </View>
                  <View style={styles.col2}>
                    <Text style={styles.tableCell}>{roll.allocatedLength.toFixed(1)}m</Text>
                  </View>
                  <View style={styles.col3}>
                    <Text style={styles.tableCell}>{roll.runningMeters.toFixed(1)}m</Text>
                  </View>
                  <View style={styles.col4}>
                    <Text style={styles.tableCell}>{roll.rollWeight.toFixed(1)}kg</Text>
                  </View>
                  <View style={styles.col5}>
                    <Text style={styles.tableCell}>{roll.runningWeight.toFixed(1)}kg</Text>
                  </View>
                  <View style={styles.col6}>
                    <Text style={styles.tableCell}>{roll.customer_color}</Text>
                  </View>
                  <View style={styles.col7}>
                    <Text style={styles.tableCell}>{roll.production_batches?.batch_number || 'N/A'}</Text>
                  </View>
                </View>
              )
            })}

          {/* Totals Row */}
          <View style={styles.totalsRow}>
            <View style={styles.col1}>
              <Text style={styles.totalsCellHeader}>TOTALS</Text>
            </View>
            <View style={styles.col2}>
              <Text style={styles.totalsCell}>{totalMeters.toFixed(1)}m</Text>
            </View>
            <View style={styles.col3}>
              <Text style={styles.totalsCell}>{totalMeters.toFixed(1)}m</Text>
            </View>
            <View style={styles.col4}>
              <Text style={styles.totalsCell}>-</Text>
            </View>
            <View style={styles.col5}>
              <Text style={styles.totalsCell}>{totalWeight.toFixed(1)}kg</Text>
            </View>
            <View style={styles.col6}>
              <Text style={styles.totalsCell}>-</Text>
            </View>
            <View style={styles.col7}>
              <Text style={styles.totalsCell}>{totalRolls} rolls</Text>
            </View>
          </View>
        </View>



        {/* Signature Section */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Packed By</Text>
            <View style={{ height: 8 }} />
            <Text style={styles.signatureLabel}>Date: ___________</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Quality Checked By</Text>
            <View style={{ height: 8 }} />
            <Text style={styles.signatureLabel}>Date: ___________</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Dispatched By</Text>
            <View style={{ height: 8 }} />
            <Text style={styles.signatureLabel}>Date: ___________</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Unica Textile Mills SA • Detailed Packing List • {new Date().getFullYear()}
          </Text>
          <Text style={styles.footerText}>
            Page 2 of 2 • Order: {order.internal_order_number}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export default PackingListTemplate