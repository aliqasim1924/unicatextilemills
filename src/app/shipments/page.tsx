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

interface ShipmentItem {
  id: string
  fabric_roll_id: string
  quantity_shipped: number
  fabric_rolls: {
    roll_number: string
    roll_length: number
    qr_code: string
    fabric_type: string
    fabric_name?: string
    production_batches?: {
      batch_number: string
      production_type: string
    }
  }
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
      
      const { data, error } = await supabase
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
              production_batches (
                batch_number,
                production_type
              )
            )
          )
        `)
        .order('shipped_date', { ascending: false })

      if (error) {
        console.error('Error loading shipments:', error)
        return
      }

      // Enrich with fabric names
      const enrichedShipments = await Promise.all(
        (data || []).map(async (shipment) => {
          if (shipment.shipment_items) {
            const enrichedItems = await Promise.all(
              shipment.shipment_items.map(async (item: ShipmentItem) => {
                let fabricName = ''
                if (item.fabric_rolls) {
                  if (item.fabric_rolls.fabric_type === 'base_fabric') {
                    const { data: fabricData } = await supabase
                      .from('base_fabrics')
                      .select('name')
                      .eq('id', item.fabric_roll_id)
                      .single()
                    fabricName = fabricData?.name || 'Unknown Base Fabric'
                  } else if (item.fabric_rolls.fabric_type === 'finished_fabric') {
                    const { data: fabricData } = await supabase
                      .from('finished_fabrics')
                      .select('name')
                      .eq('id', item.fabric_roll_id)
                      .single()
                    fabricName = fabricData?.name || 'Unknown Finished Fabric'
                  }
                }
                return {
                  ...item,
                  fabric_rolls: {
                    ...item.fabric_rolls,
                    fabric_name: fabricName
                  }
                }
              })
            )
            return {
              ...shipment,
              shipment_items: enrichedItems
            }
          }
          return shipment
        })
      )

      setShipments(enrichedShipments)
    } catch (error) {
      console.error('Error loading shipments:', error)
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
              <p className="text-sm text-gray-600">In Transit</p>
              <p className="text-2xl font-bold text-blue-600">
                {shipments.filter(s => s.shipment_status === 'shipped').length}
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
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg mb-2">
                      {shipment.shipment_number}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(shipment.shipment_status)}`}>
                        {shipment.shipment_status}
                      </span>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {shipment.shipment_items?.length || 0} roll{(shipment.shipment_items?.length || 0) !== 1 ? 's' : ''}
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
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => toggleShipmentExpansion(shipment.id)}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
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
              
              {expandedShipments.has(shipment.id) && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shipment.shipment_items?.map((item) => (
                      <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-900 text-sm mb-1">
                            {item.fabric_rolls?.roll_number}
                          </h4>
                          
                          <div className="space-y-1 text-xs text-gray-600">
                            <p><strong>Fabric:</strong> {item.fabric_rolls?.fabric_name}</p>
                            <p><strong>Batch:</strong> {item.fabric_rolls?.production_batches?.batch_number}</p>
                            <p><strong>Type:</strong> {item.fabric_rolls?.production_batches?.production_type}</p>
                            <p><strong>Length:</strong> {item.fabric_rolls?.roll_length}m</p>
                          </div>
                        </div>
                        
                        {/* QR Code */}
                        <div className="flex items-center justify-center mb-4">
                          <QRCodeDisplay 
                            qrData={item.fabric_rolls?.qr_code || ''} 
                            size={100} 
                            showData={false} 
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              try {
                                const qrData = JSON.parse(item.fabric_rolls?.qr_code || '{}')
                                const downloadUrl = qrData.url
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
                              console.log('Details for shipment:', shipment.id)
                            }}
                            className="flex-1 px-3 py-2 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center justify-center gap-1"
                          >
                            <EyeIcon className="h-3 w-3" />
                            Details
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