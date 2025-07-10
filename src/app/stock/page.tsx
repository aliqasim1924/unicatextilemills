'use client'

import { useState, useEffect } from 'react'
import { 
  CubeIcon, 
  PlusIcon, 
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import StockAllocationModal from '@/components/orders/StockAllocationModal'
import PDFGenerator from '@/components/pdf/generators/PDFGenerator'

interface BaseFabric {
  id: string
  name: string
  gsm: number
  width_meters: number
  color: string | null
  stock_quantity: number
  minimum_stock: number
  created_at: string
  updated_at: string
}

interface FinishedFabric {
  id: string
  name: string
  color: string | null
  gsm: number
  width_meters: number
  coating_type: string | null
  stock_quantity: number
  minimum_stock: number
  base_fabric_id: string | null
  created_at: string
  updated_at: string
  base_fabrics?: {
    name: string
  }
}

interface StockMovement {
  id: string
  fabric_type: 'base_fabric' | 'finished_fabric'
  fabric_id: string
  movement_type: 'in' | 'out' | 'allocation' | 'production'
  quantity: number
  reference_id: string | null
  reference_type: string | null
  notes: string | null
  created_at: string
  base_fabrics?: {
    name: string
  }
  finished_fabrics?: {
    name: string
  }
}

export default function StockPage() {
  const [activeTab, setActiveTab] = useState<'base' | 'finished' | 'movements'>('finished')
  const [baseFabrics, setBaseFabrics] = useState<BaseFabric[]>([])
  const [finishedFabrics, setFinishedFabrics] = useState<FinishedFabric[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllocationModal, setShowAllocationModal] = useState(false)

  useEffect(() => {
    loadStockData()
  }, [])

  const loadStockData = async () => {
    try {
      setLoading(true)
      
      // Load base data without joins first
      const [baseResponse, finishedResponse, movementsResponse] = await Promise.all([
        supabase.from('base_fabrics').select('*').order('name'),
        supabase.from('finished_fabrics').select('*').order('name'),
        supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(100)
      ])

      if (baseResponse.error) {
        console.error('Base fabrics error:', baseResponse.error)
        throw baseResponse.error
      }
      if (finishedResponse.error) {
        console.error('Finished fabrics error:', finishedResponse.error)
        throw finishedResponse.error
      }
      if (movementsResponse.error) {
        console.error('Stock movements error:', movementsResponse.error)
        throw movementsResponse.error
      }

      // Create lookup maps for fabric names
      const baseFabricsMap = new Map(baseResponse.data?.map(f => [f.id, f]) || [])
      const finishedFabricsMap = new Map(finishedResponse.data?.map(f => [f.id, f]) || [])

      // Enhance finished fabrics with base fabric names
      const enhancedFinishedFabrics = finishedResponse.data?.map(fabric => ({
        ...fabric,
        base_fabrics: fabric.base_fabric_id ? { name: baseFabricsMap.get(fabric.base_fabric_id)?.name || 'Unknown' } : null
      })) || []

      // Enhance stock movements with fabric names
      const enhancedStockMovements = movementsResponse.data?.map(movement => {
        const fabricData = movement.fabric_type === 'base_fabric' 
          ? baseFabricsMap.get(movement.fabric_id)
          : finishedFabricsMap.get(movement.fabric_id)
        
        return {
          ...movement,
          base_fabrics: movement.fabric_type === 'base_fabric' ? { name: fabricData?.name || 'Unknown' } : null,
          finished_fabrics: movement.fabric_type === 'finished_fabric' ? { name: fabricData?.name || 'Unknown' } : null
        }
      }) || []

      console.log('Data loaded successfully:', {
        baseFabrics: baseResponse.data?.length,
        finishedFabrics: enhancedFinishedFabrics.length,
        stockMovements: enhancedStockMovements.length
      })

      setBaseFabrics(baseResponse.data || [])
      setFinishedFabrics(enhancedFinishedFabrics)
      setStockMovements(enhancedStockMovements)
    } catch (error) {
      console.error('Error loading stock data:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const isLowStock = (current: number, minimum: number) => current <= minimum

  const filteredBaseFabrics = baseFabrics.filter(fabric =>
    fabric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (fabric.color && fabric.color.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredFinishedFabrics = finishedFabrics.filter(fabric =>
    fabric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (fabric.color && fabric.color.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredMovements = stockMovements.filter(movement =>
    movement.base_fabrics?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    movement.finished_fabrics?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    movement.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in':
      case 'production':
        return <ArrowUpIcon className="h-4 w-4 text-green-500" />
      case 'out':
      case 'allocation':
        return <ArrowDownIcon className="h-4 w-4 text-red-500" />
      default:
        return <ClockIcon className="h-4 w-4 text-gray-700" />
    }
  }

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'in':
      case 'production':
        return 'text-green-600'
      case 'out':
      case 'allocation':
        return 'text-red-600'
      default:
        return 'text-gray-600'
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
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Management</h1>
          <p className="mt-2 text-gray-600">Monitor and manage fabric inventory</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <PDFGenerator
            type="stock-management-report"
            buttonText="Stock Report"
            buttonClassName="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          />
          <button 
            onClick={() => setShowAllocationModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <CubeIcon className="h-4 w-4 mr-2" />
            Allocate Stock
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Stock
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <CubeIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Base Fabrics</p>
              <p className="text-2xl font-bold text-gray-900">{baseFabrics.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <CubeIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Finished Fabrics</p>
              <p className="text-2xl font-bold text-gray-900">{finishedFabrics.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-orange-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock (Base)</p>
              <p className="text-2xl font-bold text-gray-900">
                {baseFabrics.filter(f => isLowStock(f.stock_quantity, f.minimum_stock)).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock (Finished)</p>
              <p className="text-2xl font-bold text-gray-900">
                {finishedFabrics.filter(f => isLowStock(f.stock_quantity, f.minimum_stock)).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('finished')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'finished'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Finished Fabrics
            </button>
            <button
              onClick={() => setActiveTab('base')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'base'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Base Fabrics
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'movements'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              Stock Movements
            </button>
          </nav>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-600" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-600 focus:outline-none focus:placeholder-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search stock..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'finished' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Product Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Specifications
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Stock Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Base Fabric
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredFinishedFabrics.map((fabric) => (
                    <tr key={fabric.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{fabric.name}</div>
                          <div className="text-sm text-gray-700">{fabric.color}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {fabric.gsm}GSM • {fabric.width_meters}m
                        </div>
                        <div className="text-sm text-gray-700">{fabric.coating_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {fabric.stock_quantity}m
                          </div>
                          {isLowStock(fabric.stock_quantity, fabric.minimum_stock) && (
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-500 ml-2" />
                          )}
                        </div>
                        <div className="text-xs text-gray-700">
                          Min: {fabric.minimum_stock}m
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {fabric.base_fabrics?.name || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => setShowAllocationModal(true)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Allocate
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'base' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Fabric Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Specifications
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Stock Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBaseFabrics.map((fabric) => (
                    <tr key={fabric.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{fabric.name}</div>
                          <div className="text-sm text-gray-700">{fabric.color || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {fabric.gsm}GSM • {fabric.width_meters}m
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {fabric.stock_quantity}m
                          </div>
                          {isLowStock(fabric.stock_quantity, fabric.minimum_stock) && (
                            <ExclamationTriangleIcon className="h-4 w-4 text-red-500 ml-2" />
                          )}
                        </div>
                        <div className="text-xs text-gray-700">
                          Min: {fabric.minimum_stock}m
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">N/A</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900 mr-3">
                          Adjust
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'movements' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Fabric
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Movement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMovements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(movement.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {movement.fabric_type === 'base_fabric' 
                            ? movement.base_fabrics?.name 
                            : movement.finished_fabrics?.name}
                        </div>
                        <div className="text-sm text-gray-700 capitalize">
                          {movement.fabric_type.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getMovementIcon(movement.movement_type)}
                          <span className={`ml-2 text-sm font-medium capitalize ${getMovementColor(movement.movement_type)}`}>
                            {movement.movement_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${getMovementColor(movement.movement_type)}`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}m
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {movement.notes || '-'}
                        </div>
                        {movement.reference_type && (
                          <div className="text-xs text-gray-700">
                            Ref: {movement.reference_type}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Stock Allocation Modal */}
      <StockAllocationModal
        isOpen={showAllocationModal}
        onClose={() => setShowAllocationModal(false)}
        onAllocationComplete={() => {
          loadStockData() // Refresh stock data after allocation
        }}
      />
    </div>
  )
} 