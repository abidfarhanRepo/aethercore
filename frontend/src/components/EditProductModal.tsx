import React, { useState } from 'react'
import { productsAPI } from '@/lib/api'
import { X } from 'lucide-react'

interface Product {
  id: string
  sku: string
  name: string
  description?: string
  category?: string
  priceCents: number
  costCents?: number
  isActive: boolean
}

interface EditProductModalProps {
  product: Product
  onClose: () => void
  onProductUpdated: () => void
}

export default function EditProductModal({ product, onClose, onProductUpdated }: EditProductModalProps) {
  const [formData, setFormData] = useState({
    name: product.name,
    description: product.description || '',
    category: product.category || '',
    priceCents: (product.priceCents / 100).toString(),
    costCents: product.costCents ? (product.costCents / 100).toString() : '',
    isActive: product.isActive,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

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
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category.trim() || undefined,
        priceCents: Math.round(parseFloat(formData.priceCents) * 100),
        costCents: formData.costCents ? Math.round(parseFloat(formData.costCents) * 100) : undefined,
        isActive: formData.isActive,
      }
      await productsAPI.update(product.id, submitData)
      onProductUpdated()
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update product'
      setErrors({ submit: message })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const margin = formData.costCents 
    ? Math.round(((parseFloat(formData.priceCents) - parseFloat(formData.costCents)) / parseFloat(formData.priceCents)) * 100)
    : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Product</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-gray-50 p-3 rounded-md mb-4 text-sm">
          <p className="text-muted-foreground">SKU: <span className="font-mono font-semibold text-foreground">{product.sku}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
              {errors.submit}
            </div>
          )}

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

          {margin > 0 && (
            <div className="bg-green-50 p-3 rounded-md text-sm">
              <p className="text-green-800">
                <span className="font-semibold">Profit Margin:</span> {margin}%
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => handleInputChange('isActive', e.target.checked)}
              disabled={loading}
              className="h-4 w-4"
            />
            <label htmlFor="isActive" className="text-sm font-medium cursor-pointer">
              Active Product
            </label>
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
              {loading ? 'Updating...' : 'Update Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
