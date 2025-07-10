'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'

interface NewBaseFabricFormProps {
  isOpen: boolean
  onClose: () => void
  onFabricCreated: () => void
}

interface BaseFabricFormData {
  name: string
  gsm: number
  width_meters: number
  minimum_stock: number
}

export default function NewBaseFabricForm({ isOpen, onClose, onFabricCreated }: NewBaseFabricFormProps) {
  const [formData, setFormData] = useState<BaseFabricFormData>({
    name: '',
    gsm: 0,
    width_meters: 1.5,
    minimum_stock: 100
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Fabric name is required'
    }

    if (formData.gsm <= 0) {
      newErrors.gsm = 'GSM must be greater than 0'
    }

    if (formData.width_meters <= 0) {
      newErrors.width_meters = 'Width must be greater than 0'
    }

    if (formData.minimum_stock < 0) {
      newErrors.minimum_stock = 'Minimum stock cannot be negative'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      const fabricData = {
        name: formData.name.trim(),
        gsm: formData.gsm,
        width_meters: formData.width_meters,
        color: 'Natural', // Always set to Natural for base fabrics
        stock_quantity: 0, // Start with 0 stock
        minimum_stock: formData.minimum_stock,
      }

      const { error } = await supabase
        .from('base_fabrics')
        .insert([fabricData])

      if (error) {
        console.error('Error creating base fabric:', error)
        alert('Error creating fabric. Please try again.')
        return
      }

      // Reset form
      setFormData({
        name: '',
        gsm: 0,
        width_meters: 1.5,
        minimum_stock: 100
      })
      setErrors({})
      
      onFabricCreated()
    } catch (error) {
      console.error('Error creating base fabric:', error)
      alert('Error creating fabric. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof BaseFabricFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Add New Base Fabric</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Base Fabric:</strong> Raw material used for weaving. All base fabrics are natural colored (white/grey) and can be coated later to create finished fabrics.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fabric Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Fabric Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`mt-1 block w-full border ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
              placeholder="e.g., 280GSM Ripstop Base, Cotton Canvas, Polyester Base"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* GSM */}
          <div>
            <label htmlFor="gsm" className="block text-sm font-medium text-gray-700">
              GSM (Grams per Square Meter) *
            </label>
            <input
              type="number"
              id="gsm"
              value={formData.gsm || ''}
              onChange={(e) => handleInputChange('gsm', parseInt(e.target.value) || 0)}
              className={`mt-1 block w-full border ${
                errors.gsm ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
              placeholder="e.g., 280, 300, 350"
              min="1"
            />
            {errors.gsm && <p className="mt-1 text-sm text-red-600">{errors.gsm}</p>}
            <p className="mt-1 text-sm text-gray-700">
              Typical range: 200-500 GSM for textile applications
            </p>
          </div>

          {/* Width */}
          <div>
            <label htmlFor="width_meters" className="block text-sm font-medium text-gray-700">
              Fabric Width (meters) *
            </label>
            <input
              type="number"
              id="width_meters"
              step="0.1"
              value={formData.width_meters || ''}
              onChange={(e) => handleInputChange('width_meters', parseFloat(e.target.value) || 0)}
              className={`mt-1 block w-full border ${
                errors.width_meters ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
              placeholder="e.g., 1.5, 1.6, 2.0"
              min="0.1"
            />
            {errors.width_meters && <p className="mt-1 text-sm text-red-600">{errors.width_meters}</p>}
            <p className="mt-1 text-sm text-gray-700">
              Standard widths: 1.5m, 1.6m, 2.0m
            </p>
          </div>

          {/* Minimum Stock */}
          <div>
            <label htmlFor="minimum_stock" className="block text-sm font-medium text-gray-700">
              Minimum Stock Level (meters) *
            </label>
            <input
              type="number"
              id="minimum_stock"
              value={formData.minimum_stock || ''}
              onChange={(e) => handleInputChange('minimum_stock', parseInt(e.target.value) || 0)}
              className={`mt-1 block w-full border ${
                errors.minimum_stock ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
              placeholder="e.g., 100, 200, 500"
              min="0"
            />
            {errors.minimum_stock && <p className="mt-1 text-sm text-red-600">{errors.minimum_stock}</p>}
            <p className="mt-1 text-sm text-gray-700">
              Low stock alerts will trigger when inventory falls below this level
            </p>
          </div>

          {/* Color Info (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Color
            </label>
            <div className="mt-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
              <span className="text-gray-900">Natural</span>
              <p className="mt-1 text-sm text-gray-700">
                All base fabrics are natural colored (white/grey). Colors are applied during coating production.
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Base Fabric'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 