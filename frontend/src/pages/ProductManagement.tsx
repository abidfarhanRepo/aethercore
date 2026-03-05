import React, { useState, useEffect } from 'react'
import { productsAPI } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Search, Plus, Edit2, Trash2, TrendingUp } from 'lucide-react'
import CreateProductModal from '@/components/CreateProductModal'
import EditProductModal from '@/components/EditProductModal'

interface Product {
  id: string
  sku: string
  barcode?: string
  name: string
  category?: string
  priceCents: number
  costCents?: number
  imageUrl?: string
  isActive: boolean
  createdAt: string
}

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await productsAPI.list()
      setProducts(Array.isArray(response.data) ? response.data : response.data?.products || [])
    } catch (err) {
      setError('Failed to load products')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleProductCreated = () => {
    setShowCreateModal(false)
    fetchProducts()
  }

  const handleProductUpdated = () => {
    setEditingProduct(null)
    fetchProducts()
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      await productsAPI.delete(productId)
      fetchProducts()
    } catch (error) {
      console.error('Failed to delete product:', error)
      alert('Failed to delete product')
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                       p.sku.toLowerCase().includes(search.toLowerCase()) ||
                       (p.barcode?.includes(search) || false)
    const matchCategory = selectedCategory === 'all' || p.category === selectedCategory
    return matchSearch && matchCategory
  })

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]

  return (
    <div className="space-y-[26px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-[26px]">
          <div className="flex gap-[18px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px]">
        <Card>
          <CardContent className="pt-[26px]">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold">{products.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-[26px]">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Active Products</p>
              <p className="text-2xl font-bold">{products.filter(p => p.isActive).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-[26px]">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Average Price</p>
              <p className="text-2xl font-bold">
                ${(products.reduce((sum, p) => sum + p.priceCents, 0) / products.length / 100).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product List ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading products...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No products found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Product Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Price</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold">Cost</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Margin</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const margin = product.costCents
                      ? Math.round(((product.priceCents - product.costCents) / product.priceCents) * 100)
                      : 0
                    return (
                      <tr key={product.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-[14px] text-sm font-mono">{product.sku}</td>
                        <td className="px-4 py-[14px] text-sm">{product.name}</td>
                        <td className="px-4 py-[14px] text-sm text-muted-foreground">{product.category || '-'}</td>
                        <td className="px-4 py-[14px] text-sm text-right font-semibold">
                          ${(product.priceCents / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-[14px] text-sm text-right text-muted-foreground">
                          ${product.costCents ? (product.costCents / 100).toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-[14px] text-sm text-center">
                          {margin > 0 ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <TrendingUp className="h-3 w-3" />
                              {margin}%
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-[14px] text-sm text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            product.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {product.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-[14px] text-sm text-center">
                          <div className="flex gap-2 justify-center">
                            <button 
                              onClick={() => setEditingProduct(product)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(product.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Product Modal */}
      {showCreateModal && (
        <CreateProductModal
          onClose={() => setShowCreateModal(false)}
          onProductCreated={handleProductCreated}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onProductUpdated={handleProductUpdated}
        />
      )}
    </div>
  )
}

export default ProductManagement
