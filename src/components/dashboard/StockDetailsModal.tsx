'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, ExclamationTriangleIcon, CubeIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'

interface StockDetailsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface StockItem {
  id: string
  name: string
  type: 'base_fabric' | 'finished_fabric'
  stock_quantity: number
  minimum_stock: number
  gsm?: number
  width_meters?: number
  color?: string | null
  coating_type?: string | null
  base_fabric_name?: string | null
}

export default function StockDetailsModal({ isOpen, onClose }: StockDetailsModalProps) {
  const [stockData, setStockData] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'low_stock' | 'base' | 'finished'>('all')

  useEffect(() => {
    if (isOpen) {
      loadStockDetails()
    }
  }, [isOpen])

  const loadStockDetails = async () => {
    try {
      setLoading(true)
      
      // Load base fabrics
      const { data: baseFabrics, error: baseError } = await supabase
        .from('base_fabrics')
        .select('*')
        .order('name')

      if (baseError) throw baseError

      // Load finished fabrics with base fabric names
      const { data: finishedFabrics, error: finishedError } = await supabase
        .from('finished_fabrics')
        .select(`
          *,
          base_fabrics (name)
        `)
        .order('name')

      if (finishedError) throw finishedError

      // Combine and format data
      const allStock: StockItem[] = [
        ...(baseFabrics || []).map(fabric => ({
          id: fabric.id,
          name: fabric.name,
          type: 'base_fabric' as const,
          stock_quantity: fabric.stock_quantity || 0,
          minimum_stock: fabric.minimum_stock || 0,
          gsm: fabric.gsm,
          width_meters: fabric.width_meters,
          color: fabric.color
        })),
        ...(finishedFabrics || []).map(fabric => ({
          id: fabric.id,
          name: fabric.name,
          type: 'finished_fabric' as const,
          stock_quantity: fabric.stock_quantity || 0,
          minimum_stock: fabric.minimum_stock || 0,
          gsm: fabric.gsm,
          width_meters: fabric.width_meters,
          color: fabric.color,
          coating_type: fabric.coating_type,
          base_fabric_name: fabric.base_fabrics?.name || null
        }))
      ]

      setStockData(allStock)
    } catch (error) {
      console.error('Error loading stock details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredStock = () => {
    switch (activeTab) {
      case 'low_stock':
        return stockData.filter(item => item.stock_quantity <= item.minimum_stock)
      case 'base':
        return stockData.filter(item => item.type === 'base_fabric')
      case 'finished':
        return stockData.filter(item => item.type === 'finished_fabric')
      default:
        return stockData
    }
  }

  const getStockStatus = (current: number, minimum: number) => {
    if (current <= 0) return { status: 'out_of_stock', color: 'text-red-600', bg: 'bg-red-100' }
    if (current <= minimum) return { status: 'low_stock', color: 'text-orange-600', bg: 'bg-orange-100' }
    if (current <= minimum * 2) return { status: 'warning', color: 'text-yellow-600', bg: 'bg-yellow-100' }
    return { status: 'good', color: 'text-green-600', bg: 'bg-green-100' }
  }

  const totalValue = stockData.reduce((sum, item) => sum + item.stock_quantity, 0)
  const lowStockCount = stockData.filter(item => item.stock_quantity <= item.minimum_stock).length
  const outOfStockCount = stockData.filter(item => item.stock_quantity <= 0).length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-full max-w-6xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Stock Details</h3>
            <p className="text-gray-600">Comprehensive inventory overview</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CubeIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Items</p>
                <p className="text-2xl font-bold text-blue-900">{stockData.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CubeIcon className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Total Stock</p>
                <p className="text-2xl font-bold text-purple-900">{totalValue.toLocaleString()} m</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-orange-600">Low Stock</p>
                <p className="text-2xl font-bold text-orange-900">{lowStockCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-600">Out of Stock</p>
                <p className="text-2xl font-bold text-red-900">{outOfStockCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'all', label: `All Items (${stockData.length})` },
              { key: 'low_stock', label: `Low Stock (${lowStockCount})` },
              { key: 'base', label: `Base Fabrics (${stockData.filter(s => s.type === 'base_fabric').length})` },
              { key: 'finished', label: `Finished Fabrics (${stockData.filter(s => s.type === 'finished_fabric').length})` }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Stock Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Specifications
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Current Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Min Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredStock().map((item) => {
                  const status = getStockStatus(item.stock_quantity, item.minimum_stock)
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          {item.color && (
                            <div className="text-sm text-gray-700">Color: {item.color}</div>
                          )}
                          {item.base_fabric_name && (
                            <div className="text-sm text-gray-700">Base: {item.base_fabric_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.type === 'base_fabric' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {item.type === 'base_fabric' ? 'Base Fabric' : 'Finished Fabric'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span>{item.gsm}g/m² × {item.width_meters}m</span>
                          {item.coating_type && (
                            <span className="text-gray-700">Coating: {item.coating_type}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.stock_quantity.toLocaleString()} m
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.minimum_stock.toLocaleString()} m
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.color}`}>
                          {status.status === 'out_of_stock' && 'Out of Stock'}
                          {status.status === 'low_stock' && 'Low Stock'}
                          {status.status === 'warning' && 'Reorder Soon'}
                          {status.status === 'good' && 'Good Stock'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {getFilteredStock().length === 0 && !loading && (
          <div className="text-center py-12">
            <CubeIcon className="mx-auto h-12 w-12 text-gray-600" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No stock items found</h3>
            <p className="mt-1 text-sm text-gray-700">
              {activeTab === 'low_stock' 
                ? 'All items have sufficient stock levels.' 
                : 'No stock items match the current filter.'
              }
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
} 