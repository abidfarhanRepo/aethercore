import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertCircle } from 'lucide-react'
import { Setting } from '@/lib/settingsAPI'

interface InventorySettingsProps {
  settings: Setting[]
  onSave: (key: string, value: string | number | boolean) => Promise<void>
}

export default function InventorySettings({ settings, onSave }: InventorySettingsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lowStockThreshold, setLowStockThreshold] = useState('10')
  const [autoReorderEnabled, setAutoReorderEnabled] = useState(false)
  const [defaultSupplierDiscount, setDefaultSupplierDiscount] = useState('0')

  useEffect(() => {
    const loadInitialValues = () => {
      const thresholdSetting = settings.find((s) => s.key === 'low_stock_threshold')
      const autoReorderSetting = settings.find((s) => s.key === 'auto_reorder_enabled')
      const discountSetting = settings.find((s) => s.key === 'default_supplier_discount')

      if (thresholdSetting) setLowStockThreshold(thresholdSetting.value)
      if (autoReorderSetting) setAutoReorderEnabled(autoReorderSetting.value === 'true')
      if (discountSetting) setDefaultSupplierDiscount(discountSetting.value)
    }

    loadInitialValues()
  }, [settings])

  const handleSaveLowStockThreshold = async () => {
    const threshold = Number(lowStockThreshold)
    if (isNaN(threshold) || threshold < 0) {
      setError('Low stock threshold must be a positive number')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSave('low_stock_threshold', threshold)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAutoReorder = async () => {
    try {
      setLoading(true)
      setError(null)
      await onSave('auto_reorder_enabled', autoReorderEnabled)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDefaultDiscount = async () => {
    const discount = Number(defaultSupplierDiscount)
    if (isNaN(discount) || discount < 0 || discount > 100) {
      setError('Default supplier discount must be between 0 and 100')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSave('default_supplier_discount', discount)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Level Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Level Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Low Stock Threshold</label>
            <p className="text-xs text-muted-foreground">
              Items below this quantity will be marked as low stock
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder="10"
                disabled={loading}
              />
              <Button onClick={handleSaveLowStockThreshold} disabled={loading}>
                Save
              </Button>
            </div>
            <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              💡 When stock reaches {lowStockThreshold} units or below, you'll receive alerts in the
              inventory dashboard
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Reorder Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Automatic Reordering</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Automatically create purchase orders when stock falls below threshold
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoReorderEnabled(!autoReorderEnabled)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                autoReorderEnabled ? 'bg-green-600' : 'bg-gray-300'
              }`}
              disabled={loading}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                  autoReorderEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm">{autoReorderEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <Button onClick={handleSaveAutoReorder} disabled={loading}>
            Save
          </Button>
          {autoReorderEnabled && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              ⚠️ Auto-reorder is <strong>enabled</strong>. Purchase orders will be created automatically
              for items below threshold. You'll need to approve them before supplier shipment.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supplier Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Default Supplier Discount (%)</label>
            <p className="text-xs text-muted-foreground">
              Applied by default to new purchase orders (0-100)
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={defaultSupplierDiscount}
                onChange={(e) => setDefaultSupplierDiscount(e.target.value)}
                placeholder="0"
                disabled={loading}
              />
              <Button onClick={handleSaveDefaultDiscount} disabled={loading}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Card */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Low Stock Threshold</p>
              <p className="font-bold text-lg">{lowStockThreshold}</p>
              <p className="text-xs text-muted-foreground">units</p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Auto-Reorder</p>
              <p className="font-bold text-lg">{autoReorderEnabled ? 'ON' : 'OFF'}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Default Discount</p>
              <p className="font-bold text-lg">{defaultSupplierDiscount}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices Card */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-900">Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-green-800 space-y-2">
          <p>
            📊 <strong>Low Stock Threshold:</strong> Set based on your sales velocity and supplier
            lead time
          </p>
          <p>
            🤖 <strong>Auto-Reorder:</strong> Enable only if you have established supplier
            relationships
          </p>
          <p>
            💰 <strong>Supplier Discounts:</strong> Negotiate better rates with suppliers and
            update here
          </p>
          <p>
            📈 <strong>Stock Counts:</strong> Perform physical counts weekly or monthly to catch
            discrepancies
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
