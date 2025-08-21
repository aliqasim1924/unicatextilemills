import React, { useState, useEffect } from 'react'
import { DateGroup } from '@/lib/utils/dateGroupingUtils'
import DateGroupHeader from './DateGroupHeader'

interface DateGroupContainerProps {
  group: DateGroup
  onToggle: (groupKey: string, expanded: boolean) => void
  itemType: string
  children: React.ReactNode
}

const DateGroupContainer: React.FC<DateGroupContainerProps> = ({
  group,
  onToggle,
  itemType,
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(group.isExpanded)
  const [isAnimating, setIsAnimating] = useState(false)

  // Sync with external state changes
  useEffect(() => {
    setIsExpanded(group.isExpanded)
  }, [group.isExpanded])

  const handleToggle = () => {
    setIsAnimating(true)
    const newExpandedState = !isExpanded
    setIsExpanded(newExpandedState)
    
    // Notify parent component
    onToggle(group.key, newExpandedState)
    
    // Reset animation flag after transition
    setTimeout(() => setIsAnimating(false), 300)
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <DateGroupHeader
        group={{ ...group, isExpanded }}
        onToggle={handleToggle}
        itemType={itemType}
      />

      {/* Content with smooth animation */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        {isExpanded && (
          <div className={`
            transform transition-transform duration-300
            ${isAnimating ? 'scale-95' : 'scale-100'}
          `}>
            {children}
          </div>
        )}
      </div>

      {/* Empty state when collapsed */}
      {!isExpanded && group.statusCounts.total > 0 && (
        <div className="text-center py-4 text-gray-500 text-sm italic">
          {group.statusCounts.total} {itemType} collapsed • Click to expand
        </div>
      )}
    </div>
  )
}

export default DateGroupContainer
