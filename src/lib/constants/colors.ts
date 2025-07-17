// Fabric color constants for consistency across the application
export const FABRIC_COLORS = [
  { value: 'Black', label: 'Black', hex: '#000000' },
  { value: 'Navy Blue', label: 'Navy Blue', hex: '#1f2937' },
  { value: 'Olive Green', label: 'Olive Green', hex: '#6b7280' },
  { value: 'Forest Green', label: 'Forest Green', hex: '#065f46' },
  { value: 'Brown', label: 'Brown', hex: '#92400e' },
  { value: 'Grey', label: 'Grey', hex: '#6b7280' },
  { value: 'White', label: 'White', hex: '#ffffff' },
  { value: 'Red', label: 'Red', hex: '#dc2626' },
  { value: 'Yellow', label: 'Yellow', hex: '#fbbf24' },
  { value: 'Orange', label: 'Orange', hex: '#ea580c' },
  { value: 'Blue', label: 'Blue', hex: '#2563eb' },
  { value: 'Custom', label: 'Custom Color', hex: '#9ca3af' }
] as const

export type FabricColor = typeof FABRIC_COLORS[number]['value']

// Helper function to get color info by value
export const getColorInfo = (colorValue: string) => {
  return FABRIC_COLORS.find(color => color.value === colorValue)
}

// Helper function to get color hex value
export const getColorHex = (colorValue: string): string => {
  const colorInfo = getColorInfo(colorValue)
  return colorInfo?.hex || '#9ca3af'
}

// Helper function to check if color is valid
export const isValidColor = (colorValue: string): boolean => {
  return FABRIC_COLORS.some(color => color.value === colorValue)
}

// Get all color values as an array
export const getAllColorValues = (): string[] => {
  return FABRIC_COLORS.map(color => color.value)
}

// Get all color options for dropdowns
export const getColorOptions = () => {
  return FABRIC_COLORS.map(color => ({
    value: color.value,
    label: color.label
  }))
} 