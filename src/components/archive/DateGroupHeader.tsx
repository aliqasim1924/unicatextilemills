import React from 'react'
import { StatusCounts, DateGroup } from '@/lib/utils/dateGroupingUtils'
import { formatStatusCounts, hasUrgentItems, getGroupPriority } from '@/lib/utils/statusCountUtils'

interface DateGroupHeaderProps {
  group: DateGroup
  onToggle: () => void
  itemType: string // 'orders', 'production', 'shipments'
}

const DateGroupHeader: React.FC<DateGroupHeaderProps> = ({ 
  group, 
  onToggle, 
  itemType 
}) => {
  const priority = getGroupPriority(group.statusCounts)
  const hasUrgent = hasUrgentItems(group.statusCounts)
  
  const getPriorityColor = () => {
    switch (priority) {
      case 'high':
        return 'border-l-amber-500 bg-amber-50'
      case 'medium':
        return 'border-l-blue-500 bg-blue-50'
      case 'low':
        return 'border-l-green-500 bg-green-50'
      default:
        return 'border-l-gray-500 bg-gray-50'
    }
  }

  const getPriorityIcon = () => {
    if (hasUrgent) {
      return priority === 'high' ? '🔴' : '🟡'
    }
    return '🟢'
  }

  return (
    <div 
      className={`
        border-l-4 p-4 mb-2 rounded-r-lg cursor-pointer transition-all duration-200
        hover:shadow-md hover:scale-[1.01]
        ${getPriorityColor()}
        ${group.isExpanded ? 'shadow-md' : 'shadow-sm'}
      `}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        {/* Left side - Date and Count */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getPriorityIcon()}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                {group.label}
              </h3>
              {/* Show actual date for today/yesterday groups */}
              {(group.type === 'today' || group.type === 'yesterday') && group.key !== 'active_orders' && (
                <p className="text-sm text-gray-600 font-medium">
                  {group.dateRange.start.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              )}
              {/* Special label for active orders */}
              {group.key === 'active_orders' && (
                <p className="text-sm text-gray-600 font-medium">
                  Pending & In-Progress Orders
                </p>
              )}
            </div>
          </div>
          
          <span className="text-sm font-medium text-gray-600 bg-white px-2 py-1 rounded-full shadow-sm">
            {group.statusCounts.total} {itemType}
          </span>
        </div>

        {/* Right side - Status Summary and Toggle */}
        <div className="flex items-center space-x-4">
          {/* Status Summary */}
          <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full shadow-sm">
            {formatStatusCounts(group.statusCounts)}
          </div>

          {/* Toggle Button */}
          <button
            className={`
              p-2 rounded-full transition-all duration-200
              ${group.isExpanded 
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {group.isExpanded ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Date Range (for grouped periods) */}
      {group.type !== 'today' && group.type !== 'yesterday' && (
        <div className="mt-2 text-sm text-gray-600 font-medium">
          {group.dateRange.start.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
          })} - {group.dateRange.end.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
          })}
        </div>
      )}
    </div>
  )
}

export default DateGroupHeader
