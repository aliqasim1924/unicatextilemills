'use client'

import { useState, useEffect } from 'react'
import { qrCodeUtils } from '@/lib/utils/qrCodeUtils'

interface QRCodeDisplayProps {
  qrData: string | object
  size?: number
  className?: string
  showData?: boolean
}

interface ParsedQRData {
  type: string
  data?: string
  rollNumber?: string
  rollLength?: number
  fabricType?: string
  color?: string
  allocationStatus?: string
  qrGeneratedAt: string
  productionPurpose?: string
  customerOrderNumber?: string
  customerName?: string
}

export default function QRCodeDisplay({ 
  qrData, 
  size = 150, 
  className = '',
  showData = true 
}: QRCodeDisplayProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedQRData | null>(null)

  useEffect(() => {
    generateQRCode()
  }, [qrData, size])

  const generateQRCode = async () => {
    try {
      setLoading(true)
      setError('')

      let qrDataObj
      
      // Parse QR data if it's a string
      if (typeof qrData === 'string') {
        try {
          qrDataObj = JSON.parse(qrData)
        } catch {
          // If it's not JSON, create a simple QR data object
          qrDataObj = {
            type: 'text',
            data: qrData,
            qrGeneratedAt: new Date().toISOString()
          }
        }
      } else {
        qrDataObj = qrData
      }

      setParsedData(qrDataObj)

      // Generate QR code image using URL if available (for mobile scanning)
      const qrStringForImage = qrCodeUtils.generateQRString(qrDataObj)
      const imageUrl = await qrCodeUtils.generateQRCodeImage(qrDataObj, size)
      setQrImageUrl(imageUrl)
    } catch (err) {
      console.error('Error generating QR code:', err)
      setError('Failed to generate QR code')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 border border-red-200 rounded ${className}`} 
           style={{ width: size, height: size }}>
        <div className="text-center p-2">
          <p className="text-red-600 text-xs">Error</p>
          <p className="text-red-500 text-xs">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`qr-code-container ${className}`}>
      {qrImageUrl && (
        <img 
          src={qrImageUrl} 
          alt="QR Code" 
          width={size} 
          height={size}
          className="border border-gray-200 rounded"
        />
      )}
      
      {showData && parsedData && (
        <div className="mt-2 text-xs text-gray-700">
          {parsedData.type === 'fabric_roll' && (
            <div>
              <p><strong>Roll:</strong> {parsedData.rollNumber}</p>
              <p><strong>Length:</strong> {parsedData.rollLength}m</p>
              <p><strong>Colour:</strong> {parsedData.color || 'Natural'}</p>
              <p><strong>Status:</strong> {parsedData.allocationStatus || 'Available'}</p>
              <p><strong>Batch:</strong> {parsedData.productionPurpose === 'customer_order' && parsedData.customerOrderNumber ? `Order ${parsedData.customerOrderNumber}${parsedData.customerName ? ' - ' + parsedData.customerName : ''}` : 'Stock Building'}</p>
            </div>
          )}
          {parsedData.type === 'text' && (
            <p><strong>Data:</strong> {parsedData.data}</p>
          )}
          <p className="text-gray-800 mt-1">
            Generated: {new Date(parsedData.qrGeneratedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
} 