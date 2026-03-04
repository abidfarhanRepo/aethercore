import React, { useState } from 'react'
import { productsAPI } from '@/lib/api'
import { X } from 'lucide-react'

interface CreateProductModalProps {
  onClose: () => void
  onProductCreated: () => void
}

export default function CreateProductModal({ onClose, onProductCreated }: CreateProductModalProps) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    priceCents: '',
    costCents: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.sku.trim()) newErrors.sku = 'SKU is required'
    if (!formData.name.trim()) newErrors.name = 'Product name is required'
    
    const price = parseFloat(formData.priceCents)
    if (!formData.priceCents || isNaN(price) || price < 0) {
      newErrors.priceCents = 'Valid price is required'
    }
    
    if (formData.costCents) {
      const cost = parseFloat(formData.costCents)
      if (isNaN(cost) || cost < 0) {
        newErrors.costCents = 'Cost must be a valid positive number'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      setLoading(true)
      const submitData = {
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category.trim() || undefined,
        priceCents: Math.round(parseFloat(formData.priceCents) * 100),
        costCents: formData.costCents ? Math.round(parseFloat(formData.costCents) * 100) : undefined,
      }
      await productsAPI.create(submitData)
      onProductCreated()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to create product'
      setErrors({ submit: message })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add New Product</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
              {errors.submit}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">SKU *</label>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => handleInputChange('sku', e.target.value)}
              placeholder="e.g., PROD-001"
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.sku ? 'border-red-500' : 'border-border'
              }`}
              disabled={loading}
            />
            {errors.sku && <p className="text-red-600 text-xs mt-1">{errors.sku}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Product Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Wireless Headphones"
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-border'
              }`}
              disabled={loading}
            />
            {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Optional product description"
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              placeholder="e.g., Electronics"
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Price ($) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.priceCents}
                onChange={(e) => handleInputChange('priceCents', e.target.value)}
                placeholder="0.00"
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.priceCents ? 'border-red-500' : 'border-border'
                }`}
                disabled={loading}
              />
              {errors.priceCents && <p className="text-red-600 text-xs mt-1">{errors.priceCents}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.costCents}
                onChange={(e) => handleInputChange('costCents', e.target.value)}
                placeholder="0.00"
                className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.costCents ? 'border-red-500' : 'border-border'
                }`}
                disabled={loading}
              />
              {errors.costCents && <p className="text-red-600 text-xs mt-1">{errors.costCents}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-border rounded-md hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
