'use client'

import { useState, useRef, useEffect } from 'react'
import { XMarkIcon, QrCodeIcon, CameraIcon } from '@heroicons/react/24/outline'
import { qrCodeUtils, type QRCodeData } from '@/lib/utils/qrCodeUtils'

interface QRCodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (data: QRCodeData, scanResult: any) => void
  scanType: 'issue' | 'receive' | 'move' | 'audit' | 'quality_check'
  location: string
  operatorName: string
}

export default function QRCodeScanner({
  isOpen,
  onClose,
  onScanSuccess,
  scanType,
  location,
  operatorName
}: QRCodeScannerProps) {
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera')
  const [manualInput, setManualInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [lastScanResult, setLastScanResult] = useState<any>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (isOpen && scanMode === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, scanMode])

  const startCamera = async () => {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      })
      
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err) {
      console.error('Error accessing camera:', err)
      setError('Unable to access camera. Please use manual input.')
      setScanMode('manual')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const scanQRCode = async () => {
    if (!canvasRef.current || !videoRef.current) return

    setScanning(true)
    setError('')

    try {
      const canvas = canvasRef.current
      const video = videoRef.current
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Could not get canvas context')
      }

      // Set canvas size to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Get image data
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      
      // TODO: Implement QR code detection
      // This would use a library like jsQR or qr-scanner
      // For now, we'll simulate a scan
      
      // Simulate QR code detection delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // For demo purposes, create a mock scan result
      const mockQRData = {
        type: 'fabric_roll' as const,
        rollNumber: 'WV-2024-03-001-R001',
        batchId: 'batch-123',
        fabricType: 'base_fabric' as const,
        fabricId: 'fabric-456',
        rollLength: 50,
        qrGeneratedAt: new Date().toISOString()
      }

      await processScan(JSON.stringify(mockQRData))
      
    } catch (err) {
      console.error('Error scanning QR code:', err)
      setError('Error scanning QR code. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) {
      setError('Please enter QR code data')
      return
    }

    await processScan(manualInput.trim())
  }

  const processScan = async (qrString: string) => {
    setScanning(true)
    setError('')

    try {
      const result = await qrCodeUtils.processScan(
        qrString,
        scanType,
        operatorName,
        location,
        {
          notes: `Scanned via ${scanMode === 'camera' ? 'camera' : 'manual input'}`
        }
      )

      if (result.success) {
        setLastScanResult(result.data)
        onScanSuccess(result.data.qrData, result.data)
        
        // Reset for next scan
        setManualInput('')
        
        // Auto-close after successful scan
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        setError(result.error || 'Failed to process scan')
      }
    } catch (err) {
      console.error('Error processing scan:', err)
      setError('Error processing scan. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  const getScanTypeLabel = () => {
    switch (scanType) {
      case 'issue': return 'Issue Roll'
      case 'receive': return 'Receive Roll'
      case 'move': return 'Move Roll'
      case 'audit': return 'Audit Roll'
      case 'quality_check': return 'Quality Check'
      default: return 'Scan Roll'
    }
  }

  const getScanTypeColor = () => {
    switch (scanType) {
      case 'issue': return 'text-red-600 bg-red-50'
      case 'receive': return 'text-green-600 bg-green-50'
      case 'move': return 'text-blue-600 bg-blue-50'
      case 'audit': return 'text-purple-600 bg-purple-50'
      case 'quality_check': return 'text-orange-600 bg-orange-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            QR Code Scanner
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Scan Type Badge */}
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 ${getScanTypeColor()}`}>
          {getScanTypeLabel()}
        </div>

        {/* Mode Selection */}
        <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setScanMode('camera')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              scanMode === 'camera'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CameraIcon className="h-4 w-4 inline mr-2" />
            Camera
          </button>
          <button
            onClick={() => setScanMode('manual')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              scanMode === 'manual'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <QrCodeIcon className="h-4 w-4 inline mr-2" />
            Manual
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Success Display */}
        {lastScanResult && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">
              ✓ Successfully scanned: {lastScanResult.qrData.rollNumber}
            </p>
          </div>
        )}

        {/* Camera Mode */}
        {scanMode === 'camera' && (
          <div className="space-y-4">
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 bg-black rounded-lg object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="hidden"
              />
              
              {/* Scan Overlay */}
              <div className="absolute inset-0 border-2 border-white rounded-lg pointer-events-none">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-blue-500 rounded-lg"></div>
              </div>
            </div>
            
            <button
              onClick={scanQRCode}
              disabled={scanning}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? 'Scanning...' : 'Scan QR Code'}
            </button>
          </div>
        )}

        {/* Manual Mode */}
        {scanMode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label htmlFor="qr-input" className="block text-sm font-medium text-gray-700 mb-2">
                Enter QR Code Data
              </label>
              <textarea
                id="qr-input"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Paste or type QR code data here..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={scanning}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? 'Processing...' : 'Process QR Code'}
            </button>
          </form>
        )}

        {/* Scan Info */}
        <div className="mt-4 text-xs text-gray-500">
          <p><strong>Location:</strong> {location}</p>
          <p><strong>Operator:</strong> {operatorName}</p>
          <p><strong>Scan Type:</strong> {getScanTypeLabel()}</p>
        </div>
      </div>
    </div>
  )
} 