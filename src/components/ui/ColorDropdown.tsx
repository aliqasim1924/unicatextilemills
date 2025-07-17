import React from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { getColorOptions, getColorHex, isValidColor } from '@/lib/constants/colors'

interface ColorDropdownProps {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  error?: string
  required?: boolean
  disabled?: boolean
  label?: string
  helperText?: string
}

export default function ColorDropdown({
  id,
  value,
  onChange,
  className = '',
  placeholder = 'Select a color',
  error,
  required = false,
  disabled = false,
  label,
  helperText
}: ColorDropdownProps) {
  const colorOptions = getColorOptions()
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value)
  }

  const getBaseClassName = () => {
    const baseClasses = "block w-full px-3 py-2 border rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    const errorClasses = error ? "border-red-300" : "border-gray-300"
    const disabledClasses = disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"
    
    return `${baseClasses} ${errorClasses} ${disabledClasses} ${className}`
  }

  // Show color preview if a valid color is selected
  const selectedColorHex = value && isValidColor(value) ? getColorHex(value) : null

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={getBaseClassName()}
          required={required}
        >
          <option value="">{placeholder}</option>
          {colorOptions.map((color) => (
            <option key={color.value} value={color.value}>
              {color.label}
            </option>
          ))}
        </select>
        
        {/* Color preview indicator */}
        {selectedColorHex && (
          <div className="absolute inset-y-0 right-10 flex items-center">
            <div 
              className="w-4 h-4 rounded-full border border-gray-300 shadow-sm"
              style={{ backgroundColor: selectedColorHex }}
              title={`Preview: ${value}`}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center">
          <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
          {error}
        </p>
      )}

      {helperText && !error && (
        <p className="text-sm text-gray-700">
          {helperText}
        </p>
      )}
    </div>
  )
} 