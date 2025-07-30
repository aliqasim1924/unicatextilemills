'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { 
  TruckIcon, 
  EyeIcon, 
  CalendarIcon,
  QrCodeIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import QRCodeDisplay from '@/components/ui/QRCodeDisplay'

interface FabricRoll {
  roll_number: string
  roll_length: number
  remaining_length?: number
  qr_code: string
  fabric_type: string
  customer_color?: string
  roll_status?: string
  quality_grade?: string
  created_at?: string
  production_batches?: {
    batch_number: string
    production_type: string
  }
  finished_fabrics?: {
    name: string
    color: string
  } | null
  base_fabrics?: {
    name: string
  } | null
  parsed_qr_code?: any // Add this line for parsed QR code JSON
}

interface ShipmentItem {
  id: string
  fabric_roll_id: string
  quantity_shipped: number
  fabric_rolls: FabricRoll | null
}

interface Shipment {
  id: string
  shipment_number: string
  customer_order_id: string
  shipped_date: string
  delivery_date: string | null
  shipment_status: 'preparing' | 'shipped' | 'delivered' | 'returned'
  tracking_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Related data
  customer_orders?: {
    internal_order_number: string
    customers: {
      name: string
      email: string
      phone: string
    }
  }
  shipment_items?: ShipmentItem[]
  qr_codes?: {
    id: string
    code_data: string
    status: string
    archived: boolean
  }[]
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedShipments, setExpandedShipments] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadShipments()
  }, [])

      const loadShipments = async () => {
    try {
      setLoading(true)
      
      // First check if there are any shipments at all
      const { data: shipmentCount, error: countError } = await supabase
        .from('shipments')
        .select('id', { count: 'exact' })
      
      if (countError) {
        console.error('Error checking shipments count:', countError)
        setShipments([])
        return
      }
      
      if (!shipmentCount || shipmentCount.length === 0) {
        console.log('No shipments found')
        setShipments([])
        return
      }
      
      // Load existing shipments with QR codes for each roll
      const { data: shipments, error: shipmentsError } = await supabase
        .from('shipments')
        .select(`
          *,
          customer_orders (
            internal_order_number,
            customers (
              name,
              email,
              phone
            )
          ),
          shipment_items (
            id,
            fabric_roll_id,
            quantity_shipped,
            fabric_rolls (
              roll_number,
              roll_length,
              qr_code,
              fabric_type,
              roll_status
            )
          )
        `)
        .order('shipped_date', { ascending: false })
      
      if (shipmentsError) {
        console.error('Error loading shipments:', shipmentsError)
        setShipments([])
        return
      }
      
      // Parse QR code JSON for each roll in shipment_items
      const enrichedShipments = (shipments || []).map(shipment => ({
        ...shipment,
        shipment_items: (shipment.shipment_items || []).map((item: ShipmentItem) => ({
          ...item,
          fabric_rolls: item.fabric_rolls ? {
            ...item.fabric_rolls,
            parsed_qr_code: (() => {
              try {
                return JSON.parse(item.fabric_rolls.qr_code || '{}')
              } catch {
                return null
              }
            })()
          } : null
        }))
      }))
      setShipments(enrichedShipments)
    } catch (error) {
      console.error('Error loading shipments:', error)
      setShipments([])
    } finally {
      setLoading(false)
    }
  }

  const filteredShipments = shipments.filter(shipment => {
    const matchesSearch = !searchTerm || 
      shipment.shipment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.customer_orders?.internal_order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.customer_orders?.customers?.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || shipment.shipment_status === filterStatus
    
    return matchesSearch && matchesStatus
  })

  const toggleShipmentExpansion = (shipmentId: string) => {
    const newExpanded = new Set(expandedShipments)
    if (newExpanded.has(shipmentId)) {
      newExpanded.delete(shipmentId)
    } else {
      newExpanded.add(shipmentId)
    }
    setExpandedShipments(newExpanded)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preparing': return 'bg-yellow-100 text-yellow-800'
      case 'shipped': return 'bg-blue-100 text-blue-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'returned': return 'bg-red-100 text-red-800'
      case 'available': return 'bg-green-100 text-green-800'
      case 'allocated': return 'bg-blue-100 text-blue-800'
      case 'used': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'base_fabric': return 'bg-orange-100 text-orange-800'
      case 'finished_fabric': return 'bg-indigo-100 text-indigo-800'
      default: return 'bg-gray-100 text-gray-800'
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
          <h1 className="text-2xl font-bold text-gray-900">Shipments & Deliveries</h1>
          <p className="text-gray-600">Track rolls sent to customers</p>
        </div>
        
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          New Shipment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">{shipments.length}</p>
            </div>
            <TruckIcon className="h-8 w-8 text-gray-600" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ready/In Transit</p>
              <p className="text-2xl font-bold text-blue-600">
                {shipments.filter(s => s.shipment_status === 'preparing' || s.shipment_status === 'shipped').length}
              </p>
            </div>
            <TruckIcon className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Delivered</p>
              <p className="text-2xl font-bold text-green-600">
                {shipments.filter(s => s.shipment_status === 'delivered').length}
              </p>
            </div>
            <CalendarIcon className="h-8 w-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Rolls</p>
              <p className="text-2xl font-bold text-gray-900">
                {shipments.reduce((sum, s) => sum + (s.shipment_items?.length || 0), 0)}
              </p>
            </div>
            <QrCodeIcon className="h-8 w-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <TruckIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="preparing">Preparing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="returned">Returned</option>
          </select>
          
          <input
            type="text"
            placeholder="Search shipments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-900 flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Shipments List */}
      <div className="space-y-4">
        {filteredShipments.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow border text-center">
            <TruckIcon className="h-16 w-16 mx-auto text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Shipments Found</h3>
            <p className="text-gray-600">
              {shipments.length === 0 
                ? "No shipments have been created yet." 
                : "No shipments match your current filters."}
            </p>
          </div>
        ) : (
          filteredShipments.map((shipment) => (
            <div key={shipment.id} className="bg-white rounded-lg shadow border border-gray-200">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {shipment.shipment_number}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(shipment.shipment_status)}`}>
                        {shipment.shipment_status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <p><strong>Customer:</strong> {shipment.customer_orders?.customers?.name}</p>
                        <p><strong>Order:</strong> {shipment.customer_orders?.internal_order_number}</p>
                      </div>
                      <div>
                        <p><strong>Shipped:</strong> {new Date(shipment.shipped_date).toLocaleDateString()}</p>
                        {shipment.delivery_date && (
                          <p><strong>Delivered:</strong> {new Date(shipment.delivery_date).toLocaleDateString()}</p>
                        )}
                      </div>
                      <div>
                        {shipment.tracking_number && (
                          <p><strong>Tracking:</strong> {shipment.tracking_number}</p>
                        )}
                        <p><strong>Items:</strong> {shipment.shipment_items?.length || 0} rolls</p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleShipmentExpansion(shipment.id)}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors ml-4"
                  >
                    {expandedShipments.has(shipment.id) ? (
                      <>
                        <span>Hide Items</span>
                        <ChevronDownIcon className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <span>Show Items</span>
                        <ChevronRightIcon className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Expandable Items Section */}
              {expandedShipments.has(shipment.id) && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shipment.shipment_items?.map((item) => (
                      <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200">
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-900 text-sm mb-1">
                            {item.fabric_rolls?.roll_number}
                          </h4>
                          
                          <div className="flex items-center gap-1 mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.fabric_rolls?.fabric_type || '')}`}>
                              {item.fabric_rolls?.fabric_type?.replace('_', ' ') || 'Unknown'}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.fabric_rolls?.roll_status || '')}`}>
                              {item.fabric_rolls?.roll_status || 'Unknown'}
                            </span>
                          </div>
                          
                                                      <div className="space-y-1 text-xs text-gray-600">
                              <p><strong>Length:</strong> {item.fabric_rolls?.roll_length}m</p>
                              <p><strong>Status:</strong> {item.fabric_rolls?.roll_status || 'Unknown'}</p>
                          </div>
                        </div>
                        
                        {/* QR Code */}
                        <div className="flex items-center justify-center mb-4">
                          <QRCodeDisplay 
                            qrData={item.fabric_rolls?.qr_code || ''} 
                            size={120} 
                            showData={false} 
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              try {
                                const qrData = JSON.parse(item.fabric_rolls?.qr_code || '{}')
                                const downloadUrl = qrData.url || qrData.detailsUrl
                                if (downloadUrl) {
                                  window.open(downloadUrl, '_blank')
                                }
                              } catch (e) {
                                console.error('Failed to parse QR code:', e)
                              }
                            }}
                            className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                          >
                            <span>📄</span>
                            Download
                          </button>
                          
                          <button
                            onClick={() => {
                              // Details functionality not implemented yet
                            }}
                            className="flex-1 px-3 py-2 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                          >
                            <EyeIcon className="h-3 w-3" />
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
} 