'use client'

import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/lib/supabase/client'
import { BaseFabric } from '@/types/database'

interface NewFinishedFabricFormProps {
  isOpen: boolean
  onClose: () => void
  onFabricCreated: () => void
}

interface FinishedFabricFormData {
  name: string
  base_fabric_id: string
  gsm: number
  width_meters: number
  coating_type: string
  minimum_stock: number
}

export default function NewFinishedFabricForm({ isOpen, onClose, onFabricCreated }: NewFinishedFabricFormProps) {
  const [formData, setFormData] = useState<FinishedFabricFormData>({
    name: '',
    base_fabric_id: '',
    gsm: 0,
    width_meters: 1.5,
    coating_type: 'PVC Coating',
    minimum_stock: 100
  })
  const [baseFabrics, setBaseFabrics] = useState<BaseFabric[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadBaseFabrics()
    }
  }, [isOpen])

  const loadBaseFabrics = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('base_fabrics')
        .select('*')
        .order('name')

      if (error) {
        console.error('Error loading base fabrics:', error)
        return
      }

      setBaseFabrics(data || [])
    } catch (error) {
      console.error('Error loading base fabrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Fabric name is required'
    }

    if (!formData.base_fabric_id) {
      newErrors.base_fabric_id = 'Base fabric selection is required'
    }

    if (formData.gsm <= 0) {
      newErrors.gsm = 'GSM must be greater than 0'
    }

    if (formData.width_meters <= 0) {
      newErrors.width_meters = 'Width must be greater than 0'
    }

    if (!formData.coating_type.trim()) {
      newErrors.coating_type = 'Coating type is required'
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
        base_fabric_id: formData.base_fabric_id,
        gsm: formData.gsm,
        width_meters: formData.width_meters,
        coating_type: formData.coating_type.trim(),
        color: null, // Color will be specified during production
        stock_quantity: 0, // Start with 0 stock
        minimum_stock: formData.minimum_stock,
      }

      const { error } = await supabase
        .from('finished_fabrics')
        .insert([fabricData])

      if (error) {
        console.error('Error creating finished fabric:', error)
        alert('Error creating fabric. Please try again.')
        return
      }

      // Reset form
      setFormData({
        name: '',
        base_fabric_id: '',
        gsm: 0,
        width_meters: 1.5,
        coating_type: 'PVC Coating',
        minimum_stock: 100
      })
      setErrors({})
      
      onFabricCreated()
    } catch (error) {
      console.error('Error creating finished fabric:', error)
      alert('Error creating fabric. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof FinishedFabricFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleBaseFabricChange = (baseFabricId: string) => {
    const selectedBase = baseFabrics.find(f => f.id === baseFabricId)
    if (selectedBase) {
      setFormData(prev => ({
        ...prev,
        base_fabric_id: baseFabricId,
        gsm: selectedBase.gsm + 50, // Add typical coating weight
        width_meters: selectedBase.width_meters
      }))
    } else {
      setFormData(prev => ({ ...prev, base_fabric_id: baseFabricId }))
    }
    if (errors.base_fabric_id) {
      setErrors(prev => ({ ...prev, base_fabric_id: '' }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Add New Finished Fabric</h3>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-800"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-green-50 rounded-md">
          <p className="text-sm text-green-800">
            <strong>Finished Fabric:</strong> Coated base fabric ready for customer orders. Colors are specified during the coating production process, not during fabric creation.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fabric Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Finished Fabric Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`mt-1 block w-full border ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
              placeholder="e.g., Heavy Duty Tarp, Waterproof Canvas, Marine Grade Fabric"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Base Fabric Selection */}
          <div>
            <label htmlFor="base_fabric_id" className="block text-sm font-medium text-gray-700">
              Base Fabric *
            </label>
            <select
              id="base_fabric_id"
              value={formData.base_fabric_id}
              onChange={(e) => handleBaseFabricChange(e.target.value)}
              className={`mt-1 block w-full border ${
                errors.base_fabric_id ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            >
              <option value="">Select a base fabric</option>
              {baseFabrics.map((fabric) => (
                <option key={fabric.id} value={fabric.id}>
                  {fabric.name} - {fabric.gsm}GSM, {fabric.width_meters}m
                </option>
              ))}
            </select>
            {errors.base_fabric_id && <p className="mt-1 text-sm text-red-600">{errors.base_fabric_id}</p>}
            {baseFabrics.length === 0 && (
              <p className="mt-1 text-sm text-yellow-600">
                No base fabrics available. Please create base fabrics first.
              </p>
            )}
          </div>

          {/* GSM */}
          <div>
            <label htmlFor="gsm" className="block text-sm font-medium text-gray-700">
              Finished GSM (with coating) *
            </label>
            <input
              type="number"
              id="gsm"
              value={formData.gsm || ''}
              onChange={(e) => handleInputChange('gsm', parseInt(e.target.value) || 0)}
              className={`mt-1 block w-full border ${
                errors.gsm ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
              placeholder="e.g., 330, 350, 400"
              min="1"
            />
            {errors.gsm && <p className="mt-1 text-sm text-red-600">{errors.gsm}</p>}
            <p className="mt-1 text-sm text-gray-700">
              Typically 50-100 GSM higher than base fabric due to coating
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
              Usually matches the base fabric width
            </p>
          </div>

          {/* Coating Type */}
          <div>
            <label htmlFor="coating_type" className="block text-sm font-medium text-gray-700">
              Coating Type *
            </label>
            <select
              id="coating_type"
              value={formData.coating_type}
              onChange={(e) => handleInputChange('coating_type', e.target.value)}
              className={`mt-1 block w-full border ${
                errors.coating_type ? 'border-red-300' : 'border-gray-300'
              } rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
            >
              <option value="PVC Coating">PVC Coating</option>
              <option value="PU Coating">PU Coating</option>
              <option value="Acrylic Coating">Acrylic Coating</option>
              <option value="TPU Coating">TPU Coating</option>
              <option value="PTFE Coating">PTFE Coating</option>
              <option value="Custom Coating">Custom Coating</option>
            </select>
            {errors.coating_type && <p className="mt-1 text-sm text-red-600">{errors.coating_type}</p>}
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

          {/* Color Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Color Specification
            </label>
            <div className="mt-1 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              <span className="text-blue-900 font-medium">Dynamic (applied during production)</span>
              <p className="mt-1 text-sm text-gray-700">
                Colors will be specified when creating coating production orders. This allows for flexible production based on customer requirements.
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
              disabled={submitting || baseFabrics.length === 0}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Finished Fabric'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 