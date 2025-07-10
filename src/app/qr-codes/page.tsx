'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import QRCodeDisplay from '@/components/ui/QRCodeDisplay'
import { QrCodeIcon, EyeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface FabricRoll {
  id: string
  roll_number: string
  batch_id: string
  fabric_type: 'base_fabric' | 'finished_fabric'
  fabric_id: string
  roll_length: number
  remaining_length: number
  roll_status: string
  qr_code: string
  created_at: string
  fabric_name?: string // Added for display purposes
  production_batches?: {
    batch_number: string
    production_type: string
    production_orders?: {
      internal_order_number: string
      customer_order_id?: string
      customer_orders?: {
        internal_order_number: string
        customers?: {
          name: string
        }
      }
    }
  }
  base_fabrics?: {
    name: string
  } | null
  finished_fabrics?: {
    name: string
  } | null
  
  // Enhanced QR context
  qr_data?: {
    productionPurpose?: string
    customerOrderNumber?: string
    customerName?: string
  }
}

export default function QRCodesPage() {
  const [fabricRolls, setFabricRolls] = useState<FabricRoll[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoll, setSelectedRoll] = useState<FabricRoll | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'base_fabric' | 'finished_fabric'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'allocated' | 'used'>('all')
  const [groupByBatch, setGroupByBatch] = useState(true)
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadFabricRolls()
  }, [])

  const loadFabricRolls = async () => {
    try {
      setLoading(true)
      
      // Get fabric rolls with production batches
      const { data: rollsData, error: rollsError } = await supabase
        .from('fabric_rolls')
        .select(`
          *,
          production_batches (
            batch_number,
            production_type,
            production_orders (
              internal_order_number,
              customer_order_id,
              customer_orders (
                internal_order_number,
                customers (
                  name
                )
              )
            )
          )
        `)
        .not('roll_status', 'in', '(shipped,delivered)')
        .order('created_at', { ascending: false })

      if (rollsError) {
        console.error('Error loading fabric rolls:', rollsError)
        return
      }

      // Now get fabric names separately based on fabric_type
      const enrichedRolls = await Promise.all(
        (rollsData || []).map(async (roll) => {
          let fabricName = ''
          
          if (roll.fabric_type === 'base_fabric') {
            const { data: fabricData } = await supabase
              .from('base_fabrics')
              .select('name')
              .eq('id', roll.fabric_id)
              .single()
            fabricName = fabricData?.name || 'Unknown Base Fabric'
          } else if (roll.fabric_type === 'finished_fabric') {
            const { data: fabricData } = await supabase
              .from('finished_fabrics')
              .select('name')
              .eq('id', roll.fabric_id)
              .single()
            fabricName = fabricData?.name || 'Unknown Finished Fabric'
          }

          // Parse QR data for enhanced context
          let qrData = null
          try {
            qrData = JSON.parse(roll.qr_code)
          } catch {
            console.warn('Failed to parse QR code data for roll:', roll.roll_number)
          }

          return {
            ...roll,
            fabric_name: fabricName,
            // Add conditional fabric objects for backwards compatibility
            base_fabrics: roll.fabric_type === 'base_fabric' ? { name: fabricName } : null,
            finished_fabrics: roll.fabric_type === 'finished_fabric' ? { name: fabricName } : null,
            qr_data: qrData
          }
        })
      )

      setFabricRolls(enrichedRolls)
    } catch (error) {
      console.error('Error loading fabric rolls:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRolls = fabricRolls.filter(roll => {
    const matchesSearch = !searchTerm || 
      roll.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.production_batches?.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.fabric_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'all' || roll.fabric_type === filterType
    const matchesStatus = filterStatus === 'all' || roll.roll_status === filterStatus
    
    return matchesSearch && matchesType && matchesStatus
  })

  // Group rolls by production batch
  const groupedByBatch = fabricRolls.reduce((groups, roll) => {
    const batchId = roll.batch_id
    const batchNumber = roll.production_batches?.batch_number || 'Unknown Batch'
    
    if (!groups[batchId]) {
      groups[batchId] = {
        batchId,
        batchNumber,
        productionType: roll.production_batches?.production_type || 'unknown',
        productionPurpose: roll.qr_data?.productionPurpose || 'stock_building',
        customerOrder: roll.production_batches?.production_orders?.customer_orders?.internal_order_number,
        customerName: roll.production_batches?.production_orders?.customer_orders?.customers?.name,
        rolls: []
      }
    }
    
    groups[batchId].rolls.push(roll)
    return groups
  }, {} as Record<string, {
    batchId: string
    batchNumber: string
    productionType: string
    productionPurpose: string
    customerOrder?: string
    customerName?: string
    rolls: FabricRoll[]
  }>)

  // Apply filters to grouped data
  const filteredGroups = Object.values(groupedByBatch).filter(group => {
    // Filter the rolls within each group
    group.rolls = group.rolls.filter(roll => {
      const matchesSearch = !searchTerm || 
        roll.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        roll.production_batches?.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        roll.fabric_name?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesType = filterType === 'all' || roll.fabric_type === filterType
      const matchesStatus = filterStatus === 'all' || roll.roll_status === filterStatus
      
      return matchesSearch && matchesType && matchesStatus
    })
    
    // Only include groups that have rolls after filtering
    return group.rolls.length > 0
  })

  const toggleBatchExpansion = (batchId: string) => {
    const newExpanded = new Set(expandedBatches)
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId)
    } else {
      newExpanded.add(batchId)
    }
    setExpandedBatches(newExpanded)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-50'
      case 'allocated': return 'text-blue-600 bg-blue-50'
      case 'used': return 'text-gray-600 bg-gray-50'
      case 'damaged': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'base_fabric': return 'text-purple-600 bg-purple-50'
      case 'finished_fabric': return 'text-orange-600 bg-orange-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">QR Codes</h1>
          <p className="text-gray-600">View and manage fabric roll QR codes (active rolls only)</p>
        </div>
        
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          Generate Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-600" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search rolls, batches, fabrics..."
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="fabric-type" className="block text-sm font-medium text-gray-700 mb-2">
                Fabric Type
              </label>
              <select
                id="fabric-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'base_fabric' | 'finished_fabric')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="base_fabric">Base Fabric</option>
                <option value="finished_fabric">Finished Fabric</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'available' | 'allocated' | 'used')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="allocated">Allocated</option>
                <option value="used">Used</option>
              </select>
            </div>

            <div>
              <label htmlFor="grouping" className="block text-sm font-medium text-gray-700 mb-2">
                View Mode
              </label>
              <select
                id="grouping"
                value={groupByBatch ? 'batch' : 'list'}
                onChange={(e) => setGroupByBatch(e.target.value === 'batch')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="batch">Group by Batch</option>
                <option value="list">List View</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={loadFabricRolls}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-700">Total Rolls</h3>
            <p className="text-2xl font-bold text-gray-900">{filteredRolls.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-700">Available</h3>
            <p className="text-2xl font-bold text-green-600">
              {filteredRolls.filter(r => r.roll_status === 'available').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-700">Allocated</h3>
            <p className="text-2xl font-bold text-blue-600">
              {filteredRolls.filter(r => r.roll_status === 'allocated').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-700">Total Length</h3>
            <p className="text-2xl font-bold text-gray-900">
              {filteredRolls.reduce((sum, roll) => sum + roll.roll_length, 0)}m
            </p>
          </div>
        </div>

      {/* Rolls Grid */}
      {groupByBatch ? (
        /* Grouped View */
        filteredGroups.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow-sm text-center">
            <QrCodeIcon className="h-16 w-16 mx-auto text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Production Batches Found</h3>
            <p className="text-gray-600">No fabric rolls match your current filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.batchId} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg mb-2">
                        {group.batchNumber}
                      </h3>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {group.productionType}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          group.productionPurpose === 'customer_order' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {group.productionPurpose.replace('_', ' ')}
                        </span>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                          {group.rolls.length} roll{group.rolls.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {group.customerName && (
                        <p className="text-sm text-gray-600">
                          <strong>Customer:</strong> {group.customerName}
                          {group.customerOrder && ` (${group.customerOrder})`}
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => toggleBatchExpansion(group.batchId)}
                      className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      {expandedBatches.has(group.batchId) ? (
                        <>
                          <span>Hide Rolls</span>
                          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          <span>Show Rolls</span>
                          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {expandedBatches.has(group.batchId) && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {group.rolls.map((roll) => (
                        <div key={roll.id} className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200">
                          {/* Roll Info */}
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-900 text-sm mb-1">{roll.roll_number}</h4>
                            
                            <div className="flex items-center gap-1 mb-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(roll.fabric_type)}`}>
                                {roll.fabric_type.replace('_', ' ')}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(roll.roll_status)}`}>
                                {roll.roll_status}
                              </span>
                            </div>
                            
                            <p className="text-xs text-gray-600 mb-1">
                              <strong>Fabric:</strong> {roll.fabric_name}
                            </p>
                            <p className="text-xs text-gray-600 mb-1">
                              <strong>Length:</strong> {roll.roll_length}m (Remaining: {roll.remaining_length}m)
                            </p>
                            <p className="text-xs text-gray-600 mb-3">
                              <strong>Created:</strong> {new Date(roll.created_at).toLocaleDateString()}
                            </p>
                            
                            {/* QR Code */}
                            <div className="flex items-center justify-center mb-4">
                              <QRCodeDisplay qrData={roll.qr_code} size={120} showData={false} />
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const qrData = JSON.parse(roll.qr_code)
                                  const downloadUrl = qrData.url
                                  if (downloadUrl) {
                                    window.open(downloadUrl, '_blank')
                                  }
                                }}
                                className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                              >
                                <span>📄</span>
                                Download
                              </button>
                              
                              <button
                                onClick={() => setSelectedRoll(roll)}
                                className="flex-1 px-3 py-2 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                              >
                                <EyeIcon className="h-3 w-3" />
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* List View */
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRolls.map((roll) => (
                <div key={roll.id} className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200">
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">{roll.roll_number}</h4>
                    
                    <div className="flex items-center gap-1 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(roll.fabric_type)}`}>
                        {roll.fabric_type.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(roll.roll_status)}`}>
                        {roll.roll_status}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Fabric:</strong> {roll.fabric_name}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Batch:</strong> {roll.production_batches?.batch_number || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Length:</strong> {roll.roll_length}m (Remaining: {roll.remaining_length}m)
                    </p>
                    <p className="text-xs text-gray-600 mb-3">
                      <strong>Created:</strong> {new Date(roll.created_at).toLocaleDateString()}
                    </p>
                    
                    {/* QR Code */}
                                         <div className="flex items-center justify-center mb-4">
                       <QRCodeDisplay qrData={roll.qr_code} size={120} showData={false} />
                     </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const qrData = JSON.parse(roll.qr_code)
                          const downloadUrl = qrData.url
                          if (downloadUrl) {
                            window.open(downloadUrl, '_blank')
                          }
                        }}
                        className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <span>📄</span>
                        Download
                      </button>
                      
                      <button
                        onClick={() => setSelectedRoll(roll)}
                        className="flex-1 px-3 py-2 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <EyeIcon className="h-3 w-3" />
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Roll Details Modal */}
      {selectedRoll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Roll Details</h3>
              <button
                onClick={() => setSelectedRoll(null)}
                className="text-gray-600 hover:text-gray-800"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
                             <div className="text-center">
                 <QRCodeDisplay qrData={selectedRoll.qr_code} size={200} showData={false} />
                 <p className="text-sm text-gray-600 mt-2">Roll: {selectedRoll.roll_number}</p>
               </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-700">Fabric:</p>
                  <p className="text-gray-600">{selectedRoll.fabric_name}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Type:</p>
                  <p className="text-gray-600">{selectedRoll.fabric_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Status:</p>
                  <p className="text-gray-600">{selectedRoll.roll_status}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Length:</p>
                  <p className="text-gray-600">{selectedRoll.roll_length}m</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Remaining:</p>
                  <p className="text-gray-600">{selectedRoll.remaining_length}m</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Batch:</p>
                  <p className="text-gray-600">{selectedRoll.production_batches?.batch_number || 'Unknown'}</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    const qrData = JSON.parse(selectedRoll.qr_code)
                    const downloadUrl = qrData.url
                    if (downloadUrl) {
                      window.open(downloadUrl, '_blank')
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>📄</span>
                  Download PDF
                </button>
                
                <button
                  onClick={() => {
                    const qrData = JSON.parse(selectedRoll.qr_code)
                    const downloadUrl = qrData.url
                    if (downloadUrl) {
                      window.open(`${downloadUrl}?format=txt`, '_blank')
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>📝</span>
                  Download Text
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 