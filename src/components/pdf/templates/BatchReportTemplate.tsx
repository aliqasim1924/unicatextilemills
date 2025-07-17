import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { getLogoBase64, getFallbackLogoSvg } from '@/lib/utils/logoUtils'

interface BatchRoll {
  id: string
  roll_number: string
  roll_length: number
  remaining_length: number
  roll_status: string
  quality_grade?: string
  roll_type?: string
  created_at: string
}

interface BatchData {
  id: string
  batch_number: string
  production_type: 'weaving' | 'coating'
  planned_quantity: number
  actual_quantity: number
  completion_percentage: number
  batch_status: string
  created_at: string
  completed_at?: string
  notes?: string
  production_orders?: {
    internal_order_number: string
    customer_orders?: {
      internal_order_number: string
      customers?: {
        name: string
      }
    }
  }
  base_fabrics?: {
    name: string
    gsm: number
    width_meters: number
    color: string
  }
  finished_fabrics?: {
    name: string
    gsm: number
    width_meters: number
    color: string
    coating_type: string
  }
  fabric_rolls: BatchRoll[]
}

interface BatchReportTemplateProps {
  batch: BatchData
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
  batchInfo: {
    backgroundColor: '#f8fafc',
    padding: 20,
    marginBottom: 25,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  batchNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  batchStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statusCompleted: {
    backgroundColor: '#10b981',
  },
  statusInProgress: {
    backgroundColor: '#3b82f6',
  },
  statusPending: {
    backgroundColor: '#f59e0b',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  infoItem: {
    flex: 1,
    minWidth: '30%',
  },
  infoLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 11,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    backgroundColor: '#f1f5f9',
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
  col1: { width: '20%' },
  col2: { width: '15%' },
  col3: { width: '15%' },
  col4: { width: '12%' },
  col5: { width: '12%' },
  col6: { width: '13%' },
  col7: { width: '13%' },
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
  rollStatusAvailable: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  rollStatusAllocated: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  rollStatusUsed: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  rollStatusDamaged: {
    backgroundColor: '#fecaca',
    color: '#dc2626',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  gradeA: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  gradeB: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  gradeC: {
    backgroundColor: '#fed7aa',
    color: '#c2410c',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#6b7280',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
})

export default function BatchReportTemplate({ batch, generatedAt }: BatchReportTemplateProps) {
  const logoSrc = getLogoBase64() || getFallbackLogoSvg()
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return styles.statusCompleted
      case 'in_progress': return styles.statusInProgress
      default: return styles.statusPending
    }
  }

  const getRollStatusStyle = (status: string) => {
    switch (status) {
      case 'available': return styles.rollStatusAvailable
      case 'allocated': return styles.rollStatusAllocated
      case 'used': return styles.rollStatusUsed
      case 'damaged': return styles.rollStatusDamaged
      default: return styles.rollStatusAvailable
    }
  }

  const getGradeStyle = (grade: string) => {
    switch (grade) {
      case 'A': return styles.gradeA
      case 'B': return styles.gradeB
      case 'C': return styles.gradeC
      default: return styles.gradeA
    }
  }

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Calculate roll statistics
  const totalRolls = batch.fabric_rolls.length
  const availableRolls = batch.fabric_rolls.filter(r => r.roll_status === 'available').length
  const allocatedRolls = batch.fabric_rolls.filter(r => r.roll_status === 'allocated').length
  const usedRolls = batch.fabric_rolls.filter(r => r.roll_status === 'used').length
  const totalLength = batch.fabric_rolls.reduce((sum, r) => sum + r.roll_length, 0)
  const remainingLength = batch.fabric_rolls.reduce((sum, r) => sum + r.remaining_length, 0)

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
      <Page size="A4" style={styles.page}>
        <HeaderComponent />

        <Text style={styles.title}>Production Batch Report</Text>
        <Text style={styles.subtitle}>Detailed roll breakdown and batch analysis</Text>

        {/* Batch Information */}
        <View style={styles.batchInfo}>
          <View style={styles.batchHeader}>
            <Text style={styles.batchNumber}>Batch: {batch.batch_number}</Text>
            <Text style={[styles.batchStatus, getStatusStyle(batch.batch_status)]}>
              {formatStatus(batch.batch_status)}
            </Text>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Production Type</Text>
              <Text style={styles.infoValue}>{batch.production_type.toUpperCase()}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Production Order</Text>
              <Text style={styles.infoValue}>{batch.production_orders?.internal_order_number || 'N/A'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>
                {batch.production_orders?.customer_orders?.customers?.name || 'Stock Building'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Fabric</Text>
              <Text style={styles.infoValue}>
                {batch.production_type === 'weaving' 
                  ? batch.base_fabrics?.name 
                  : batch.finished_fabrics?.name}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>{formatDate(batch.created_at)}</Text>
            </View>
            {batch.completed_at && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Completed</Text>
                <Text style={styles.infoValue}>{formatDate(batch.completed_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Production Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Planned Quantity</Text>
            <Text style={styles.summaryValue}>{batch.planned_quantity.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Actual Quantity</Text>
            <Text style={styles.summaryValue}>{batch.actual_quantity.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Completion</Text>
            <Text style={styles.summaryValue}>{Math.round(batch.completion_percentage)}%</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Rolls</Text>
            <Text style={styles.summaryValue}>{totalRolls}</Text>
          </View>
        </View>

        {/* Roll Statistics */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Available</Text>
            <Text style={styles.summaryValue}>{availableRolls}</Text>
            <Text style={styles.summaryUnit}>rolls</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Allocated</Text>
            <Text style={styles.summaryValue}>{allocatedRolls}</Text>
            <Text style={styles.summaryUnit}>rolls</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Used</Text>
            <Text style={styles.summaryValue}>{usedRolls}</Text>
            <Text style={styles.summaryUnit}>rolls</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Remaining Length</Text>
            <Text style={styles.summaryValue}>{remainingLength.toLocaleString()}</Text>
            <Text style={styles.summaryUnit}>meters</Text>
          </View>
        </View>

        {/* Rolls Table */}
        <Text style={styles.sectionTitle}>Roll Breakdown</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.col1}><Text style={styles.cellHeader}>Roll Number</Text></View>
            <View style={styles.col2}><Text style={styles.cellHeader}>Original Length</Text></View>
            <View style={styles.col3}><Text style={styles.cellHeader}>Remaining Length</Text></View>
            <View style={styles.col4}><Text style={styles.cellHeader}>Status</Text></View>
            <View style={styles.col5}><Text style={styles.cellHeader}>Grade</Text></View>
            <View style={styles.col6}><Text style={styles.cellHeader}>Type</Text></View>
            <View style={styles.col7}><Text style={styles.cellHeader}>Created</Text></View>
          </View>

          {batch.fabric_rolls.map((roll, index) => (
            <View key={roll.id} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowEven] : styles.tableRow}>
              <View style={styles.col1}>
                <Text style={styles.cellTextBold}>{roll.roll_number}</Text>
              </View>
              <View style={styles.col2}>
                <Text style={styles.cellText}>{roll.roll_length.toLocaleString()}m</Text>
              </View>
              <View style={styles.col3}>
                <Text style={styles.cellText}>{roll.remaining_length.toLocaleString()}m</Text>
              </View>
              <View style={styles.col4}>
                <Text style={getRollStatusStyle(roll.roll_status)}>
                  {formatStatus(roll.roll_status)}
                </Text>
              </View>
              <View style={styles.col5}>
                {roll.quality_grade && (
                  <Text style={getGradeStyle(roll.quality_grade)}>
                    Grade {roll.quality_grade}
                  </Text>
                )}
              </View>
              <View style={styles.col6}>
                <Text style={styles.cellText}>
                  {roll.roll_type ? formatStatus(roll.roll_type) : 'Standard'}
                </Text>
              </View>
              <View style={styles.col7}>
                <Text style={styles.cellText}>
                  {new Date(roll.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Notes */}
        {batch.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.batchInfo}>
              <Text style={styles.cellText}>{batch.notes}</Text>
            </View>
          </>
        )}

        <View style={styles.footer}>
          <Text>
            Unica Textile Mills SA • Batch Report • Generated: {new Date(generatedAt).toLocaleString()}
          </Text>
        </View>
      </Page>
    </Document>
  )
} 