'use client'

import { useState } from 'react'
import { 
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CalendarIcon,
  UserIcon,
  CubeIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  TruckIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon
} from '@heroicons/react/24/outline'
import OrderActionButtons from '@/components/orders/OrderActionButtons'
import PDFGenerator from '@/components/pdf/generators/PDFGenerator'

interface CustomerOrder {
  id: string
  internal_order_number: string
  customer_po_number: string | null
  customer_id: string
  finished_fabric_id: string
  color: string | null
  quantity_ordered: number
  quantity_allocated: number
  due_date: string
  order_status: string
  priority_override: number
  notes: string | null
  created_at: string
  updated_at: string
  // Relations
  customers?: {
    name: string
    contact_person: string | null
  }
  finished_fabrics?: {
    name: string
    gsm: number
    width_meters: number
    color: string | null
    coating_type: string | null
  }
}

interface ExpandableCustomerOrderRowProps {
  order: CustomerOrder
  onView: (orderId: string) => void
  onEdit: (orderId: string) => void
  onDelete: (order: CustomerOrder) => void
  onOrderUpdated: () => void
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'pending':
      return { 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
        icon: ClockIcon,
        label: 'Pending'
      }
    case 'confirmed':
      return { 
        color: 'bg-blue-100 text-blue-800 border-blue-200', 
        icon: CheckCircleIcon,
        label: 'Confirmed'
      }
    case 'in_production':
      return { 
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200', 
        icon: PlayIcon,
        label: 'In Production'
      }
    case 'production_complete':
      return { 
        color: 'bg-green-100 text-green-800 border-green-200', 
        icon: CheckCircleIcon,
        label: 'Production Complete'
      }
    case 'ready_for_dispatch':
      return { 
        color: 'bg-purple-100 text-purple-800 border-purple-200', 
        icon: TruckIcon,
        label: 'Ready for Dispatch'
      }
    case 'dispatched':
      return { 
        color: 'bg-orange-100 text-orange-800 border-orange-200', 
        icon: TruckIcon,
        label: 'Dispatched'
      }
    case 'delivered':
      return { 
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200', 
        icon: CheckCircleIcon,
        label: 'Delivered'
      }
    case 'cancelled':
      return { 
        color: 'bg-red-100 text-red-800 border-red-200', 
        icon: XCircleIcon,
        label: 'Cancelled'
      }
    // Legacy status support
    case 'fully_allocated':
      return { 
        color: 'bg-green-100 text-green-800 border-green-200', 
        icon: CheckCircleIcon,
        label: 'Fully Allocated'
      }
    case 'partially_allocated':
      return { 
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200', 
        icon: ExclamationTriangleIcon,
        label: 'Partially Allocated'
      }
    case 'in_progress':
      return { 
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200', 
        icon: PlayIcon,
        label: 'In Progress'
      }
    case 'completed':
      return { 
        color: 'bg-green-100 text-green-800 border-green-200', 
        icon: CheckCircleIcon,
        label: 'Completed'
      }
    default:
      return { 
        color: 'bg-gray-100 text-gray-800 border-gray-200', 
        icon: ClockIcon,
        label: 'Unknown'
      }
  }
}

const getPriorityConfig = (priority: number) => {
  if (priority >= 8) return { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' }
  if (priority >= 5) return { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' }
  if (priority >= 3) return { label: 'Medium', color: 'text-blue-600', bgColor: 'bg-blue-100' }
  if (priority >= 1) return { label: 'Low', color: 'text-gray-700', bgColor: 'bg-gray-100' }
  return { label: 'Normal', color: 'text-gray-600', bgColor: 'bg-gray-100' }
}

export default function ExpandableCustomerOrderRow({ 
  order, 
  onView, 
  onEdit, 
  onDelete,
  onOrderUpdated 
}: ExpandableCustomerOrderRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusInfo = getStatusConfig(order.order_status)
  const StatusIcon = statusInfo.icon
  const priorityInfo = getPriorityConfig(order.priority_override)
  const allocationPercentage = Math.round((order.quantity_allocated / order.quantity_ordered) * 100)
  
  const isOverdue = new Date(order.due_date) < new Date() && 
    !['delivered', 'cancelled'].includes(order.order_status)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <>
      <tr 
        className={`cursor-pointer transition-colors duration-150 ${
          isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'
        } ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}
        onClick={toggleExpanded}
      >
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
              {order.customer_po_number && (
                <div className="text-sm text-gray-700">
                  PO: {order.customer_po_number}
                </div>
              )}
            </div>
          </div>
        </td>

        <td className="px-6 py-4">
          <div className="text-sm text-gray-900">
            {order.customers?.name || 'Unknown Customer'}
          </div>
          {order.customers?.contact_person && (
            <div className="text-sm text-gray-700">
              {order.customers.contact_person}
            </div>
          )}
        </td>

        <td className="px-6 py-4">
          <div className="text-sm text-gray-900">
            {order.finished_fabrics?.name || 'Unknown Product'}
          </div>
          <div className="text-sm text-gray-700">
            {order.finished_fabrics?.gsm}GSM • {order.finished_fabrics?.width_meters}m
            {order.color && ` • ${order.color}`}
          </div>
        </td>

        <td className="px-6 py-4">
          <div className="flex items-center">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{order.quantity_allocated}m</span>
                <span className="text-gray-700">{allocationPercentage}%</span>
              </div>
              <div className="text-sm text-gray-700 mb-1">
                of {order.quantity_ordered}m ordered
              </div>
              <div className="mt-1">
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      allocationPercentage === 100 ? 'bg-green-500' : 
                      allocationPercentage > 0 ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                    style={{ width: `${Math.min(allocationPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center space-x-2">
            <StatusIcon className={`h-4 w-4 ${statusInfo.color.includes('yellow') ? 'text-yellow-600' : 
              statusInfo.color.includes('blue') ? 'text-blue-600' :
              statusInfo.color.includes('green') ? 'text-green-600' :
              statusInfo.color.includes('red') ? 'text-red-600' : 
              statusInfo.color.includes('purple') ? 'text-purple-600' :
              statusInfo.color.includes('orange') ? 'text-orange-600' :
              statusInfo.color.includes('indigo') ? 'text-indigo-600' :
              statusInfo.color.includes('emerald') ? 'text-emerald-600' : 'text-gray-600'}`} />
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center space-x-1">
            <CalendarIcon className="h-4 w-4 text-gray-600" />
            <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
              {formatDate(order.due_date)}
            </span>
          </div>
          {isOverdue && (
            <div className="text-xs text-red-500 font-medium">Overdue</div>
          )}
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="space-y-4">
                
                <div className="bg-white rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                    <UserIcon className="h-4 w-4 mr-1" />
                    Customer Information
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-gray-700">Name:</span> <span className="text-gray-900">{order.customers?.name || 'Unknown'}</span></div>
                    {order.customers?.contact_person && (
                      <div><span className="text-gray-700">Contact:</span> <span className="text-gray-900">{order.customers.contact_person}</span></div>
                    )}
                    {order.customer_po_number && (
                      <div><span className="text-gray-700">PO Number:</span> <span className="text-gray-900">{order.customer_po_number}</span></div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                    <CubeIcon className="h-4 w-4 mr-1" />
                    Product Specifications
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-gray-700">Fabric:</span> <span className="text-gray-900">{order.finished_fabrics?.name || 'Unknown'}</span></div>
                    <div><span className="text-gray-700">GSM:</span> <span className="text-gray-900">{order.finished_fabrics?.gsm || 'N/A'}</span></div>
                    <div><span className="text-gray-700">Width:</span> <span className="text-gray-900">{order.finished_fabrics?.width_meters || 'N/A'}m</span></div>
                    {order.color && (
                      <div><span className="text-gray-700">Requested Color:</span> <span className="text-gray-900 font-medium">{order.color}</span></div>
                    )}
                    {order.finished_fabrics?.coating_type && (
                      <div><span className="text-gray-700">Coating:</span> <span className="text-gray-900">{order.finished_fabrics.coating_type}</span></div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    Timeline
                  </h4>
                                      <div className="space-y-1 text-sm">
                      <div><span className="text-gray-700">Order Date:</span> <span className="text-gray-900">{formatDate(order.created_at)}</span></div>
                      <div><span className="text-gray-700">Due Date:</span> <span className="text-gray-900">{formatDate(order.due_date)}</span></div>
                      <div><span className="text-gray-700">Last Updated:</span> <span className="text-gray-900">{formatDate(order.updated_at)}</span></div>
                    </div>
                </div>

                {order.notes && (
                  <div className="bg-white rounded-lg p-4 border">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Order Notes</h4>
                    <p className="text-sm text-gray-900">{order.notes}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                
                <div className="bg-white rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(order.id); }}
                      className="flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(order.id); }}
                      className="flex items-center justify-center px-3 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <div onClick={(e) => e.stopPropagation()}>
                      <PDFGenerator
                        type="customer-order"
                        orderId={order.id}
                        buttonText="PDF"
                        buttonClassName="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors"
                      />
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <PDFGenerator
                        type="customer-order-audit"
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

                <div className="bg-white rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Order Workflow</h4>
                  <div onClick={(e) => e.stopPropagation()}>
                    <OrderActionButtons 
                      order={{
                        id: order.id,
                        internal_order_number: order.internal_order_number,
                        order_status: order.order_status,
                        quantity_ordered: order.quantity_ordered,
                        quantity_allocated: order.quantity_allocated
                      }}
                      onOrderUpdated={onOrderUpdated}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Order Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Ordered:</span>
                      <span className="font-medium text-gray-900">{order.quantity_ordered}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Allocated:</span>
                      <span className="font-medium text-gray-900">{order.quantity_allocated}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Remaining:</span>
                      <span className="font-medium text-gray-900">{Math.max(0, order.quantity_ordered - order.quantity_allocated)}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Progress:</span>
                      <span className="font-medium text-gray-900">{allocationPercentage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Priority:</span>
                      <span className={`font-medium ${priorityInfo.color}`}>{priorityInfo.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Status:</span>
                      <span className="font-medium text-gray-900">{statusInfo.label}</span>
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