import { StatusCounts } from './dateGroupingUtils'

/**
 * Configuration for different status types across the application
 */
export const STATUS_CONFIGS = {
  // Customer Orders
  orders: {
    pending: ['pending'],
    inProgress: ['in_progress', 'allocated'],
    completed: ['completed', 'dispatched']
  },
  
  // Production Orders
  production: {
    pending: ['pending'],
    inProgress: ['weaving', 'coating'],
    completed: ['completed']
  },
  
  // Shipments
  shipments: {
    pending: ['pending'],
    inProgress: ['dispatched'],
    completed: ['delivered']
  }
}

/**
 * Gets the appropriate status configuration for a given area
 */
export function getStatusConfig(area: 'orders' | 'production' | 'shipments') {
  return STATUS_CONFIGS[area]
}

/**
 * Gets status color for display
 */
export function getStatusColor(status: string, area: 'orders' | 'production' | 'shipments'): string {
  const config = getStatusConfig(area)
  
  if (config.pending.includes(status)) {
    return '#f59e0b' // Amber
  } else if (config.inProgress.includes(status)) {
    return '#3b82f6' // Blue
  } else if (config.completed.includes(status)) {
    return '#10b981' // Green
  }
  
  return '#6b7280' // Gray (default)
}

/**
 * Gets status icon for display
 */
export function getStatusIcon(status: string, area: 'orders' | 'production' | 'shipments'): string {
  const config = getStatusConfig(area)
  
  if (config.pending.includes(status)) {
    return '⏳'
  } else if (config.inProgress.includes(status)) {
    return '🔄'
  } else if (config.completed.includes(status)) {
    return '✅'
  }
  
  return '❓'
}

/**
 * Formats status counts for display
 */
export function formatStatusCounts(counts: StatusCounts): string {
  const parts: string[] = []
  
  if (counts.pending > 0) {
    parts.push(`⏳ ${counts.pending}`)
  }
  
  if (counts.inProgress > 0) {
    parts.push(`🔄 ${counts.inProgress}`)
  }
  
  if (counts.completed > 0) {
    parts.push(`✅ ${counts.completed}`)
  }
  
  return parts.join(' | ') || 'No items'
}

/**
 * Gets a summary text for a date group
 */
export function getGroupSummary(counts: StatusCounts, type: string): string {
  if (counts.total === 0) {
    return 'No items'
  }
  
  const statusText = formatStatusCounts(counts)
  return `${counts.total} ${type} • ${statusText}`
}

/**
 * Checks if a group has urgent items (pending or in progress)
 */
export function hasUrgentItems(counts: StatusCounts): boolean {
  return counts.pending > 0 || counts.inProgress > 0
}

/**
 * Gets priority level for a date group
 */
export function getGroupPriority(counts: StatusCounts): 'high' | 'medium' | 'low' {
  if (counts.pending > 0) {
    return 'high'
  } else if (counts.inProgress > 0) {
    return 'medium'
  } else {
    return 'low'
  }
}
