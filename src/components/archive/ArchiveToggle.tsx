import React from 'react'

interface ArchiveToggleProps {
  onExpandAll: () => void
  onCollapseAll: () => void
  totalGroups: number
  expandedGroups: number
}

const ArchiveToggle: React.FC<ArchiveToggleProps> = ({
  onExpandAll,
  onCollapseAll,
  totalGroups,
  expandedGroups
}) => {
  const collapsedGroups = totalGroups - expandedGroups

  return (
    <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Left side - Summary */}
      <div className="flex items-center space-x-4">
        <div className="text-sm text-gray-600">
          <span className="font-medium">{expandedGroups}</span> of <span className="font-medium">{totalGroups}</span> groups expanded
        </div>
        
        {collapsedGroups > 0 && (
          <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
            {collapsedGroups} collapsed
          </div>
        )}
      </div>

      {/* Right side - Action Buttons */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onExpandAll}
          className="
            px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 
            rounded-lg hover:bg-blue-200 transition-colors duration-200
            flex items-center space-x-2
          "
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span>Expand All</span>
        </button>

        <button
          onClick={onCollapseAll}
          className="
            px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 
            rounded-lg hover:bg-gray-200 transition-colors duration-200
            flex items-center space-x-2
          "
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span>Collapse All</span>
        </button>
      </div>
    </div>
  )
}

export default ArchiveToggle
