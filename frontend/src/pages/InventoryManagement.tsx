import { useState, useEffect } from 'react'
import { inventoryAPI, productsAPI } from '../lib/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import StockAdjustmentModal from '../components/StockAdjustmentModal'
import StockTransferModal from '../components/StockTransferModal'

interface InventoryItem {
  id: string
  productId: string
  warehouseId: string
  qty: number
  minThreshold: number
  maxThreshold: number
  reorderPoint: number
  lastCountedAt: string | null
  product: {
    id: string
    sku: string
    name: string
    priceCents: number
    costCents: number | null
  }
  warehouse: {
    id: string
    name: string
    location: string | null
  }
}

interface Warehouse {
  id: string
  name: string
  location: string | null
  isActive: boolean
}

export default function InventoryManagement() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all')
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadInventory()
    loadWarehouses()
  }, [])

  const loadInventory = async () => {
    try {
      setLoading(true)
      const response = await inventoryAPI.list()
      setInventory(response.data.locations || [])
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load inventory' })
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadWarehouses = async () => {
    try {
      const response = await inventoryAPI.getWarehouses()
      setWarehouses(response.data)
      if (response.data.length === 0) {
        // Initialize default warehouse
        await inventoryAPI.initWarehouse()
        const response2 = await inventoryAPI.getWarehouses()
        setWarehouses(response2.data)
      }
    } catch (err) {
      console.error('Failed to load warehouses:', err)
    }
  }

  const getStockStatus = (qty: number, minThreshold: number, maxThreshold: number): 'low' | 'medium' | 'high' => {
    if (qty <= minThreshold) return 'low'
    if (qty >= maxThreshold) return 'high'
    return 'medium'
  }

  const getStatusColor = (status: 'low' | 'medium' | 'high'): string => {
    switch (status) {
      case 'low':
        return 'text-red-600 bg-red-50'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50'
      case 'high':
        return 'text-green-600 bg-green-50'
    }
  }

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product.sku.toLowerCase().includes(searchQuery.toLowerCase())

    const status = getStockStatus(item.qty, item.minThreshold, item.maxThreshold)
    const matchesStatus = stockStatusFilter === 'all' || status === stockStatusFilter

    const matchesWarehouse = selectedWarehouse === 'all' || item.warehouseId === selectedWarehouse

    return matchesSearch && matchesStatus && matchesWarehouse
  })

  const handleAdjustStock = (item: InventoryItem) => {
    setSelectedItem(item)
    setShowAdjustModal(true)
  }

  const handleTransferStock = (item: InventoryItem) => {
    setSelectedItem(item)
    setShowTransferModal(true)
  }

  const handleAdjustmentSuccess = () => {
    setShowAdjustModal(false)
    setMessage({ type: 'success', text: 'Stock adjusted successfully' })
    loadInventory()
    setTimeout(() => setMessage(null), 3000)
  }

  const handleTransferSuccess = () => {
    setShowTransferModal(false)
    setMessage({ type: 'success', text: 'Stock transferred successfully' })
    loadInventory()
    setTimeout(() => setMessage(null), 3000)
  }

  const handleRefresh = () => {
    loadInventory()
  }

  if (loading) {
    return <div className="p-6 text-center">Loading inventory...</div>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Inventory Management</h1>
        <p className="text-gray-600">Manage stock levels across warehouses</p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Search</label>
          <Input
            placeholder="Product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Warehouse</label>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} {w.location ? `(${w.location})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Stock Status</label>
          <select value={stockStatusFilter} onChange={(e) => setStockStatusFilter(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="all">All Levels</option>
            <option value="low">Low Stock</option>
            <option value="medium">Medium Stock</option>
            <option value="high">High Stock</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={handleRefresh} variant="secondary" className="w-full">
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
              <th className="border border-gray-300 px-4 py-2 text-left">SKU</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Warehouse</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Current Qty</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Min / Max</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Status</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Last Counted</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan={8} className="border border-gray-300 px-4 py-2 text-center text-gray-500">
                  No inventory items found
                </td>
              </tr>
            ) : (
              filteredInventory.map((item) => {
                const status = getStockStatus(item.qty, item.minThreshold, item.maxThreshold)
                return (
                  <tr key={`${item.productId}-${item.warehouseId}`} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">{item.product.name}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm text-gray-600">{item.product.sku}</td>
                    <td className="border border-gray-300 px-4 py-2 text-sm">{item.warehouse.name}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center font-semibold">{item.qty}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center text-sm">
                      {item.minThreshold} / {item.maxThreshold}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center text-sm text-gray-500">
                      {item.lastCountedAt ? new Date(item.lastCountedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => handleAdjustStock(item)}
                          variant="secondary"
                          className="text-xs px-2 py-1"
                        >
                          Adjust
                        </Button>
                        <Button
                          onClick={() => handleTransferStock(item)}
                          variant="secondary"
                          className="text-xs px-2 py-1"
                        >
                          Transfer
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showAdjustModal && selectedItem && (
        <StockAdjustmentModal
          item={selectedItem}
          warehouses={warehouses}
          onClose={() => setShowAdjustModal(false)}
          onSuccess={handleAdjustmentSuccess}
        />
      )}

      {showTransferModal && selectedItem && (
        <StockTransferModal
          item={selectedItem}
          warehouses={warehouses}
          onClose={() => setShowTransferModal(false)}
          onSuccess={handleTransferSuccess}
        />
      )}
    </div>
  )
}
