import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { CustomerOrderAudit } from '@/types/database'

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
}

interface CustomerOrderAuditTemplateProps {
  order: CustomerOrder
  auditTrail: CustomerOrderAudit[]
  generatedAt: string
  suppliedRolls?: Array<{
    id: string
    roll_number: string
    roll_length: number
    remaining_length: number
    quality_grade: string
    customer_color?: string | null
    production_batches?: { batch_number?: string | null }
  }>
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 20,
    fontSize: 9,
    fontFamily: 'Courier',
    lineHeight: 1.2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  companyInfo: {
    alignItems: 'flex-end',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 3,
    fontFamily: 'Courier-Bold',
  },
  companyTagline: {
    fontSize: 8,
    color: '#000000',
    fontFamily: 'Courier',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Courier-Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: 'Courier',
  },
  auditInfo: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#000000',
  },
  auditLabel: {
    fontSize: 8,
    color: '#000000',
    textTransform: 'uppercase',
    fontFamily: 'Courier-Bold',
    marginBottom: 2,
  },
  orderSummary: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    fontFamily: 'Courier-Bold',
    textTransform: 'uppercase',
    textDecoration: 'underline',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    width: '30%',
    fontSize: 9,
    color: '#000000',
    fontFamily: 'Courier-Bold',
  },
  infoValue: {
    width: '70%',
    fontSize: 9,
    color: '#000000',
    fontFamily: 'Courier',
  },
  auditTrailHeader: {
    backgroundColor: '#e0e0e0',
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  auditEntry: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  auditEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    backgroundColor: '#f8f8f8',
    padding: 4,
  },
  auditActionType: {
    fontSize: 9,
    fontFamily: 'Courier-Bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  auditTimestamp: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: '#000000',
  },
  auditDescription: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: '#000000',
    marginBottom: 3,
  },
  auditDetails: {
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#cccccc',
  },
  auditField: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: '#000000',
    marginBottom: 2,
  },
  auditChangedBy: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: '#666666',
    textAlign: 'right',
    marginTop: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: '#000000',
    textAlign: 'center',
    fontFamily: 'Courier',
  },
  watermark: {
    position: 'absolute',
    top: 200,
    left: 100,
    transform: 'rotate(-45deg)',
    fontSize: 60,
    color: '#f0f0f0',
    fontFamily: 'Courier-Bold',
    zIndex: -1,
  },
})

export default function CustomerOrderAuditTemplate({ 
  order, 
  auditTrail, 
  generatedAt, 
  suppliedRolls = []
}: CustomerOrderAuditTemplateProps) {
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toUpperCase()
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>AUDIT TRAIL</Text>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>UNICA TEXTILE MILLS</Text>
            <Text style={styles.companyTagline}>Quality Fabrics & Textiles</Text>
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyTagline}>Generated: {formatDate(generatedAt)}</Text>
            <Text style={styles.companyTagline}>Document: CONFIDENTIAL</Text>
          </View>
        </View>
        
        <Text style={styles.title}>CUSTOMER ORDER AUDIT TRAIL</Text>
        <Text style={styles.subtitle}>Complete Activity Log & Change History</Text>
        
        <View style={styles.auditInfo}>
          <Text style={styles.auditLabel}>AUDIT DOCUMENT INFORMATION</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>DOCUMENT TYPE:</Text>
            <Text style={styles.infoValue}>CUSTOMER ORDER AUDIT TRAIL</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>GENERATED ON:</Text>
            <Text style={styles.infoValue}>{formatDate(generatedAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>TOTAL ENTRIES:</Text>
            <Text style={styles.infoValue}>{auditTrail.length} RECORDS</Text>
          </View>
        </View>

        <View style={styles.orderSummary}>
          <Text style={styles.sectionTitle}>ORDER SUMMARY</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ORDER NUMBER:</Text>
            <Text style={styles.infoValue}>{order.internal_order_number}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CUSTOMER PO:</Text>
            <Text style={styles.infoValue}>{order.customer_po_number || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CUSTOMER:</Text>
            <Text style={styles.infoValue}>{order.customers?.name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>FABRIC:</Text>
            <Text style={styles.infoValue}>{order.finished_fabrics?.name || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>QUANTITY:</Text>
            <Text style={styles.infoValue}>{order.quantity_ordered}M</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CURRENT STATUS:</Text>
            <Text style={styles.infoValue}>{formatStatus(order.order_status)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>DUE DATE:</Text>
            <Text style={styles.infoValue}>{formatDate(order.due_date)}</Text>
          </View>
        </View>

        {/* Supplied Rolls Section */}
        {suppliedRolls.length > 0 && (
          <View style={{ marginTop: 16, marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>SUPPLIED ROLLS (DISPATCHED TO CUSTOMER)</Text>
            <View style={{ flexDirection: 'row', borderBottom: 1, borderColor: '#ccc', paddingBottom: 4 }}>
              <Text style={{ width: '20%', fontWeight: 'bold' }}>Roll #</Text>
              <Text style={{ width: '15%', fontWeight: 'bold' }}>Length</Text>
              <Text style={{ width: '15%', fontWeight: 'bold' }}>Grade</Text>
              <Text style={{ width: '20%', fontWeight: 'bold' }}>Color</Text>
              <Text style={{ width: '20%', fontWeight: 'bold' }}>Batch</Text>
            </View>
            {suppliedRolls.map((roll) => (
              <View key={roll.id} style={{ flexDirection: 'row', borderBottom: 0.5, borderColor: '#eee', paddingVertical: 2 }}>
                <Text style={{ width: '20%' }}>{roll.roll_number}</Text>
                <Text style={{ width: '15%' }}>{roll.roll_length}m</Text>
                <Text style={{ width: '15%' }}>{roll.quality_grade}</Text>
                <Text style={{ width: '20%' }}>{roll.customer_color || '-'}</Text>
                <Text style={{ width: '20%' }}>{roll.production_batches?.batch_number || '-'}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.auditTrailHeader}>
          <Text style={styles.sectionTitle}>COMPLETE AUDIT TRAIL</Text>
          <Text style={styles.auditLabel}>
            CHRONOLOGICAL LOG OF ALL CHANGES AND ACTIVITIES (MOST RECENT FIRST)
          </Text>
        </View>

        {auditTrail.length === 0 ? (
          <View style={styles.auditEntry}>
            <Text style={styles.auditDescription}>NO AUDIT RECORDS FOUND</Text>
          </View>
        ) : (
          auditTrail.map((entry, index) => (
            <View key={entry.id} style={styles.auditEntry}>
              <View style={styles.auditEntryHeader}>
                <Text style={styles.auditActionType}>
                  #{String(auditTrail.length - index).padStart(3, '0')}: {entry.action_type.replace(/_/g, ' ')}
                </Text>
                <Text style={styles.auditTimestamp}>
                  {formatDate(entry.created_at)}
                </Text>
              </View>
              
              <Text style={styles.auditDescription}>
                {entry.change_description}
              </Text>
              
              {(entry.field_changed || entry.old_value || entry.new_value) && (
                <View style={styles.auditDetails}>
                  {entry.field_changed && (
                    <Text style={styles.auditField}>
                      FIELD MODIFIED: {entry.field_changed.toUpperCase()}
                    </Text>
                  )}
                  {entry.old_value && (
                    <Text style={styles.auditField}>
                      PREVIOUS VALUE: {entry.old_value}
                    </Text>
                  )}
                  {entry.new_value && (
                    <Text style={styles.auditField}>
                      NEW VALUE: {entry.new_value}
                    </Text>
                  )}
                </View>
              )}
              
              {entry.change_reason && (
                <Text style={styles.auditField}>
                  REASON: {entry.change_reason}
                </Text>
              )}
              
              <Text style={styles.auditChangedBy}>
                ACTION BY: {entry.changed_by}
              </Text>
            </View>
          ))
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            *** CONFIDENTIAL AUDIT DOCUMENT - UNICA TEXTILE MILLS ***
          </Text>
          <Text style={styles.footerText}>
            This document contains proprietary business information and is intended for authorized personnel only.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
