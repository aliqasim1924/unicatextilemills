import { useState, useEffect, useCallback } from 'react'
import { DateGroup } from './dateGroupingUtils'

/**
 * Local storage utilities
 */
const STORAGE_KEY = 'archive_expanded_groups'

const saveToLocalStorage = (expandedGroups: Set<string>): void => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }
    
    const data = {
      expanded: Array.from(expandedGroups),
      timestamp: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.warn('Failed to save archive state to localStorage:', error)
  }
}

const loadFromLocalStorage = (): Set<string> => {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return new Set()
    }
    
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const parsed = JSON.parse(data)
      if (parsed.expanded && Array.isArray(parsed.expanded)) {
        return new Set(parsed.expanded)
      }
    }
  } catch (error) {
    console.warn('Failed to load archive state from localStorage:', error)
  }
  return new Set()
}

/**
 * Hook for managing archive state in components
 */
export function useArchiveState() {
  const [expandedGroups, setExpandedGroupsState] = useState<Set<string>>(() => loadFromLocalStorage())

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveToLocalStorage(expandedGroups)
  }, [expandedGroups])

  const setExpanded = useCallback((groupKey: string, expanded: boolean) => {
    setExpandedGroupsState(prev => {
      const newSet = new Set(prev)
      if (expanded) {
        newSet.add(groupKey)
      } else {
        newSet.delete(groupKey)
      }
      return newSet
    })
  }, [])

  const isExpanded = useCallback((groupKey: string) => {
    return expandedGroups.has(groupKey)
  }, [expandedGroups])

  const toggleExpanded = useCallback((groupKey: string) => {
    const currentState = expandedGroups.has(groupKey)
    setExpanded(groupKey, !currentState)
  }, [expandedGroups, setExpanded])

  const expandAllGroups = useCallback((groupKeys: string[]) => {
    setExpandedGroupsState(prev => {
      const newSet = new Set(prev)
      groupKeys.forEach(key => newSet.add(key))
      return newSet
    })
  }, [])

  const collapseAll = useCallback(() => {
    setExpandedGroupsState(new Set())
  }, [])

  const clearPreferences = useCallback(() => {
    setExpandedGroupsState(new Set())
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const getDefaultExpandedState = useCallback((group: DateGroup): boolean => {
    // Check if user has a saved preference
    if (expandedGroups.has(group.key)) {
      return true
    }
    
    // Default behavior: today and yesterday expanded, others collapsed
    return group.type === 'today' || group.type === 'yesterday'
  }, [expandedGroups])

  const initializeGroups = useCallback((groups: DateGroup[]): DateGroup[] => {
    return groups.map(group => ({
      ...group,
      isExpanded: getDefaultExpandedState(group)
    }))
  }, [getDefaultExpandedState])

  return {
    isExpanded,
    setExpanded,
    toggleExpanded,
    expandAllGroups,
    collapseAll,
    clearPreferences,
    initializeGroups
  }
}
