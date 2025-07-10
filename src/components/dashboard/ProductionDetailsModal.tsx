'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon, Cog6ToothIcon, PlayIcon, PauseIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'

interface ProductionDetailsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ProductionDetail {
  id: string
  internal_order_number: string
  production_type: 'weaving' | 'coating'
  production_status: string
  quantity_required: number
  quantity_produced: number
  priority_level: number
  target_completion_date: string | null
  actual_start_date: string | null
  customer_name: string | null
  fabric_name: string
  created_at: string
  notes: string | null
}

export default function ProductionDetailsModal({ isOpen, onClose }: ProductionDetailsModalProps) {
  const [productions, setProductions] = useState<ProductionDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'overdue' | 'weaving' | 'coating'>('all')

  useEffect(() => {
    if (isOpen) {
      loadProductionDetails()
    }
  }, [isOpen])

  const loadProductionDetails = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('production_orders')
        .select(`
          *,
          customer_orders (
            customers (name)
          ),
          base_fabrics (name),
          finished_fabrics (name)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const formattedProductions: ProductionDetail[] = (data || []).map(prod => ({
        id: prod.id,
        internal_order_number: prod.internal_order_number,
        production_type: prod.production_type,
        production_status: prod.production_status || 'pending',
        quantity_required: prod.quantity_required,
        quantity_produced: prod.quantity_produced || 0,
        priority_level: prod.priority_level || 0,
        target_completion_date: prod.target_completion_date,
        actual_start_date: prod.actual_start_date,
        customer_name: prod.customer_orders?.customers?.name || null,
        fabric_name: prod.base_fabrics?.name || prod.finished_fabrics?.name || 'Unknown Fabric',
        created_at: prod.created_at,
        notes: prod.notes
      }))

      setProductions(formattedProductions)
    } catch (error) {
      console.error('Error loading production details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredProductions = () => {
    const now = new Date()
    
    switch (activeTab) {
      case 'active':
        return productions.filter(prod => ['pending', 'in_progress', 'waiting_materials'].includes(prod.production_status))
      case 'overdue':
        return productions.filter(prod => {
          if (!prod.target_completion_date) return false
          const targetDate = new Date(prod.target_completion_date)
          return targetDate < now && prod.production_status !== 'completed'
        })
      case 'weaving':
        return productions.filter(prod => prod.production_type === 'weaving')
      case 'coating':
        return productions.filter(prod => prod.production_type === 'coating')
      default:
        return productions
    }
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon }
      case 'in_progress':
        return { color: 'bg-blue-100 text-blue-800', icon: PlayIcon }
      case 'waiting_materials':
        return { color: 'bg-orange-100 text-orange-800', icon: ExclamationTriangleIcon }
      case 'on_hold':
        return { color: 'bg-red-100 text-red-800', icon: PauseIcon }
      case 'completed':
        return { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon }
      default:
        return { color: 'bg-gray-100 text-gray-800', icon: ClockIcon }
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return 'text-red-600 bg-red-100'
    if (priority >= 3) return 'text-orange-600 bg-orange-100'
    return 'text-green-600 bg-green-100'
  }

  const isOverdue = (targetDate: string | null, status: string) => {
    if (!targetDate || status === 'completed') return false
    const target = new Date(targetDate)
    const now = new Date()
    return target < now
  }

  const getProgress = (required: number, produced: number) => {
    if (required === 0) return 0
    return Math.min((produced / required) * 100, 100)
  }

  const statusCounts = {
    active: productions.filter(p => ['pending', 'in_progress', 'waiting_materials'].includes(p.production_status)).length,
    overdue: productions.filter(p => isOverdue(p.target_completion_date, p.production_status)).length,
    weaving: productions.filter(p => p.production_type === 'weaving').length,
    coating: productions.filter(p => p.production_type === 'coating').length,
    total: productions.length
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-full max-w-7xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Production Details</h3>
            <p className="text-gray-600">Production orders and manufacturing status</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Cog6ToothIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Total Orders</p>
                <p className="text-2xl font-bold text-blue-900">{statusCounts.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <PlayIcon className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Active</p>
                <p className="text-2xl font-bold text-green-900">{statusCounts.active}</p>
              </div>
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-600">Overdue</p>
                <p className="text-2xl font-bold text-red-900">{statusCounts.overdue}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Cog6ToothIcon className="h-8 w-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-purple-600">Weaving/Coating</p>
                <p className="text-2xl font-bold text-purple-900">{statusCounts.weaving}/{statusCounts.coating}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'all', label: `All Orders (${statusCounts.total})` },
              { key: 'active', label: `Active (${statusCounts.active})` },
              { key: 'overdue', label: `Overdue (${statusCounts.overdue})` },
              { key: 'weaving', label: `Weaving (${statusCounts.weaving})` },
              { key: 'coating', label: `Coating (${statusCounts.coating})` }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Production Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Production Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer/Fabric
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getFilteredProductions().map((prod) => {
                  const statusConfig = getStatusConfig(prod.production_status)
                  const progress = getProgress(prod.quantity_required, prod.quantity_produced)
                  const overdue = isOverdue(prod.target_completion_date, prod.production_status)
                  
                  return (
                    <tr key={prod.id} className={`hover:bg-gray-50 ${overdue ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{prod.internal_order_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          prod.production_type === 'weaving' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {prod.production_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm font-medium text-gray-900">{prod.fabric_name}</div>
                          {prod.customer_name && (
                            <div className="text-sm text-gray-500">Customer: {prod.customer_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="text-sm text-gray-900">
                            {prod.quantity_produced.toLocaleString()}/{prod.quantity_required.toLocaleString()} m
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className={`h-2 rounded-full ${progress >= 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{progress.toFixed(0)}% complete</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {prod.target_completion_date ? (
                          <div className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                            {new Date(prod.target_completion_date).toLocaleDateString()}
                            {overdue && (
                              <div className="text-xs text-red-500">OVERDUE</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <statusConfig.icon className="h-4 w-4 text-gray-400 mr-2" />
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusConfig.color}`}>
                            {prod.production_status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(prod.priority_level)}`}>
                          {prod.priority_level >= 5 ? 'HIGH' : prod.priority_level >= 3 ? 'MEDIUM' : 'NORMAL'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {getFilteredProductions().length === 0 && !loading && (
          <div className="text-center py-12">
            <Cog6ToothIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No production orders found</h3>
            <p className="mt-1 text-sm text-gray-500">No production orders match the current filter.</p>
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