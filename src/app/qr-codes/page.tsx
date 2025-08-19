'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import QRCodeDisplay from '@/components/ui/QRCodeDisplay'
import { QrCodeIcon, EyeIcon, MagnifyingGlassIcon, PrinterIcon } from '@heroicons/react/24/outline'

interface FabricRoll {
  id: string
  roll_number: string
  batch_id: string
  fabric_type: 'base_fabric' | 'finished_fabric'
  fabric_id: string
  roll_length: number
  remaining_length: number
  roll_status: string
  quality_grade?: string // Added for quality grade display
  qr_code: string
  created_at: string
  fabric_name?: string // Added for display purposes
  fabric_color?: string // Added for color display
  customer_color?: string // Added for correct color display
  customer_order_id?: string // Added for customer order association
  base_fabric_id?: string // Added for base fabric association

  archived?: boolean;
  
  // Enhanced QR context
  qr_data?: {
    productionPurpose?: string
    customerOrderNumber?: string
    customerName?: string
    baseFabricName?: string // Added for base fabric display
  }
  batchNumber?: string // Added for display purposes
  productionType?: string // Added for display purposes
  orderNumber?: string // Added for display purposes
  customerName?: string // For search/filter and display
  baseFabricName?: string // For search/filter and display
}

interface LoomRoll {
  id: string
  roll_number: string
  roll_length: number
  quality_grade: string
  qr_code: string
  created_at: string
  loom_number: string
  batch_number: string
  production_type: string
  fabric_name?: string
  roll_status: string // Add this property
  qr_data?: {
    productionPurpose?: string
    customerOrderNumber?: string
    customerName?: string
  }
}

export default function QRCodesPage() {
  const [fabricRolls, setFabricRolls] = useState<FabricRoll[]>([])
  const [loomRolls, setLoomRolls] = useState<LoomRoll[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoll, setSelectedRoll] = useState<FabricRoll | LoomRoll | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'base_fabric' | 'finished_fabric' | 'loom_roll'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'allocated' | 'used'>('all')
  const [groupByBatch, setGroupByBatch] = useState(true)
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'fabric_rolls' | 'loom_rolls' | 'all'>('all')
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [selectedBatchForPrint, setSelectedBatchForPrint] = useState<string | null>(null)
  const [selectedRollsForPrint, setSelectedRollsForPrint] = useState<Set<string>>(new Set())
  const [printLoading, setPrintLoading] = useState(false)
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    loadAllRolls();
    // Subscribe to real-time changes in fabric_rolls
    const channel = supabase.channel('fabric_rolls_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fabric_rolls' },
        (payload) => {
          console.log('Real-time fabric_rolls change detected:', payload);
          loadAllRolls();
        }
      )
      .subscribe();
    subscriptionRef.current = channel;
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, []);

  const loadAllRolls = async () => {
    console.log('Loading all rolls...');
    setLoading(true)
    try {
      // First, try a simple query to test the connection
      const { data: testData, error: testError } = await supabase
        .from('fabric_rolls')
        .select('id, roll_number, fabric_type')
        .eq('archived', false)
        .limit(1)
      
      if (testError) {
        console.error('Test query error:', testError);
        setFabricRolls([])
        return
      }
      
      console.log('Test query successful, proceeding with full query...');
      
      // Now try the full query with production_batches and fabric names join
      const { data: rollsData, error: rollsError } = await supabase
        .from('fabric_rolls')
        .select(`
          *,
          production_batches (
            batch_number,
            production_type
          )
        `)
        .eq('archived', false)
        .order('created_at', { ascending: false })
      
      if (rollsError) {
        console.error('Error loading rolls:', rollsError);
        setFabricRolls([])
      } else {
        console.log(`Loaded ${rollsData?.length || 0} rolls`);
        
        // Now fetch fabric names for all rolls
        const processedRolls = await Promise.all(rollsData?.map(async (roll) => {
          // Batch info from joined production_batches
          const realBatch = (roll.production_batches as any)?.batch_number;
          const productionType = (roll.production_batches as any)?.production_type || 'Unknown';
          
          // Fetch fabric name based on fabric type
          let fabricName = null;
          let baseFabricName = null;
          
          if (roll.fabric_type === 'base_fabric') {
            // For base fabric rolls, get name from base_fabrics table
            const { data: baseFabricData } = await supabase
              .from('base_fabrics')
              .select('name')
              .eq('id', roll.fabric_id)
              .single();
            fabricName = baseFabricData?.name || null;
          } else if (roll.fabric_type === 'finished_fabric') {
            // For finished fabric rolls, get finished fabric name from finished_fabrics table
            const { data: finishedFabricData } = await supabase
              .from('finished_fabrics')
              .select('name, base_fabric_id, base_fabrics(name)')
              .eq('id', roll.fabric_id)
              .single();
            // Use finished fabric name as the primary fabric name for display
            fabricName = finishedFabricData?.name || null;
            baseFabricName = (finishedFabricData?.base_fabrics as any)?.name || null;
          }
          
          // Customer info (we'll fetch this dynamically if needed)
          let customerName = null;
          let orderNumber = null;
          
          // Try to get customer info from customer_order_id if present
          if (roll.customer_order_id) {
            // We'll need to fetch this separately if required
            // For now, leave as null and handle in a separate query if needed
          }

          // Parse existing QR code data
          let qrData = null;
          try {
            qrData = JSON.parse(roll.qr_code);
          } catch (e) {
            console.warn('Failed to parse QR code data for roll:', roll.roll_number);
          }

          const processedRoll = {
            ...roll,
            // pull the real batch number off the joined record (never fall back to the GUID)
            batchNumber: realBatch ?? '‹missing batch number›',
            productionType,
            orderNumber,
            customerName,
            fabric_name: fabricName, // Set the fabric name from fetched data
            baseFabricName,
            qr_data: {
              // always default to stock_building if not a customer order
              productionPurpose: qrData?.productionPurpose
                ?? (roll.customer_order_id ? 'customer_order' : 'stock_building'),
              customerOrderNumber: qrData?.customerOrderNumber || orderNumber,
              customerName: qrData?.customerName || customerName,
              baseFabricName: qrData?.baseFabricName || baseFabricName,
              allocationStatus: qrData?.allocationStatus || (customerName ? `Allocated to ${customerName}` : 'Available for stock building'),
            }
          };

          // Debug logging for first few rolls
          if (rollsData.indexOf(roll) < 3) {
            console.log('Processed roll:', {
              rollNumber: roll.roll_number,
              batchId: roll.batch_id,
              batchNumber: processedRoll.batchNumber,
              productionType: processedRoll.productionType,
              fabricName: processedRoll.fabric_name,
              baseFabricName: processedRoll.baseFabricName,
              customerOrderId: roll.customer_order_id,
              orderNumber: processedRoll.orderNumber,
              customerName: processedRoll.customerName,
              rollStatus: roll.roll_status
            });
          }

          return processedRoll;
        }) || []);

        console.log('Processed rolls sample:', processedRolls.slice(0, 2));
        setFabricRolls(processedRolls);
      }
    } catch (error) {
      console.error('Error in loadAllRolls:', error);
      setFabricRolls([])
    } finally {
      setLoading(false)
    }
  }

  // Type guard functions
  const isFabricRoll = (roll: FabricRoll | LoomRoll): roll is FabricRoll => {
    return 'fabric_type' in roll
  }

  const isLoomRoll = (roll: FabricRoll | LoomRoll): roll is LoomRoll => {
    return 'loom_number' in roll
  }

  // Filter functions
  const filteredRolls = fabricRolls.filter(roll => {
    const matchesSearch = searchTerm === '' || 
      roll.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.fabric_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'all' || 
      (filterType === 'base_fabric' && roll.fabric_type === 'base_fabric') ||
      (filterType === 'finished_fabric' && roll.fabric_type === 'finished_fabric')
    
    const matchesStatus = filterStatus === 'all' || roll.roll_status === filterStatus
    
    return matchesSearch && matchesType && matchesStatus
  })

  const filteredLoomRolls = loomRolls.filter(roll => {
    const matchesSearch = searchTerm === '' || 
      roll.roll_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.loom_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roll.batch_number.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'all' || filterType === 'loom_roll'
    
    const matchesStatus = filterStatus === 'all' || roll.roll_status === filterStatus
    
    return matchesSearch && matchesType && matchesStatus
  })

    // Group fabric rolls by batch
  const groupedFabricRolls = filteredRolls.reduce((acc, roll) => {
    const batchKey = roll.batchNumber || '‹missing batch number›'
    if (!acc[batchKey]) {
      acc[batchKey] = []
    }
    acc[batchKey].push(roll)
    return acc
  }, {} as Record<string, FabricRoll[]>)

  const filteredGroups = Object.entries(groupedFabricRolls).map(([batchNumber, rolls]) => {
    const firstRoll = rolls[0]
    const productionType = firstRoll.productionType || 'Unknown' // We'll get this from batch_id later if needed
    
    // Determine production purpose from QR data or production order context
    let productionPurpose = 'stock_building'
    let customerName = ''
    
    if (firstRoll.qr_data?.productionPurpose) {
      productionPurpose = firstRoll.qr_data.productionPurpose
    } else if (firstRoll.customerName) {
      productionPurpose = 'customer_order'
    } else {
      productionPurpose = 'stock_building'
    }
    
    if (firstRoll.qr_data?.customerName) {
      customerName = firstRoll.qr_data.customerName
    } else if (firstRoll.customerName) {
      customerName = firstRoll.customerName
    }
    
    return {
      batchId: firstRoll.batch_id,
      batchNumber,
      productionType,
      productionPurpose,
      customerName,
      rolls,
      totalLength: rolls.reduce((sum, roll) => sum + roll.roll_length, 0),
      availableRolls: rolls.filter(roll => roll.roll_status === 'available').length
    }
  }).sort((a, b) => b.batchNumber.localeCompare(a.batchNumber))

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

  const getAllocationStatus = (roll: FabricRoll | LoomRoll) => {
    if (isLoomRoll(roll)) {
      // For loom rolls, check if they are used for coating or still available
      switch (roll.roll_status) {
        case 'used':
          return 'Used in coating production'
        case 'allocated':
          return 'Allocated to coating order'
        case 'available':
        default:
          // Check if it's for a customer order or stock building
          if (roll.qr_data?.productionPurpose === 'customer_order' && roll.qr_data?.customerName) {
            return `Available for ${roll.qr_data.customerName}`
          }
          return 'Available for stock building'
      }
    } else {
      // For fabric rolls
      const fabricRoll = roll as FabricRoll
      switch (fabricRoll.roll_status) {
        case 'allocated':
          // Use the new customerName field directly
          if (fabricRoll.customerName) {
            return `Allocated to ${fabricRoll.customerName}`
          }
          return 'Allocated to order'
        case 'used':
          return 'Used in fulfillment'
        case 'shipped':
          return 'In Transit'
        case 'delivered':
          return 'Delivered to Customer'
        case 'available':
        default:
          // Check if it's for a customer order or stock building
          if (fabricRoll.customerName) {
            return `Available for ${fabricRoll.customerName}`
          }
          return 'Available for stock building'
      }
    }
  }

  const handlePrintBatch = (batchId: string) => {
    setSelectedBatchForPrint(batchId)
    setSelectedRollsForPrint(new Set())
    setShowPrintModal(true)
  }

  const handleSelectRollForPrint = (rollId: string) => {
    const newSelected = new Set(selectedRollsForPrint)
    if (newSelected.has(rollId)) {
      newSelected.delete(rollId)
    } else {
      newSelected.add(rollId)
    }
    setSelectedRollsForPrint(newSelected)
  }

  const handleSelectAllRollsInBatch = (batchId: string) => {
    const batch = filteredGroups.find(g => g.batchId === batchId)
    if (batch) {
      const allRollIds = batch.rolls.map(roll => roll.id)
      setSelectedRollsForPrint(new Set(allRollIds))
    }
  }

  const handleDeselectAllRolls = () => {
    setSelectedRollsForPrint(new Set())
  }

  const handlePrintSelectedRolls = async () => {
    if (selectedRollsForPrint.size === 0) return

    setPrintLoading(true)
    try {
      // Get the selected rolls data
      const selectedRollsData = fabricRolls.filter(roll => selectedRollsForPrint.has(roll.id))
      
      // Create print window with QR codes in 2x3 grid
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        alert('Please allow popups to print QR codes')
        return
      }

      // Generate HTML for printing
      const printHTML = await generatePrintHTML(selectedRollsData)
      
      printWindow.document.write(printHTML)
      printWindow.document.close()
      
      // Wait for images to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
          printWindow.close()
        }, 500)
      }
    } catch (error) {
      console.error('Error printing QR codes:', error)
      alert('Error printing QR codes. Please try again.')
    } finally {
      setPrintLoading(false)
    }
  }

  const generatePrintHTML = async (rolls: FabricRoll[]) => {
    const rollsPerPage = 4 // 2 columns × 2 rows
    const pages = Math.ceil(rolls.length / rollsPerPage)
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Codes - Batch Print</title>
        <style>
          @media print {
            body { margin: 0; }
            .page { page-break-after: always; }
            .page:last-child { page-break-after: avoid; }
          }
          
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .page {
            width: 210mm;
            height: 297mm;
            padding: 15mm;
            box-sizing: border-box;
            position: relative;
          }
          
          .page-header {
            text-align: center;
            margin-bottom: 20mm;
            border-bottom: 2px solid #333;
            padding-bottom: 10mm;
          }
          
          .page-title {
            font-size: 24px;
            font-weight: bold;
            margin: 0;
            color: #333;
          }
          
          .page-subtitle {
            font-size: 16px;
            margin: 5mm 0 0 0;
            color: #666;
          }
          
          .qr-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 15mm;
            height: 220mm;
          }
          
          .qr-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 1px solid #ccc;
            border-radius: 5mm;
            padding: 8mm;
            text-align: center;
            background: #f9f9f9;
          }
          
          .qr-code {
            width: 35mm;
            height: 35mm;
            margin-bottom: 5mm;
          }
          
          .roll-info {
            font-size: 12px;
            line-height: 1.3;
            color: #333;
          }
          
          .roll-number {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 2mm;
            color: #000;
          }
          
          .cut-line {
            position: absolute;
            background: #999;
          }
          
          .cut-line.vertical {
            width: 1px;
            height: 100%;
            left: 50%;
            top: 0;
          }
          
          .cut-line.horizontal-1 {
            height: 1px;
            width: 100%;
            top: 50%;
            left: 0;
          }
          
          .page-footer {
            position: absolute;
            bottom: 10mm;
            left: 15mm;
            right: 15mm;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 5mm;
          }
        </style>
      </head>
      <body>
    `

    for (let pageNum = 0; pageNum < pages; pageNum++) {
      const startIndex = pageNum * rollsPerPage
      const endIndex = Math.min(startIndex + rollsPerPage, rolls.length)
      const pageRolls = rolls.slice(startIndex, endIndex)
      
      html += `
        <div class="page">
          <div class="page-header">
            <h1 class="page-title">QR Codes - Batch Print</h1>
            <p class="page-subtitle">Page ${pageNum + 1} of ${pages} • Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="qr-grid">
      `
      
      // Add QR codes for this page
      for (let i = 0; i < rollsPerPage; i++) {
        if (i < pageRolls.length) {
          const roll = pageRolls[i]
          const qrData = JSON.parse(roll.qr_code)
          
          // Generate QR code for this roll
          const qrCodeDataURL = await generateQRCodeSVG(qrData)
          
          html += `
            <div class="qr-item">
              <div class="roll-number">${roll.roll_number}</div>
              <img class="qr-code" src="${qrCodeDataURL}" alt="QR Code" />
              <div class="roll-info">
                <div><strong>Fabric:</strong> ${roll.fabric_name || 'N/A'}</div>
                <div><strong>Length:</strong> ${roll.roll_length}m</div>
                <div><strong>Color:</strong> ${roll.customer_color || roll.fabric_color || 'Natural'}</div>
                <div><strong>Batch:</strong> ${roll.batchNumber || 'N/A'}</div>
              </div>
            </div>
          `
        } else {
          // Empty placeholder for incomplete pages
          html += `
            <div class="qr-item" style="border: 1px dashed #ccc; background: #f0f0f0;">
              <div style="color: #999; font-size: 14px;">No Roll</div>
            </div>
          `
        }
      }
      
      html += `
          </div>
          
          <!-- Cut lines -->
          <div class="cut-line vertical"></div>
          <div class="cut-line horizontal-1"></div>
          
          <div class="page-footer">
            <p>Unica Textile Mills SA • QR Code Batch Print • Page ${pageNum + 1} of ${pages}</p>
          </div>
        </div>
      `
    }
    
    html += `
      </body>
      </html>
    `
    
    return html
  }

  const generateQRCodeSVG = async (qrData: any): Promise<string> => {
    try {
      // Use the qrcode library to generate actual QR codes
      const QRCode = require('qrcode')
      const qrString = JSON.stringify(qrData)
      const qrDataURL = await QRCode.toDataURL(qrString, { 
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      })
      return qrDataURL
    } catch (error) {
      console.error('Error generating QR code:', error)
      // Fallback to simple SVG if QR generation fails
      const qrString = JSON.stringify(qrData)
      return `
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="white"/>
          <text x="100" y="100" text-anchor="middle" dy=".3em" font-family="monospace" font-size="8">QR Code</text>
          <text x="100" y="120" text-anchor="middle" dy=".3em" font-family="monospace" font-size="6">${qrString.substring(0, 30)}...</text>
        </svg>
      `
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
        
        <div className="flex gap-3">
          <button 
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <PrinterIcon className="h-5 w-5" />
            Print Batch
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            Generate Report
          </button>
        </div>
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
                onChange={(e) => setFilterType(e.target.value as 'all' | 'base_fabric' | 'finished_fabric' | 'loom_roll')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="base_fabric">Base Fabric</option>
                <option value="finished_fabric">Finished Fabric</option>
                <option value="loom_roll">Loom Rolls</option>
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
                onClick={loadAllRolls}
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
            <p className="text-2xl font-bold text-gray-900">{filteredRolls.length + loomRolls.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-700">Available</h3>
            <p className="text-2xl font-bold text-green-600">
              {filteredRolls.filter(r => r.roll_status === 'available').length + loomRolls.filter(r => r.roll_status === 'available').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-700">Allocated</h3>
            <p className="text-2xl font-bold text-blue-600">
              {filteredRolls.filter(r => r.roll_status === 'allocated').length + loomRolls.filter(r => r.roll_status === 'allocated').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-700">Total Length</h3>
            <p className="text-2xl font-bold text-gray-900">
              {filteredRolls.reduce((sum, roll) => sum + roll.roll_length, 0) + loomRolls.reduce((sum, roll) => sum + roll.roll_length, 0)}m
            </p>
          </div>
        </div>

      {/* Rolls Grid */}
      {groupByBatch ? (
        /* Grouped View */
        filteredGroups.length === 0 && loomRolls.length === 0 ? (
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
                          {group.productionPurpose === 'customer_order' ? 'Customer Order' : 'Stock Building'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                          {group.rolls.length} roll{group.rolls.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {group.customerName && (
                        <p className="text-sm text-gray-600">
                          <strong>Customer:</strong> {group.customerName}
                          {/* group.customerOrder is not available in the new grouped data */}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrintBatch(group.batchId)}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        <PrinterIcon className="h-3 w-3" />
                        Print
                      </button>
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
                </div>
                
                {expandedBatches.has(group.batchId) && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                              <strong>Length:</strong> {roll.roll_length}m • <strong>Colour:</strong> {
                                roll.customer_color ||
                                roll.fabric_color ||
                                'Natural'
                              }
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
            {loomRolls.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg mb-1">Loom Rolls</h3>
                      <p className="text-sm text-gray-600">
                        {loomRolls.length} rolls • {new Set(loomRolls.map(roll => roll.batch_number)).size} batches
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('loom_rolls')}
                      className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      {activeTab === 'loom_rolls' ? (
                        <>
                          <span>Hide Loom Rolls</span>
                          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </>
                      ) : (
                        <>
                          <span>Show Loom Rolls</span>
                          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {activeTab === 'loom_rolls' && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {loomRolls.map((loomRoll) => (
                        <div key={loomRoll.id} className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200">
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-900 text-sm mb-1">{loomRoll.roll_number}</h4>
                            <p className="text-xs text-gray-600 mb-1">
                              <strong>Loom:</strong> {loomRoll.loom_number}
                            </p>
                            <p className="text-xs text-gray-600 mb-1">
                              <strong>Batch:</strong> {loomRoll.batch_number}
                            </p>
                            <p className="text-xs text-gray-600 mb-1">
                              <strong>Length:</strong> {loomRoll.roll_length}m
                            </p>
                            <p className="text-xs text-gray-600 mb-3">
                              <strong>Created:</strong> {new Date(loomRoll.created_at).toLocaleDateString()}
                            </p>
                            <div className="flex items-center justify-center mb-4">
                              <QRCodeDisplay qrData={loomRoll.qr_code} size={120} showData={false} />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const qrData = JSON.parse(loomRoll.qr_code)
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
                                onClick={() => setSelectedRoll(loomRoll)}
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
            )}
          </div>
        )
      ) : (
        /* List View */
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      <strong>Batch:</strong> {roll.batchNumber || '‹missing batch number›'}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Length:</strong> {roll.roll_length}m • <strong>Colour:</strong> {
                        roll.customer_color ||
                        roll.fabric_color ||
                        'Natural'
                      }
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
              {filteredLoomRolls.map((roll) => (
                <div key={roll.id} className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200">
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">{roll.roll_number}</h4>
                    
                    <div className="flex items-center gap-1 mb-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Loom Roll
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(roll.roll_status)}`}>
                        {roll.roll_status}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Loom:</strong> {roll.loom_number}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Batch:</strong> {roll.batch_number}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Length:</strong> {roll.roll_length}m
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Grade:</strong> {roll.quality_grade}
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
                          const downloadUrl = qrData.detailsUrl
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
              {loomRolls.map((loomRoll) => (
                <div key={loomRoll.id} className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200">
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">{loomRoll.roll_number}</h4>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Loom:</strong> {loomRoll.loom_number}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Batch:</strong> {loomRoll.batch_number}
                    </p>
                    <p className="text-xs text-gray-600 mb-1">
                      <strong>Length:</strong> {loomRoll.roll_length}m
                    </p>
                    <p className="text-xs text-gray-600 mb-3">
                      <strong>Created:</strong> {new Date(loomRoll.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center justify-center mb-4">
                      <QRCodeDisplay qrData={loomRoll.qr_code} size={120} showData={false} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const qrData = JSON.parse(loomRoll.qr_code)
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
                        onClick={() => setSelectedRoll(loomRoll)}
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

      {/* Print Batch Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Print QR Codes</h3>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {selectedBatchForPrint ? (
              <div>
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-3">
                    Select Rolls to Print from Batch: {filteredGroups.find(g => g.batchId === selectedBatchForPrint)?.batchNumber}
                  </h4>
                  
                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => handleSelectAllRollsInBatch(selectedBatchForPrint)}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleDeselectAllRolls}
                      className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                      Deselect All
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredGroups.find(g => g.batchId === selectedBatchForPrint)?.rolls.map((roll) => (
                      <div 
                        key={roll.id} 
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedRollsForPrint.has(roll.id) 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleSelectRollForPrint(roll.id)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedRollsForPrint.has(roll.id)}
                            onChange={() => handleSelectRollForPrint(roll.id)}
                            className="h-4 w-4 text-blue-600 rounded"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{roll.roll_number}</div>
                            <div className="text-sm text-gray-600">
                              {roll.fabric_name} • {roll.roll_length}m
                            </div>
                            <div className="text-xs text-gray-500">
                              {roll.customer_color || roll.fabric_color || 'Natural'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => setShowPrintModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePrintSelectedRolls}
                    disabled={selectedRollsForPrint.size === 0 || printLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {printLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Printing...
                      </>
                    ) : (
                      <>
                        <PrinterIcon className="h-5 w-5" />
                        Print {selectedRollsForPrint.size} QR Code{selectedRollsForPrint.size !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Select a Batch to Print</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredGroups.map((group) => (
                    <div 
                      key={group.batchId}
                      className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors"
                      onClick={() => setSelectedBatchForPrint(group.batchId)}
                    >
                      <div className="font-medium text-gray-900">{group.batchNumber}</div>
                      <div className="text-sm text-gray-600">
                        {group.productionType} • {group.rolls.length} rolls
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {group.customerName || 'Stock Building'}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end pt-4 border-t mt-4">
                  <button
                    onClick={() => setShowPrintModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
                  <p className="text-gray-600">
                    {isFabricRoll(selectedRoll) 
                      ? selectedRoll.fabric_type.replace('_', ' ')
                      : 'Loom Roll'
                    }
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Allocation:</p>
                  <p className="text-gray-600">{getAllocationStatus(selectedRoll)}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Length:</p>
                  <p className="text-gray-600">{selectedRoll.roll_length}m</p>
                </div>
                {isFabricRoll(selectedRoll) && (
                  <div>
                    <p className="font-medium text-gray-700">Grade:</p>
                    <p className="text-gray-600">{selectedRoll.quality_grade || 'Not specified'}</p>
                  </div>
                )}
                {isLoomRoll(selectedRoll) && (
                  <>
                    <div>
                      <p className="font-medium text-gray-700">Loom:</p>
                      <p className="text-gray-600">{selectedRoll.loom_number}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Grade:</p>
                      <p className="text-gray-600">{selectedRoll.quality_grade || 'Not specified'}</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="font-medium text-gray-700">Batch:</p>
                  <p className="text-gray-600">
                    {isFabricRoll(selectedRoll) 
                      ? selectedRoll.batchNumber || '‹missing batch number›'
                      : selectedRoll.batch_number
                    }
                  </p>
                </div>
                {isFabricRoll(selectedRoll) && (
                  <div>
                    <p className="font-medium text-gray-700">Order:</p>
                    <p className="text-gray-600">{selectedRoll.orderNumber || 'N/A'}</p>
                  </div>
                )}
                {isFabricRoll(selectedRoll) && (
                  <div>
                    <p className="font-medium text-gray-700">Base Fabric:</p>
                    <p className="text-gray-600">{selectedRoll.baseFabricName || 'N/A'}</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    const qrData = JSON.parse(selectedRoll.qr_code)
                    const downloadUrl = isFabricRoll(selectedRoll) ? qrData.url : qrData.detailsUrl
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
                    const downloadUrl = isFabricRoll(selectedRoll) ? qrData.url : qrData.detailsUrl
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