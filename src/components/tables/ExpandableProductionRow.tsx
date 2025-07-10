'use client'

import { useState } from 'react'
import { 
  PlayIcon, 
  PauseIcon, 
  CheckCircleIcon, 
  ClockIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CalendarIcon,
  CubeIcon
} from '@heroicons/react/24/outline'
import PDFGenerator from '@/components/pdf/generators/PDFGenerator'

interface ProductionOrder {
  id: string
  internal_order_number: string
  customer_order_id: string | null
  production_type: 'weaving' | 'coating'
  base_fabric_id: string | null
  finished_fabric_id: string | null
  quantity_required: number
  quantity_produced: number
  production_status: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'waiting_materials'
  priority_level: number
  production_sequence: number | null
  planned_start_date: string | null
  planned_end_date: string | null
  target_completion_date: string | null
  actual_start_date: string | null
  actual_end_date: string | null
  linked_production_order_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Related data
  customer_orders?: {
    internal_order_number: string
    customers: {
      name: string
    }
  } | null
  base_fabrics?: {
    name: string
    stock_quantity: number
  } | null
  finished_fabrics?: {
    name: string
    stock_quantity: number
  } | null
  linked_production_order?: {
    internal_order_number: string
    production_type: string
    production_status: string
  } | null
}

interface ExpandableProductionRowProps {
  order: ProductionOrder
  onStatusUpdate: (orderId: string, newStatus: string) => void
  onView: (order: ProductionOrder) => void
  onEdit: (order: ProductionOrder) => void
  onDelete: (order: ProductionOrder) => void
}

const statusConfig = {
  pending: { 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    icon: ClockIcon,
    label: 'Pending'
  },
  waiting_materials: { 
    color: 'bg-orange-100 text-orange-800 border-orange-200', 
    icon: ExclamationTriangleIcon,
    label: 'Waiting Materials'
  },
  in_progress: { 
    color: 'bg-blue-100 text-blue-800 border-blue-200', 
    icon: PlayIcon,
    label: 'In Progress'
  },
  on_hold: { 
    color: 'bg-red-100 text-red-800 border-red-200', 
    icon: PauseIcon,
    label: 'On Hold'
  },
  completed: { 
    color: 'bg-green-100 text-green-800 border-green-200', 
    icon: CheckCircleIcon,
    label: 'Completed'
  }
}

const priorityConfig = {
  0: { label: 'Normal', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  1: { label: 'Low', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  3: { label: 'Medium', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  5: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  8: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' }
}

export default function ExpandableProductionRow({ 
  order, 
  onStatusUpdate, 
  onView, 
  onEdit, 
  onDelete 
}: ExpandableProductionRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusInfo = statusConfig[order.production_status]
  const StatusIcon = statusInfo.icon
  const priorityInfo = priorityConfig[order.priority_level as keyof typeof priorityConfig]
  const progressPercentage = Math.round((order.quantity_produced / order.quantity_required) * 100)
  
  const isOverdue = order.target_completion_date && 
    new Date(order.target_completion_date) < new Date() && 
    order.production_status !== 'completed'

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getAvailableActions = () => {
    const actions = []
    
    switch (order.production_status) {
      case 'pending':
        actions.push({
          label: 'Start Production',
          icon: PlayIcon,
          onClick: () => onStatusUpdate(order.id, 'in_progress'),
          color: 'text-blue-600 hover:text-blue-800'
        })
        break
      
      case 'in_progress':
        actions.push({
          label: 'Mark Complete',
          icon: CheckCircleIcon,
          onClick: () => onStatusUpdate(order.id, 'completed'),
          color: 'text-green-600 hover:text-green-800'
        })
        actions.push({
          label: 'Put On Hold',
          icon: PauseIcon,
          onClick: () => onStatusUpdate(order.id, 'on_hold'),
          color: 'text-orange-600 hover:text-orange-800'
        })
        break
      
      case 'on_hold':
        actions.push({
          label: 'Resume Production',
          icon: PlayIcon,
          onClick: () => onStatusUpdate(order.id, 'in_progress'),
          color: 'text-blue-600 hover:text-blue-800'
        })
        break
    }

    return actions
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <>
      {/* Main Row - Clickable to expand */}
      <tr 
        className={`cursor-pointer transition-colors duration-150 ${
          isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'
        } ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}
        onClick={toggleExpanded}
      >
        {/* Order Info with Expand Icon */}
        <td className="px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDownIcon className="h-5 w-5 text-gray-600" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-gray-600" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">
                  {order.internal_order_number}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityInfo.bgColor} ${priorityInfo.color}`}>
                  {priorityInfo.label}
                </span>
              </div>
              <div className="text-sm text-gray-900 capitalize">
                {order.production_type} Production
              </div>
            </div>
          </div>
        </td>

        {/* Material */}
        <td className="px-6 py-4">
          <div className="text-sm text-gray-900">
            {order.production_type === 'weaving' 
              ? order.base_fabrics?.name 
              : order.finished_fabrics?.name}
          </div>
          <div className="text-sm text-gray-900">
            {order.quantity_required}m required
          </div>
        </td>

        {/* Progress */}
        <td className="px-6 py-4">
          <div className="flex items-center">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{order.quantity_produced}m</span>
                <span className="text-gray-900 font-medium">{progressPercentage}%</span>
              </div>
              <div className="mt-1">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      progressPercentage === 100 ? 'bg-green-500' : 
                      progressPercentage > 0 ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                    style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="px-6 py-4">
          <div className="flex items-center space-x-2">
            <StatusIcon className={`h-4 w-4 ${statusInfo.color.includes('yellow') ? 'text-yellow-600' : 
              statusInfo.color.includes('blue') ? 'text-blue-600' :
              statusInfo.color.includes('green') ? 'text-green-600' :
              statusInfo.color.includes('red') ? 'text-red-600' : 'text-orange-600'}`} />
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </td>

        {/* Target Date */}
        <td className="px-6 py-4">
          <div className="flex items-center space-x-1">
            <CalendarIcon className="h-4 w-4 text-gray-600" />
            <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
              {formatDate(order.target_completion_date)}
            </span>
          </div>
          {isOverdue && (
            <div className="text-xs text-red-500 font-medium">Overdue</div>
          )}
        </td>
      </tr>

      {/* Expanded Row Content */}
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={5} className="px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column - Details */}
              <div className="space-y-4">
                
                {/* Customer Info */}
                {order.customer_orders && (
                  <div className="bg-white rounded-lg p-4 border">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Customer Information</h4>
                    <div className="space-y-1 text-sm">
                      <div><span className="text-gray-900 font-medium">Customer:</span> <span className="text-gray-900">{order.customer_orders.customers?.name}</span></div>
                      <div><span className="text-gray-900 font-medium">Order:</span> <span className="text-gray-900">{order.customer_orders.internal_order_number}</span></div>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="bg-white rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Timeline
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-gray-900 font-medium">Created:</span> <span className="text-gray-900">{formatDate(order.created_at)}</span></div>
                    <div><span className="text-gray-900 font-medium">Target:</span> <span className="text-gray-900">{formatDate(order.target_completion_date)}</span></div>
                    {order.actual_start_date && (
                      <div><span className="text-gray-900 font-medium">Started:</span> <span className="text-gray-900">{formatDate(order.actual_start_date)}</span></div>
                    )}
                    {order.actual_end_date && (
                      <div><span className="text-gray-900 font-medium">Completed:</span> <span className="text-gray-900">{formatDate(order.actual_end_date)}</span></div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="bg-white rounded-lg p-4 border">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Notes</h4>
                    <p className="text-sm text-gray-900">{order.notes}</p>
                  </div>
                )}
              </div>

              {/* Right Column - Actions */}
              <div className="space-y-4">
                
                {/* Quick Actions */}
                <div className="bg-white rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(order); }}
                      className="flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(order); }}
                      className="flex items-center justify-center px-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <div onClick={(e) => e.stopPropagation()}>
                      <PDFGenerator
                        type="production-order"
                        orderId={order.id}
                        buttonText="PDF"
                        buttonClassName="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors"
                      />
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <PDFGenerator
                        type="production-order-audit"
                        orderId={order.id}
                        buttonText="Audit"
                        buttonClassName="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(order); }}
                      className="flex items-center justify-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Status Actions */}
                {getAvailableActions().length > 0 && (
                  <div className="bg-white rounded-lg p-4 border">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Status Actions</h4>
                    <div className="space-y-2">
                      {getAvailableActions().map((action, index) => (
                        <button
                          key={index}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            action.onClick(); 
                          }}
                          className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${action.color} bg-white border border-gray-200 hover:bg-gray-50`}
                        >
                          <action.icon className="h-4 w-4 mr-2" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Production Details */}
                <div className="bg-white rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <CubeIcon className="h-4 w-4 mr-1" />
                    Production Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-900 font-medium">Required:</span>
                      <span className="text-gray-900 font-medium">{order.quantity_required}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-900 font-medium">Produced:</span>
                      <span className="text-gray-900 font-medium">{order.quantity_produced}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-900 font-medium">Remaining:</span>
                      <span className="text-gray-900 font-medium">{Math.max(0, order.quantity_required - order.quantity_produced)}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-900 font-medium">Progress:</span>
                      <span className="text-gray-900 font-medium">{progressPercentage}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
} 