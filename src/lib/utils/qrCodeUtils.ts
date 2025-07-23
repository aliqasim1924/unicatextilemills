import { supabase } from '@/lib/supabase/client'

export interface QRCodeData {
  type: 'fabric_roll' | 'batch' | 'order'
  rollNumber?: string
  batchId?: string
  fabricType?: 'base_fabric' | 'finished_fabric'
  fabricId?: string
  rollLength?: number
  orderId?: string
  qrGeneratedAt: string
  
  // Enhanced data for customer context
  productionPurpose?: 'stock_building' | 'customer_order'
  customerOrderId?: string
  customerOrderNumber?: string
  customerName?: string
  productionOrderId?: string
  productionOrderNumber?: string
  
  // Color and allocation status
  color?: string
  allocationStatus?: string
  
  // URL for mobile scanning
  detailsUrl?: string
  
  additionalData?: any
}

export interface ScanRecord {
  id: string
  barcodeData: string
  scanType: 'issue' | 'receive' | 'move' | 'audit' | 'quality_check'
  scannedBy: string
  scanLocation: string
  referenceId?: string
  referenceType?: string
  scanTimestamp: string
  notes?: string
}

export const qrCodeUtils = {
  // Generate QR code data for fabric roll
  generateRollQRData: (rollData: {
    rollNumber: string
    batchId: string
    fabricType: 'base_fabric' | 'finished_fabric'
    fabricId: string
    rollLength: number
    
    // Enhanced context data
    productionPurpose?: 'stock_building' | 'customer_order'
    customerOrderId?: string
    customerOrderNumber?: string
    customerName?: string
    productionOrderId?: string
    productionOrderNumber?: string
    
    // Color and allocation status
    color?: string
    allocationStatus?: string
    
    additionalData?: any
    rollId?: string // <-- add rollId for direct lookup
  }): QRCodeData => {
    // Use rollId for direct lookup if provided
    const detailsUrl = rollData.rollId
      ? `${process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app'}/api/qr/roll/${rollData.rollId}`
      : `${process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://unicatextilemills.netlify.app'}/api/qr/download/qr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      type: 'fabric_roll',
      rollNumber: rollData.rollNumber,
      batchId: rollData.batchId,
      fabricType: rollData.fabricType,
      fabricId: rollData.fabricId,
      rollLength: rollData.rollLength,
      qrGeneratedAt: new Date().toISOString(),
      productionPurpose: rollData.productionPurpose || 'stock_building',
      customerOrderId: rollData.customerOrderId,
      customerOrderNumber: rollData.customerOrderNumber,
      customerName: rollData.customerName,
      productionOrderId: rollData.productionOrderId,
      productionOrderNumber: rollData.productionOrderNumber,
      color: rollData.color || 'Natural',
      allocationStatus: rollData.allocationStatus || 'Available',
      detailsUrl,
      additionalData: {
        ...rollData.additionalData,
        rollId: rollData.rollId
      }
    }
  },

  // Generate QR code data string (for actual QR code generation)
  generateQRString: (data: any): string => {
    // Handle API-based QR codes (new format)
    if (data.type === 'api_roll' && data.apiUrl) {
      return data.apiUrl
    }
    
    // Handle legacy QR codes with download URLs
    if (data.detailsUrl) {
      return data.detailsUrl
    }
    
    // Fallback to JSON for backwards compatibility
    return JSON.stringify(data)
  },

  // Parse QR code data from string
  parseQRString: (qrString: string): QRCodeData | null => {
    try {
      const data = JSON.parse(qrString)
      
      // Validate required fields
      if (!data.type || !data.qrGeneratedAt) {
        console.error('Invalid QR code data: missing required fields')
        return null
      }
      
      return data
    } catch (error) {
      console.error('Error parsing QR code data:', error)
      return null
    }
  },

  // Generate QR code as base64 image (requires qrcode package)
  generateQRCodeImage: async (data: QRCodeData, size: number = 200): Promise<string> => {
    try {
      const qrString = qrCodeUtils.generateQRString(data)
      
      // Use the qrcode package for actual QR code generation
      const QRCode = require('qrcode')
      const qrImageData = await QRCode.toDataURL(qrString, { 
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      })
      
      return qrImageData
    } catch (error) {
      console.error('Error generating QR code image:', error)
      throw error
    }
  },

  // Record QR code scan
  recordScan: async (scanData: {
    qrData: QRCodeData
    scanType: 'issue' | 'receive' | 'move' | 'audit' | 'quality_check'
    scannedBy: string
    scanLocation: string
    referenceId?: string
    referenceType?: string
    notes?: string
  }): Promise<ScanRecord> => {
    try {
      const { data, error } = await supabase
        .from('barcode_scans')
        .insert({
          barcode_data: JSON.stringify(scanData.qrData),
          scan_type: scanData.scanType,
          scanned_by: scanData.scannedBy,
          scan_location: scanData.scanLocation,
          reference_id: scanData.referenceId,
          reference_type: scanData.referenceType,
          notes: scanData.notes
        })
        .select()
        .single()

      if (error) {
        throw new Error(`Failed to record scan: ${error.message}`)
      }

      return {
        id: data.id,
        barcodeData: data.barcode_data,
        scanType: data.scan_type,
        scannedBy: data.scanned_by,
        scanLocation: data.scan_location,
        referenceId: data.reference_id,
        referenceType: data.reference_type,
        scanTimestamp: data.scan_timestamp,
        notes: data.notes
      }
    } catch (error) {
      console.error('Error recording scan:', error)
      throw error
    }
  },

  // Process scanned QR code
  processScan: async (
    qrString: string,
    scanType: 'issue' | 'receive' | 'move' | 'audit' | 'quality_check',
    scannedBy: string,
    scanLocation: string,
    options?: {
      referenceId?: string
      referenceType?: string
      notes?: string
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      // Parse QR code data
      const qrData = qrCodeUtils.parseQRString(qrString)
      if (!qrData) {
        return { success: false, error: 'Invalid QR code format' }
      }

      // Record the scan
      const scanRecord = await qrCodeUtils.recordScan({
        qrData,
        scanType,
        scannedBy,
        scanLocation,
        referenceId: options?.referenceId,
        referenceType: options?.referenceType,
        notes: options?.notes
      })

      // Process based on QR type and scan type
      let processResult = null
      
      if (qrData.type === 'fabric_roll') {
        processResult = await qrCodeUtils.processFabricRollScan(qrData, scanType, scanRecord.id)
      }

      return {
        success: true,
        data: {
          scanRecord,
          qrData,
          processResult
        }
      }
    } catch (error) {
      console.error('Error processing scan:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  },

  // Process fabric roll scan
  processFabricRollScan: async (
    qrData: QRCodeData,
    scanType: string,
    scanId: string
  ): Promise<any> => {
    try {
      if (!qrData.rollNumber) {
        throw new Error('Roll number not found in QR data')
      }

      // Get roll information
      const { data: roll, error } = await supabase
        .from('fabric_rolls')
        .select('*')
        .eq('roll_number', qrData.rollNumber)
        .single()

      if (error || !roll) {
        throw new Error('Roll not found in database')
      }

      // Update roll status based on scan type
      let newStatus = roll.roll_status
      
      switch (scanType) {
        case 'issue':
          newStatus = 'allocated'
          break
        case 'receive':
          newStatus = 'available'
          break
        case 'move':
          // Status remains the same for moves
          break
        case 'audit':
          // Status remains the same for audits
          break
        case 'quality_check':
          // Status depends on quality check result
          break
      }

      // Update roll status if changed
      if (newStatus !== roll.roll_status) {
        await supabase
          .from('fabric_rolls')
          .update({ roll_status: newStatus })
          .eq('id', roll.id)
      }

      return {
        rollId: roll.id,
        rollNumber: roll.roll_number,
        previousStatus: roll.roll_status,
        newStatus,
        batchId: roll.batch_id
      }
    } catch (error) {
      console.error('Error processing fabric roll scan:', error)
      throw error
    }
  },

  // Get scan history for a roll
  getScanHistory: async (rollNumber: string): Promise<ScanRecord[]> => {
    try {
      const { data, error } = await supabase
        .from('barcode_scans')
        .select('*')
        .like('barcode_data', `%${rollNumber}%`)
        .order('scan_timestamp', { ascending: false })

      if (error) {
        throw new Error(`Failed to get scan history: ${error.message}`)
      }

      return data.map(scan => ({
        id: scan.id,
        barcodeData: scan.barcode_data,
        scanType: scan.scan_type,
        scannedBy: scan.scanned_by,
        scanLocation: scan.scan_location,
        referenceId: scan.reference_id,
        referenceType: scan.reference_type,
        scanTimestamp: scan.scan_timestamp,
        notes: scan.notes
      }))
    } catch (error) {
      console.error('Error getting scan history:', error)
      throw error
    }
  },

  // Validate QR code data
  validateQRData: (qrData: QRCodeData): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!qrData.type) {
      errors.push('QR code type is required')
    }

    if (!qrData.qrGeneratedAt) {
      errors.push('QR generation timestamp is required')
    }

    if (qrData.type === 'fabric_roll') {
      if (!qrData.rollNumber) {
        errors.push('Roll number is required for fabric roll QR codes')
      }
      if (!qrData.batchId) {
        errors.push('Batch ID is required for fabric roll QR codes')
      }
      if (!qrData.fabricType) {
        errors.push('Fabric type is required for fabric roll QR codes')
      }
      if (!qrData.fabricId) {
        errors.push('Fabric ID is required for fabric roll QR codes')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  },

  // Generate multiple QR codes for a batch
  generateBatchQRCodes: async (
    batchId: string,
    fabricType: 'base_fabric' | 'finished_fabric',
    fabricId: string
  ): Promise<{ rollNumber: string; qrData: QRCodeData; qrString: string }[]> => {
    try {
      // Get all rolls for this batch
      const { data: rolls, error } = await supabase
        .from('fabric_rolls')
        .select('*')
        .eq('batch_id', batchId)
        .eq('fabric_type', fabricType)
        .eq('fabric_id', fabricId)

      if (error) {
        throw new Error(`Failed to get rolls for batch: ${error.message}`)
      }

      // Generate QR codes for each roll
      const qrCodes = rolls.map(roll => {
        const qrData = qrCodeUtils.generateRollQRData({
          rollNumber: roll.roll_number,
          batchId: roll.batch_id,
          fabricType: roll.fabric_type,
          fabricId: roll.fabric_id,
          rollLength: roll.roll_length,
          rollId: roll.id // Pass the actual roll ID
        })

        return {
          rollNumber: roll.roll_number,
          qrData,
          qrString: qrCodeUtils.generateQRString(qrData)
        }
      })

      return qrCodes
    } catch (error) {
      console.error('Error generating batch QR codes:', error)
      throw error
    }
  }
}

export default qrCodeUtils 