'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface RollDetails {
  id: string
  rollNumber: string
  fabricType: string
  fabricName: string
  color?: string
  allocationStatus: string
  rollLength: number
  remainingLength?: number
  rollStatus: string
  qualityGrade: string
  rollType: string
  batchNumber?: string
  productionType?: string
  productionOrderNumber?: string
  customerOrderNumber?: string
  customerName?: string
  createdAt: string
  location?: string
}

export default function RollDetailsPage() {
  const params = useParams()
  const rollId = params.rollId as string
  const [rollDetails, setRollDetails] = useState<RollDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (rollId) {
      fetchRollDetails()
    }
  }, [rollId])

  const fetchRollDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/rolls/${rollId}`)
      const data = await response.json()

      if (data.success) {
        setRollDetails(data.data)
      } else {
        setError(data.message || 'Roll not found')
      }
    } catch (err) {
      console.error('Error fetching roll details:', err)
      setError('Failed to load roll details')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'bg-green-100 text-green-800'
      case 'allocated':
        return 'bg-blue-100 text-blue-800'
      case 'partially_allocated':
        return 'bg-yellow-100 text-yellow-800'
      case 'used':
        return 'bg-gray-100 text-gray-800'
      case 'shipped':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade.toUpperCase()) {
      case 'A':
        return 'bg-green-100 text-green-800'
      case 'B':
        return 'bg-yellow-100 text-yellow-800'
      case 'C':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading roll details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">QR Code Not Found</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!rollDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md text-center">
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Roll Not Found</h1>
          <p className="text-gray-600">The requested roll could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md mb-4 p-6">
          <div className="text-center mb-4">
            <div className="text-blue-600 text-4xl mb-2">🧵</div>
            <h1 className="text-2xl font-bold text-gray-900">Fabric Roll Details</h1>
            <p className="text-gray-600">Unica Textiles Stock Management</p>
          </div>
          
          <div className="border-t pt-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{rollDetails.rollNumber}</h2>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(rollDetails.rollStatus)}`}>
                {rollDetails.rollStatus.replace('_', ' ')}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(rollDetails.qualityGrade)}`}>
                Grade {rollDetails.qualityGrade}
              </span>
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {rollDetails.rollType.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Roll Information */}
        <div className="bg-white rounded-lg shadow-md mb-4 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Roll Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Fabric Type:</span>
              <span className="font-medium text-gray-900">{rollDetails.fabricName}</span>
            </div>
            {rollDetails.color && (
              <div className="flex justify-between">
                <span className="text-gray-600">Color:</span>
                <span className="font-medium text-gray-900">{rollDetails.color}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Roll Length:</span>
              <span className="font-medium text-gray-900">{rollDetails.rollLength}m</span>
            </div>
            {rollDetails.remainingLength !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining Length:</span>
                <span className="font-medium text-gray-900">{rollDetails.remainingLength}m</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium text-gray-900">{rollDetails.allocationStatus}</span>
            </div>
            {rollDetails.location && (
              <div className="flex justify-between">
                <span className="text-gray-600">Location:</span>
                <span className="font-medium text-gray-900">{rollDetails.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Production Information */}
        {(rollDetails.batchNumber || rollDetails.productionOrderNumber) && (
          <div className="bg-white rounded-lg shadow-md mb-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Production Information</h3>
            <div className="space-y-3">
              {rollDetails.batchNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Batch Number:</span>
                  <span className="font-medium text-gray-900">{rollDetails.batchNumber}</span>
                </div>
              )}
              {rollDetails.productionType && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Production Type:</span>
                  <span className="font-medium text-gray-900">{rollDetails.productionType}</span>
                </div>
              )}
              {rollDetails.productionOrderNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Production Order:</span>
                  <span className="font-medium text-gray-900">{rollDetails.productionOrderNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium text-gray-900">{formatDate(rollDetails.createdAt)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Customer Information */}
        {(rollDetails.customerName || rollDetails.customerOrderNumber) && (
          <div className="bg-white rounded-lg shadow-md mb-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
            <div className="space-y-3">
              {rollDetails.customerName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium text-gray-900">{rollDetails.customerName}</span>
                </div>
              )}
              {rollDetails.customerOrderNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer Order:</span>
                  <span className="font-medium text-gray-900">{rollDetails.customerOrderNumber}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 text-sm mb-2">
            This is an official Unica Textiles fabric roll.
          </p>
          <p className="text-gray-500 text-xs">
            For inquiries, contact: info@unicatextiles.com
          </p>
        </div>
      </div>
    </div>
  )
} 