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
import RollAllocationModal from '@/components/orders/RollAllocationModal'
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
  notes: string | null
  created_at: string
}

export default function StockPage() {
  const [baseFabrics, setBaseFabrics] = useState<BaseFabric[]>([])
  const [finishedFabrics, setFinishedFabrics] = useState<FinishedFabric[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'finished' | 'base' | 'movements' | 'batches' | 'rolls' | 'colors'>('finished')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [showRollAllocationModal, setShowRollAllocationModal] = useState(false)
  const [selectedFabric, setSelectedFabric] = useState<FinishedFabric | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  // Add state for finished fabric rolls
  const [finishedFabricRolls, setFinishedFabricRolls] = useState<any[]>([])
  const [loadingRolls, setLoadingRolls] = useState(false)

  // Add state for base fabric rolls
  const [baseFabricRolls, setBaseFabricRolls] = useState<any[]>([])
  const [loadingBaseRolls, setLoadingBaseRolls] = useState(false)

  // Add state for batches
  const [batches, setBatches] = useState<any[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [isGeneratingBatchReport, setIsGeneratingBatchReport] = useState(false)

  useEffect(() => {
    loadStockData()
    fetchFinishedFabricRolls()
    fetchBaseFabricRolls()
    fetchBatches()
  }, [])

  const loadStockData = async () => {
    try {
      setLoading(true)
      
      // Fetch base fabrics
      const { data: baseFabricsData, error: baseFabricsError } = await supabase
        .from('base_fabrics')
        .select('*')
        .order('name')
      
      if (baseFabricsError) throw baseFabricsError
      
      // Fetch finished fabrics
      const { data: finishedFabricsData, error: finishedFabricsError } = await supabase
        .from('finished_fabrics')
        .select('*, base_fabrics(name)')
        .order('name')
      
      if (finishedFabricsError) throw finishedFabricsError
      
      // Fetch recent stock movements
      const { data: movementsData, error: movementsError } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (movementsError) throw movementsError
      
      setBaseFabrics(baseFabricsData || [])
      setFinishedFabrics(finishedFabricsData || [])
      setStockMovements(movementsData || [])
    } catch (error) {
      console.error('Error loading stock data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Function to fetch finished and base fabric rolls
  const fetchFinishedFabricRolls = async () => {
    setLoadingRolls(true)
    try {
      // Only fetch non-archived, available finished fabric rolls
      const { data: finishedData, error: finishedError } = await supabase
        .from('fabric_rolls')
        .select('*')
        .eq('archived', false)
        .eq('fabric_type', 'finished_fabric')
        .order('created_at', { ascending: false })
      if (finishedError) {
        setFinishedFabricRolls([])
      } else {
        setFinishedFabricRolls(finishedData || [])
      }
    } catch (error) {
      setFinishedFabricRolls([])
    } finally {
      setLoadingRolls(false)
    }
  }

  // Function to fetch base fabric rolls (from fabric_rolls, not loom_rolls)
  const fetchBaseFabricRolls = async () => {
    setLoadingBaseRolls(true)
    try {
      // Only fetch non-archived base fabric rolls
      const { data: baseData, error: baseError } = await supabase
        .from('fabric_rolls')
        .select('*')
        .eq('archived', false)
        .eq('fabric_type', 'base_fabric')
        .order('created_at', { ascending: false })
      if (baseError) {
        setBaseFabricRolls([])
      } else {
        setBaseFabricRolls(baseData || [])
      }
    } catch (error) {
      setBaseFabricRolls([])
    } finally {
      setLoadingBaseRolls(false)
    }
  }

  const fetchBatches = async () => {
    try {
      setLoadingBatches(true)
      
      const response = await fetch('/api/production/batches')
      const result = await response.json()
      
      if (!response.ok) {
        console.error('Error fetching batches:', result.error)
        console.error('Error details:', result.details)
        console.error('Response status:', response.status)
        setBatches([])
      } else {
        setBatches(result.batches || [])
      }
    } catch (error) {
      console.error('Error fetching batches:', error)
      setBatches([])
    } finally {
      setLoadingBatches(false)
    }
  }

  const handleGenerateStockReport = async () => {
    try {
      setIsGeneratingReport(true)
      
      const response = await fetch('/api/pdf/stock-management-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          options: {
            includeMovements: true,
            includeLowStock: true
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate stock report')
      }

      // Download the PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stock-management-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Error generating stock report:', error)
      alert('Failed to generate stock report. Please try again.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const handleGenerateBatchReport = async (batchId: string) => {
    try {
      setIsGeneratingBatchReport(true)
      
      const response = await fetch('/api/pdf/batch-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchId })
      })

      if (!response.ok) {
        throw new Error('Failed to generate batch report')
      }

      // Download the PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Get batch number for filename
      const batch = batches.find(b => b.id === batchId)
      const batchNumber = batch?.batch_number || 'batch'
      
      a.download = `batch-report-${batchNumber}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Error generating batch report:', error)
      alert('Failed to generate batch report. Please try again.')
    } finally {
      setIsGeneratingBatchReport(false)
    }
  }

  const isLowStock = (current: number, minimum: number) => current <= minimum

  const filteredFinishedFabrics = finishedFabrics.filter(fabric =>
    // Only show finished fabrics that have actual stock (have been produced)
    fabric.stock_quantity > 0 && (
      fabric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fabric.color?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  const filteredBaseFabrics = baseFabrics.filter(fabric =>
    fabric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    fabric.color?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalBaseFabricStock = baseFabrics.reduce((sum, fabric) => sum + fabric.stock_quantity, 0)
  const totalFinishedFabricStock = finishedFabrics.reduce((sum, fabric) => sum + fabric.stock_quantity, 0)
  const lowStockItems = [...baseFabrics, ...finishedFabrics].filter(fabric => isLowStock(fabric.stock_quantity, fabric.minimum_stock))

  // Color-wise stock calculation based on actual fabric rolls
  const colorWiseStock = finishedFabricRolls.reduce((acc, roll) => {
    // Only include available rolls with remaining_length > 0
    if (roll.roll_status !== 'available' || (roll.remaining_length || 0) <= 0) return acc;
    const color = roll.customer_color || roll.finished_fabrics?.color || 'Natural';
    const fabricName = roll.finished_fabrics?.name || 'Unknown Fabric';
    const availableLength = roll.remaining_length || 0;

    if (!acc[color]) {
      acc[color] = {
        color,
        totalStock: 0,
        fabricBreakdown: {}
      };
    }

    acc[color].totalStock += availableLength;

    if (!acc[color].fabricBreakdown[fabricName]) {
      acc[color].fabricBreakdown[fabricName] = {
        name: fabricName,
        totalStock: 0,
        rollCount: 0
      };
    }

    acc[color].fabricBreakdown[fabricName].totalStock += availableLength;
    acc[color].fabricBreakdown[fabricName].rollCount += 1;

    return acc;
  }, {} as Record<string, {
    color: string;
    totalStock: number;
    fabricBreakdown: Record<string, { name: string; totalStock: number; rollCount: number }>;
  }>);

  // Filter out colors with 0 stock and sort by total stock
  type ColorData = { 
    color: string; 
    totalStock: number; 
    fabricBreakdown: Record<string, { name: string; totalStock: number; rollCount: number }> 
  }
  const availableColors: ColorData[] = Object.values(colorWiseStock)
    .filter((colorData: any): colorData is ColorData => colorData.totalStock > 0)
    .sort((a, b) => b.totalStock - a.totalStock)

  // Calculate total stock for each finished fabric by summing all available rolls
  const finishedFabricTotals = finishedFabrics.map(fabric => {
    const totalStock = finishedFabricRolls
      .filter(roll => roll.fabric_id === fabric.id && roll.roll_status === 'available' && (roll.remaining_length || 0) > 0)
      .reduce((sum, roll) => sum + (roll.remaining_length || 0), 0);
    return { ...fabric, totalStock };
  })

  // After allocation, refresh both finished and base fabric rolls
  const handleAllocationComplete = () => {
    loadStockData();
    fetchFinishedFabricRolls();
    fetchBaseFabricRolls();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Management</h1>
        <p className="text-gray-600">Monitor inventory levels and manage stock allocation</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CubeIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Base Fabric Stock</p>
              <p className="text-2xl font-semibold text-gray-900">{totalBaseFabricStock.toLocaleString()}m</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CubeIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Finished Fabric Stock</p>
              <p className="text-2xl font-semibold text-gray-900">{totalFinishedFabricStock.toLocaleString()}m</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
              <p className="text-2xl font-semibold text-gray-900">{lowStockItems.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Recent Movements</p>
              <p className="text-2xl font-semibold text-gray-900">{stockMovements.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fabrics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAllocationModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Quick Allocate
          </button>
          <button 
            onClick={() => setShowRollAllocationModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Select Rolls
          </button>
          <button 
            onClick={handleGenerateStockReport}
            disabled={isGeneratingReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingReport ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('finished')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'finished'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Finished Fabrics ({finishedFabrics.length})
          </button>
          <button
            onClick={() => setActiveTab('base')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'base'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Base Fabrics ({baseFabrics.length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'movements'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Stock Movements ({stockMovements.length})
          </button>
          <button
            onClick={() => setActiveTab('batches')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'batches'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Production Batches ({batches.length})
          </button>
          <button
            onClick={() => setActiveTab('rolls')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'rolls'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Individual Rolls ({finishedFabricRolls.length})
          </button>
          <button
            onClick={() => setActiveTab('colors')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'colors'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Stock by Color ({availableColors.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'finished' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Finished Fabric Inventory</h2>
              <p className="text-sm text-gray-600 mt-1">Current stock levels and allocation status</p>
            </div>
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
                      Availability
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {finishedFabricTotals.map((fabric) => (
                    <tr key={fabric.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{fabric.name}</div>
                          <div className="text-xs text-gray-500">
                            Base: {fabric.base_fabrics?.name || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div>{fabric.gsm} GSM</div>
                          <div>{fabric.width_meters}m width</div>
                          <div className="text-xs text-gray-500">{fabric.coating_type || 'Standard'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-lg font-semibold text-gray-900">
                            {fabric.totalStock.toLocaleString()}m
                          </div>
                          {isLowStock(fabric.totalStock, fabric.minimum_stock) && (
                            <ExclamationTriangleIcon className="ml-2 h-5 w-5 text-red-500" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Min: {fabric.minimum_stock}m
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-2 ${
                            fabric.totalStock > fabric.minimum_stock 
                              ? 'bg-green-400' 
                              : fabric.totalStock > 0 
                              ? 'bg-yellow-400' 
                              : 'bg-red-400'
                          }`}></div>
                          <span className={`text-sm font-medium ${
                            fabric.totalStock > fabric.minimum_stock 
                              ? 'text-green-800' 
                              : fabric.totalStock > 0 
                              ? 'text-yellow-800' 
                              : 'text-red-800'
                          }`}>
                            {fabric.totalStock > fabric.minimum_stock 
                              ? 'In Stock' 
                              : fabric.totalStock > 0 
                              ? 'Low Stock' 
                              : 'Out of Stock'
                            }
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => setSelectedFabric(fabric)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          disabled={fabric.totalStock === 0}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'base' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Base Fabric Inventory</h2>
              <p className="text-sm text-gray-600 mt-1">Raw materials for production</p>
            </div>
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
                      Availability
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
                          <div className="text-sm text-gray-700">{fabric.color || 'Natural'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div>{fabric.gsm} GSM</div>
                          <div>{fabric.width_meters}m width</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-lg font-semibold text-gray-900">
                            {fabric.stock_quantity.toLocaleString()}m
                          </div>
                          {isLowStock(fabric.stock_quantity, fabric.minimum_stock) && (
                            <ExclamationTriangleIcon className="ml-2 h-5 w-5 text-red-500" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Min: {fabric.minimum_stock}m
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-2 ${
                            fabric.stock_quantity > fabric.minimum_stock 
                              ? 'bg-green-400' 
                              : fabric.stock_quantity > 0 
                              ? 'bg-yellow-400' 
                              : 'bg-red-400'
                          }`}></div>
                          <span className={`text-sm font-medium ${
                            fabric.stock_quantity > fabric.minimum_stock 
                              ? 'text-green-800' 
                              : fabric.stock_quantity > 0 
                              ? 'text-yellow-800' 
                              : 'text-red-800'
                          }`}>
                            {fabric.stock_quantity > fabric.minimum_stock 
                              ? 'In Stock' 
                              : fabric.stock_quantity > 0 
                              ? 'Low Stock' 
                              : 'Out of Stock'
                            }
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          className="text-blue-600 hover:text-blue-900"
                          disabled={fabric.stock_quantity === 0}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'movements' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Stock Movements</h2>
              <p className="text-sm text-gray-600 mt-1">Latest inventory transactions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockMovements.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(movement.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          movement.movement_type === 'in' 
                            ? 'bg-green-100 text-green-800' 
                            : movement.movement_type === 'out'
                            ? 'bg-red-100 text-red-800'
                            : movement.movement_type === 'allocation'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {movement.movement_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movement.movement_type === 'in' ? '+' : '-'}{movement.quantity}m
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movement.reference_id || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {movement.notes || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'batches' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Production Batches</h2>
              <p className="text-sm text-gray-600 mt-1">Recent production batches with roll details</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Batch Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Production Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Customer/Purpose
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loadingBatches ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        Loading batches...
                      </td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                        No batches found
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{batch.batch_number}</div>
                          <div className="text-sm text-gray-500">
                            {batch.production_orders?.internal_order_number || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            batch.production_type === 'weaving' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {batch.production_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {batch.production_orders?.customer_orders?.customers?.name || 'Stock Building'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>{batch.planned_quantity.toLocaleString()}m planned</div>
                          <div className="text-xs text-gray-500">
                            {batch.actual_a_grade_quantity?.toLocaleString() || 0}m actual
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            batch.batch_status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : batch.batch_status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {batch.batch_status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(batch.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => handleGenerateBatchReport(batch.id)}
                            disabled={isGeneratingBatchReport}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isGeneratingBatchReport ? 'Generating...' : 'Generate Report'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'rolls' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Individual Fabric Rolls</h2>
              <p className="text-sm text-gray-600 mt-1">Available rolls by quality grade for manual allocation</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Roll Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Fabric & Quality
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Length & Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Production Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Allocation Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loadingRolls ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        Loading rolls...
                      </td>
                    </tr>
                  ) : finishedFabricRolls.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                        No rolls found
                      </td>
                    </tr>
                  ) : (
                    finishedFabricRolls.map((roll) => (
                      <tr key={roll.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{roll.roll_number}</div>
                          <div className="text-sm text-gray-500">
                            {roll.roll_type?.replace('_', ' ') || 'Standard'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {roll.finished_fabrics?.name || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {roll.customer_color || roll.finished_fabrics?.color || 'Natural'}
                            </div>
                            <div className="flex items-center mt-1">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                roll.quality_grade === 'A' 
                                  ? 'bg-green-100 text-green-800' 
                                  : roll.quality_grade === 'B'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                Grade {roll.quality_grade}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="font-medium">{roll.roll_length || 0}m total</div>
                            <div className="text-gray-700">{roll.remaining_length || 0}m available</div>
                          </div>
                          <div className="flex items-center mt-1">
                            <div className={`w-3 h-3 rounded-full mr-2 ${
                              roll.roll_status === 'available' 
                                ? 'bg-green-400' 
                                : roll.roll_status === 'partially_allocated'
                                ? 'bg-yellow-400' 
                                : 'bg-red-400'
                            }`}></div>
                            <span className={`text-xs font-medium ${
                              roll.roll_status === 'available' 
                                ? 'text-green-800' 
                                : roll.roll_status === 'partially_allocated'
                                ? 'text-yellow-800' 
                                : 'text-red-800'
                            }`}>
                              {roll.roll_status?.replace('_', ' ') || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>{roll.production_batches?.batch_number || 'N/A'}</div>
                          <div className="text-xs text-gray-500">
                            {roll.production_batches?.production_orders?.internal_order_number || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {roll.production_batches?.production_orders?.customer_orders?.customers?.name || 'Available for allocation'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {roll.roll_status === 'available' && (roll.remaining_length || 0) > 0 ? (
                            <button 
                              onClick={() => {
                                setShowRollAllocationModal(true)
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Allocate
                            </button>
                          ) : (
                            <span className="text-gray-600">Not Available</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'colors' && (
          <div>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Stock by Color</h2>
              <p className="text-sm text-gray-600 mt-1">Available stock grouped by color</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Color
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Total Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Fabrics Available
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Fabric Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {availableColors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        No colors with stock available
                      </td>
                    </tr>
                  ) : (
                    availableColors.map((colorData) => (
                      <tr key={colorData.color} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">{colorData.color}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-lg font-semibold text-gray-900">
                            {colorData.totalStock.toLocaleString()}m
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {Object.keys(colorData.fabricBreakdown).length} fabric{Object.keys(colorData.fabricBreakdown).length !== 1 ? 's' : ''}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {Object.values(colorData.fabricBreakdown).map((fabricInfo) => (
                              <div key={fabricInfo.name} className="text-sm">
                                <span className="font-medium text-gray-900">{fabricInfo.name}</span>
                                <span className="text-gray-600 ml-2">({fabricInfo.totalStock}m in {fabricInfo.rollCount} roll{fabricInfo.rollCount !== 1 ? 's' : ''})</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Stock Allocation Modal */}
      {selectedFabric && (
        <StockAllocationModal
          isOpen={true}
          onClose={() => setSelectedFabric(null)}
          onAllocationComplete={handleAllocationComplete}
        />
      )}

      {/* Allocation Modal */}
      {showAllocationModal && (
        <StockAllocationModal
          isOpen={showAllocationModal}
          onClose={() => setShowAllocationModal(false)}
          onAllocationComplete={handleAllocationComplete}
        />
      )}

      {/* Roll Allocation Modal */}
      <RollAllocationModal
        isOpen={showRollAllocationModal}
        onClose={() => setShowRollAllocationModal(false)}
        onAllocationComplete={handleAllocationComplete}
      />
    </div>
  )
} 