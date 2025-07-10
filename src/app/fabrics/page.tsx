'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon, TrashIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import NewBaseFabricForm from '@/components/forms/NewBaseFabricForm'
import NewFinishedFabricForm from '@/components/forms/NewFinishedFabricForm'

interface BaseFabric {
  id: string
  name: string
  type: string
  gsm: number
  width_meters: number
  color: string
  supplier: string
  stock_quantity: number
  minimum_stock: number
  unit_price: number
  fabric_composition: string
  created_at: string
  updated_at: string
}

interface FinishedFabric {
  id: string
  name: string
  gsm: number
  width_meters: number
  color: string
  coating_type: string
  stock_quantity: number
  minimum_stock: number
  unit_price: number
  fabric_composition: string
  created_at: string
  updated_at: string
}

export default function FabricsPage() {
  const [activeTab, setActiveTab] = useState<'base' | 'finished'>('base')
  const [baseFabrics, setBaseFabrics] = useState<BaseFabric[]>([])
  const [finishedFabrics, setFinishedFabrics] = useState<FinishedFabric[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewBaseFabricForm, setShowNewBaseFabricForm] = useState(false)
  const [showNewFinishedFabricForm, setShowNewFinishedFabricForm] = useState(false)

  useEffect(() => {
    loadFabrics()
  }, [])

  const loadFabrics = async () => {
    try {
      setLoading(true)
      
      const [baseResponse, finishedResponse] = await Promise.all([
        supabase
          .from('base_fabrics')
          .select('*')
          .order('name'),
        supabase
          .from('finished_fabrics')
          .select(`
            *,
            base_fabrics (
              name
            )
          `)
          .order('name')
      ])

      if (baseResponse.error) {
        console.error('Error loading base fabrics:', baseResponse.error)
        return
      }
      if (finishedResponse.error) {
        console.error('Error loading finished fabrics:', finishedResponse.error)
        return
      }

      setBaseFabrics(baseResponse.data || [])
      setFinishedFabrics(finishedResponse.data || [])
    } catch (error) {
      console.error('Error loading fabrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFabricCreated = () => {
    loadFabrics()
    setShowNewBaseFabricForm(false)
    setShowNewFinishedFabricForm(false)
  }

  const handleDeleteBaseFabric = async (fabric: BaseFabric) => {
    if (!confirm(`Are you sure you want to delete "${fabric.name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('base_fabrics')
        .delete()
        .eq('id', fabric.id)

      if (error) {
        console.error('Error deleting base fabric:', error)
        alert('Error deleting fabric')
        return
      }

      loadFabrics()
    } catch (error) {
      console.error('Error deleting base fabric:', error)
      alert('Error deleting fabric')
    }
  }

  const handleDeleteFinishedFabric = async (fabric: FinishedFabric) => {
    if (!confirm(`Are you sure you want to delete "${fabric.name}"?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('finished_fabrics')
        .delete()
        .eq('id', fabric.id)

      if (error) {
        console.error('Error deleting finished fabric:', error)
        alert('Error deleting fabric')
        return
      }

      loadFabrics()
    } catch (error) {
      console.error('Error deleting finished fabric:', error)
      alert('Error deleting fabric')
    }
  }

  const filteredBaseFabrics = baseFabrics.filter(fabric =>
    fabric.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredFinishedFabrics = finishedFabrics.filter(fabric =>
    fabric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fabric.coating_type?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fabric Management</h1>
          <p className="text-gray-600">Manage your fabric catalog and specifications</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'base') {
              setShowNewBaseFabricForm(true)
            } else {
              setShowNewFinishedFabricForm(true)
            }
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add {activeTab === 'base' ? 'Base' : 'Finished'} Fabric
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('base')}
            className={`${
              activeTab === 'base'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            Base Fabrics ({baseFabrics.length})
          </button>
          <button
            onClick={() => setActiveTab('finished')}
            className={`${
              activeTab === 'finished'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-700 hover:text-gray-800 hover:border-gray-300'
            } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
          >
            Finished Fabrics ({finishedFabrics.length})
          </button>
        </nav>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-600" />
          </div>
          <input
            type="text"
            placeholder={`Search ${activeTab} fabrics...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-600 focus:outline-none focus:placeholder-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Content */}
      {activeTab === 'base' ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Base Fabrics ({filteredBaseFabrics.length})
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Base fabrics are the raw materials used for weaving. All base fabrics are natural colored (white/grey).
            </p>
            
            {filteredBaseFabrics.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-700">
                  {searchTerm ? 'No base fabrics found matching your search.' : 'No base fabrics added yet.'}
                </div>
                {!searchTerm && (
                  <button
                    onClick={() => setShowNewBaseFabricForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Your First Base Fabric
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/3">
                        Fabric Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/4">
                        Specifications
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/6">
                        Stock Levels
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/6">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider w-16">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBaseFabrics.map((fabric) => (
                      <tr key={fabric.id} className="hover:bg-gray-50 h-20">
                        <td className="px-6 py-4 whitespace-nowrap w-1/3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{fabric.name}</div>
                            <div className="text-sm text-gray-700">Natural Color</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/4">
                          <div className="text-sm text-gray-900">
                            <div>{fabric.gsm} GSM</div>
                            <div className="text-gray-700">{fabric.width_meters}m Width</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/6">
                          <div className="text-sm text-gray-900">
                            <div className={`font-medium ${
                              (fabric.stock_quantity || 0) <= (fabric.minimum_stock || 0)
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }`}>
                              {fabric.stock_quantity || 0}m
                            </div>
                            <div className="text-gray-700">Min: {fabric.minimum_stock || 0}m</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/6">
                          <div className="text-sm text-gray-700">
                            {fabric.created_at ? new Date(fabric.created_at).toLocaleDateString() : 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium w-16">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleDeleteBaseFabric(fabric)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Delete Fabric"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Finished Fabrics ({filteredFinishedFabrics.length})
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Finished fabrics are coated base fabrics. Colors are specified during the coating production process.
            </p>
            
            {filteredFinishedFabrics.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-700">
                  {searchTerm ? 'No finished fabrics found matching your search.' : 'No finished fabrics added yet.'}
                </div>
                {!searchTerm && (
                  <button
                    onClick={() => setShowNewFinishedFabricForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Your First Finished Fabric
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/3">
                        Fabric Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/4">
                        Specifications
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/6">
                        Stock Levels
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-1/6">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider w-16">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredFinishedFabrics.map((fabric) => (
                      <tr key={fabric.id} className="hover:bg-gray-50 h-20">
                        <td className="px-6 py-4 whitespace-nowrap w-1/3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{fabric.name}</div>
                            <div className="text-sm text-gray-700">
                              {fabric.color ? `Available in: ${fabric.color}` : 'Color applied during production'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 w-1/4">
                          <div className="text-sm text-gray-900">
                            <div>{fabric.gsm} GSM • {fabric.width_meters}m Width</div>
                            <div className="text-gray-700">{fabric.coating_type || 'Standard'} Coating</div>
                            <div className="text-xs text-gray-600 mt-1">
                              Base: {'Not specified'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/6">
                          <div className="text-sm text-gray-900">
                            <div className={`font-medium ${
                              (fabric.stock_quantity || 0) <= (fabric.minimum_stock || 0)
                                ? 'text-red-600' 
                                : 'text-green-600'
                            }`}>
                              {fabric.stock_quantity || 0}m
                            </div>
                            <div className="text-gray-700">Min: {fabric.minimum_stock || 0}m</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap w-1/6">
                          <div className="text-sm text-gray-700">
                            {fabric.created_at ? new Date(fabric.created_at).toLocaleDateString() : 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium w-16">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleDeleteFinishedFabric(fabric)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Delete Fabric"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <NewBaseFabricForm
        isOpen={showNewBaseFabricForm}
        onClose={() => setShowNewBaseFabricForm(false)}
        onFabricCreated={handleFabricCreated}
      />

      <NewFinishedFabricForm
        isOpen={showNewFinishedFabricForm}
        onClose={() => setShowNewFinishedFabricForm(false)}
        onFabricCreated={handleFabricCreated}
      />
    </div>
  )
} 