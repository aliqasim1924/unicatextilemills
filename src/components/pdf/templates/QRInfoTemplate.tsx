import React from 'react'
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#1F2937',
    fontWeight: 'bold',
  },
  subHeader: {
    fontSize: 18,
    marginBottom: 15,
    color: '#374151',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#F9FAFB',
    borderRadius: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    width: 120,
    fontWeight: 'bold',
  },
  value: {
    fontSize: 12,
    color: '#111827',
    flex: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginVertical: 15,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },
})

interface QRInfoTemplateProps {
  qrData: {
    rollNumber?: string
    batchId?: string
    fabricType?: string
    fabricName?: string
    color?: string
    allocationStatus?: string
    rollLength?: number
    remainingLength?: number
    rollStatus?: string
    productionPurpose?: string
    customerOrderNumber?: string
    customerName?: string
    productionOrderNumber?: string
    batchNumber?: string
    productionType?: string
    qrGeneratedAt?: string
  }
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

const QRInfoTemplate: React.FC<QRInfoTemplateProps> = ({ qrData }) => {
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Fabric Roll Information</Text>
        
        {/* Roll Details */}
        <View style={styles.section}>
          <Text style={styles.subHeader}>Roll Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Roll Number:</Text>
            <Text style={styles.value}>{qrData.rollNumber || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fabric Name:</Text>
            <Text style={styles.value}>{formatToSentenceCase(qrData.fabricName)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Colour:</Text>
            <Text style={styles.value}>{qrData.color || 'Natural'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Roll Length:</Text>
            <Text style={styles.value}>{qrData.rollLength ? `${qrData.rollLength}m` : 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Remaining Length:</Text>
            <Text style={styles.value}>{qrData.remainingLength ? `${qrData.remainingLength}m` : 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{qrData.allocationStatus || 'Available'}</Text>
          </View>
        </View>

        {/* Production Details */}
        <View style={styles.section}>
          <Text style={styles.subHeader}>Production Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Batch Number:</Text>
            <Text style={styles.value}>{qrData.batchNumber || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Production Type:</Text>
            <Text style={styles.value}>{formatToSentenceCase(qrData.productionType)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Production Purpose:</Text>
            <Text style={styles.value}>{formatToSentenceCase(qrData.productionPurpose)}</Text>
          </View>
          {qrData.productionOrderNumber && (
            <View style={styles.row}>
              <Text style={styles.label}>Production Order:</Text>
              <Text style={styles.value}>{qrData.productionOrderNumber}</Text>
            </View>
          )}
        </View>

        {/* Customer Details (if applicable) */}
        {(qrData.customerName || qrData.customerOrderNumber) && (
          <View style={styles.section}>
            <Text style={styles.subHeader}>Customer Details</Text>
            {qrData.customerName && (
              <View style={styles.row}>
                <Text style={styles.label}>Customer:</Text>
                <Text style={styles.value}>{formatToSentenceCase(qrData.customerName)}</Text>
              </View>
            )}
            {qrData.customerOrderNumber && (
              <View style={styles.row}>
                <Text style={styles.label}>Customer Order:</Text>
                <Text style={styles.value}>{qrData.customerOrderNumber}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.divider} />

        <Text style={styles.footer}>
          Generated on {formatDate(new Date().toISOString())} | QR Code Generated: {formatDate(qrData.qrGeneratedAt)}
        </Text>
      </Page>
    </Document>
  )
}

export default QRInfoTemplate 