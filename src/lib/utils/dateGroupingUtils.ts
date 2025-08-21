export interface StatusCounts {
  pending: number
  inProgress: number
  completed: number
  total: number
}

export interface DateGroup {
  key: string
  label: string
  dateRange: { start: Date; end: Date }
  items: any[]
  statusCounts: StatusCounts
  isExpanded: boolean
  type: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'thisYear'
}

export interface DateGroupingConfig {
  dateField: string
  statusField: string
  statusMapping: {
    pending: string[]
    inProgress: string[]
    completed: string[]
  }
}

/**
 * Groups items by date into collapsible sections
 */
export function groupByDate(
  items: any[], 
  config: DateGroupingConfig
): DateGroup[] {
  if (!items.length) return []

  const now = new Date()
  // Create dates in local timezone to avoid UTC conversion issues
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  const groups: DateGroup[] = []
  
  // Group items by date
  const itemsByDate = new Map<string, any[]>()
  const itemsWithoutDate: any[] = []
  
  items.forEach(item => {
    const dateValue = item[config.dateField]
    
    if (!dateValue) {
      itemsWithoutDate.push(item)
      return
    }
    
    const itemDate = new Date(dateValue)
    // Use local date string to match our local today/yesterday calculations
    const dateKey = itemDate.toLocaleDateString('en-CA') // Returns YYYY-MM-DD format
    
    if (!itemsByDate.has(dateKey)) {
      itemsByDate.set(dateKey, [])
    }
    itemsByDate.get(dateKey)!.push(item)
  })

  // Sort dates in descending order
  const sortedDates = Array.from(itemsByDate.keys()).sort((a, b) => b.localeCompare(a))

  // Create "Active" group for items without dates (pending/in-progress items)
  if (itemsWithoutDate.length > 0) {
    groups.push({
      key: 'active_orders',
      label: 'Active Orders',
      dateRange: { start: today, end: today },
      items: itemsWithoutDate,
      statusCounts: calculateStatusCounts(itemsWithoutDate, config),
      isExpanded: true,
      type: 'today' as const // Use 'today' type for active items
    })
  }

  // Create today group
  const todayKey = today.toLocaleDateString('en-CA') // Use same format as item dates
  const todayItems = itemsByDate.get(todayKey) || []
  if (todayItems.length > 0) {
    groups.push(createDateGroup(
      'today',
      'Today',
      today,
      today,
      todayItems,
      config,
      true // Always expanded
    ))
  }

  // Create yesterday group
  const yesterdayKey = yesterday.toLocaleDateString('en-CA') // Use same format as item dates
  const yesterdayItems = itemsByDate.get(yesterdayKey) || []
  if (yesterdayItems.length > 0) {
    groups.push(createDateGroup(
      'yesterday',
      'Yesterday',
      yesterday,
      yesterday,
      yesterdayItems,
      config,
      true // Always expanded
    ))
  }



  // Group remaining dates
  const remainingDates = sortedDates.filter(date => 
    date !== todayKey && date !== yesterdayKey
  )

  if (remainingDates.length > 0) {
    // This Week (2-7 days ago)
    const thisWeekItems: any[] = []
    const thisWeekDates: string[] = []
    
    for (let i = 2; i <= 7; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toLocaleDateString('en-CA') // Use same format as item dates
      const items = itemsByDate.get(dateKey) || []
      if (items.length > 0) {
        thisWeekItems.push(...items)
        thisWeekDates.push(dateKey)
      }
    }

    if (thisWeekItems.length > 0) {
      const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      groups.push(createDateGroup(
        'thisWeek',
        'This Week',
        weekStart,
        yesterday,
        thisWeekItems,
        config,
        false // Collapsed by default
      ))
    }

    // This Month (8-30 days ago) - Group by weeks
    const thisMonthItems: any[] = []
    const thisMonthDates: string[] = []
    
    for (let i = 8; i <= 30; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toLocaleDateString('en-CA') // Use same format as item dates
      const items = itemsByDate.get(dateKey) || []
      if (items.length > 0) {
        thisMonthItems.push(...items)
        thisMonthDates.push(dateKey)
      }
    }

    if (thisMonthItems.length > 0) {
      const monthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
      groups.push(createDateGroup(
        'thisMonth',
        'This Month',
        monthStart,
        new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000),
        thisMonthItems,
        config,
        false // Collapsed by default
      ))
    }

    // This Year (31+ days ago) - Group by months
    const thisYearItems: any[] = []
    const thisYearDates: string[] = []
    
    for (let i = 31; i <= 365; i++) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateKey = date.toLocaleDateString('en-CA') // Use same format as item dates
      const items = itemsByDate.get(dateKey) || []
      if (items.length > 0) {
        thisYearItems.push(...items)
        thisYearDates.push(dateKey)
      }
    }

    if (thisYearItems.length > 0) {
      const yearStart = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)
      groups.push(createDateGroup(
        'thisYear',
        'This Year',
        yearStart,
        new Date(today.getTime() - 31 * 24 * 60 * 60 * 1000),
        thisYearItems,
        config,
        false // Collapsed by default
      ))
    }
  }

  return groups
}

/**
 * Creates a date group with calculated status counts
 */
function createDateGroup(
  type: DateGroup['type'],
  label: string,
  start: Date,
  end: Date,
  items: any[],
  config: DateGroupingConfig,
  isExpanded: boolean
): DateGroup {
  const statusCounts = calculateStatusCounts(items, config)
  
  return {
    key: `${type}_${start.toISOString().split('T')[0]}`,
    label,
    dateRange: { start, end },
    items,
    statusCounts,
    isExpanded,
    type
  }
}

/**
 * Calculates status counts for a group of items
 */
export function calculateStatusCounts(
  items: any[], 
  config: DateGroupingConfig
): StatusCounts {
  let pending = 0
  let inProgress = 0
  let completed = 0

  items.forEach(item => {
    const status = item[config.statusField]
    if (config.statusMapping.pending.includes(status)) {
      pending++
    } else if (config.statusMapping.inProgress.includes(status)) {
      inProgress++
    } else if (config.statusMapping.completed.includes(status)) {
      completed++
    }
  })

  return {
    pending,
    inProgress,
    completed,
    total: items.length
  }
}

/**
 * Determines if a date group should be auto-expanded
 */
export function shouldAutoExpand(type: DateGroup['type']): boolean {
  return type === 'today' || type === 'yesterday'
}

/**
 * Gets a user-friendly label for a date group
 */
export function getDateGroupLabel(type: DateGroup['type'], start: Date, end: Date): string {
  switch (type) {
    case 'today':
      return 'Today'
    case 'yesterday':
      return 'Yesterday'
    case 'thisWeek':
      return `This Week (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
    case 'thisMonth':
      return `This Month (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
    case 'thisYear':
      return `This Year (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
    default:
      return 'Unknown'
  }
}

/**
 * Formats a date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}
