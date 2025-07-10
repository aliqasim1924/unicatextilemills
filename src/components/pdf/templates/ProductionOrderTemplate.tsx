import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// Create styles for the production order
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 30,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#1f2937',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 9,
    color: '#6b7280',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
    backgroundColor: '#f3f4f6',
    padding: 10,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoSection: {
    width: '48%',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    borderBottom: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 3,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: '40%',
    fontSize: 9,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  value: {
    width: '60%',
    fontSize: 9,
    color: '#1f2937',
  },
  materialSection: {
    marginBottom: 20,
    border: 1,
    borderColor: '#d1d5db',
    padding: 10,
  },
  statusBadge: {
    padding: 5,
    borderRadius: 3,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
  },
})

interface ProductionOrderTemplateProps {
  order: any
}

const ProductionOrderTemplate: React.FC<ProductionOrderTemplateProps> = ({ order }) => {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': '#f59e0b',
      'in_progress': '#3b82f6', 
      'completed': '#10b981',
      'on_hold': '#ef4444',
      'waiting_materials': '#f59e0b'
    }
    return colors[status] || '#6b7280'
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    })
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>UNICA TEXTILE MILLS</Text>
            <Text style={styles.companyDetails}>Industrial Area, Textile City</Text>
            <Text style={styles.companyDetails}>Phone: +1 (555) 123-4567</Text>
          </View>
          <View>
            <Text style={styles.companyDetails}>
              Generated: {formatDate(new Date().toISOString())}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>PRODUCTION WORK ORDER</Text>

        {/* Order Information */}
        <View style={styles.orderInfo}>
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>ORDER DETAILS</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Order Number:</Text>
              <Text style={styles.value}>{order.internal_order_number}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Production Type:</Text>
              <Text style={styles.value}>{order.production_type?.toUpperCase()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Status:</Text>
              <Text 
                style={[
                  styles.statusBadge, 
                  { backgroundColor: getStatusColor(order.production_status) }
                ]}
              >
                {order.production_status?.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>TIMELINE</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Created:</Text>
              <Text style={styles.value}>{formatDate(order.created_at)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Target Date:</Text>
              <Text style={styles.value}>
                {order.target_completion_date ? formatDate(order.target_completion_date) : 'Not set'}
              </Text>
            </View>
          </View>
        </View>

        {/* Material Specifications */}
        <View style={styles.materialSection}>
          <Text style={styles.sectionTitle}>MATERIAL SPECIFICATIONS</Text>
          
          {order.production_type === 'weaving' && order.base_fabrics && (
            <View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Base Fabric:</Text>
                <Text style={styles.value}>{order.base_fabrics.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>GSM:</Text>
                <Text style={styles.value}>{order.base_fabrics.gsm}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Width:</Text>
                <Text style={styles.value}>{order.base_fabrics.width_meters}m</Text>
              </View>
            </View>
          )}

          {order.production_type === 'coating' && order.finished_fabrics && (
            <View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Finished Fabric:</Text>
                <Text style={styles.value}>{order.finished_fabrics.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>GSM:</Text>
                <Text style={styles.value}>{order.finished_fabrics.gsm}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>Coating:</Text>
                <Text style={styles.value}>{order.finished_fabrics.coating_type || 'Standard'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Production Summary */}
        <View style={styles.materialSection}>
          <Text style={styles.sectionTitle}>PRODUCTION SUMMARY</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Quantity Required:</Text>
            <Text style={styles.value}>{order.quantity_required}m</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Quantity Produced:</Text>
            <Text style={styles.value}>{order.quantity_produced}m</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Progress:</Text>
            <Text style={styles.value}>
              {Math.round((order.quantity_produced / order.quantity_required) * 100)}%
            </Text>
          </View>
        </View>

        {/* Notes */}
        {order.notes && (
          <View style={styles.materialSection}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <Text style={styles.value}>{order.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

export default ProductionOrderTemplate 