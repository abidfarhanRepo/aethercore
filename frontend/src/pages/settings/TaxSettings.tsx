import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertCircle, Plus, Trash2, Edit2, CheckCircle } from 'lucide-react'
import { Setting, TaxRate, settingsAPI } from '@/lib/settingsAPI'

interface TaxSettingsProps {
  settings: Setting[]
  taxRates: TaxRate[]
  onSave: (key: string, value: string | number | boolean) => Promise<void>
  onReload: () => Promise<void>
}

export default function TaxSettings({ settings, taxRates, onSave, onReload }: TaxSettingsProps) {
  const [taxEnabled, setTaxEnabled] = useState(true)
  const [defaultRate, setDefaultRate] = useState('8.5')
  const [taxName, setTaxName] = useState('Sales Tax')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddTaxRate, setShowAddTaxRate] = useState(false)
  const [newTaxRate, setNewTaxRate] = useState({ name: '', rate: '', location: '' })
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null)

  useEffect(() => {
    const loadInitialValues = () => {
      const enabledSetting = settings.find((s) => s.key === 'tax_enabled')
      const rateSetting = settings.find((s) => s.key === 'tax_default_rate')
      const nameSetting = settings.find((s) => s.key === 'tax_name')

      if (enabledSetting) setTaxEnabled(enabledSetting.value === 'true')
      if (rateSetting) setDefaultRate(rateSetting.value)
      if (nameSetting) setTaxName(nameSetting.value)
    }

    loadInitialValues()
  }, [settings])

  const handleSaveTaxEnabled = async () => {
    try {
      setLoading(true)
      setError(null)
      await onSave('tax_enabled', taxEnabled)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveDefaultRate = async () => {
    if (!defaultRate || isNaN(Number(defaultRate)) || Number(defaultRate) < 0 || Number(defaultRate) > 100) {
      setError('Please enter a valid tax rate between 0 and 100')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSave('tax_default_rate', Number(defaultRate))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTaxName = async () => {
    if (!taxName.trim()) {
      setError('Tax name cannot be empty')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSave('tax_name', taxName)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTaxRate = async () => {
    if (!newTaxRate.name.trim() || !newTaxRate.rate) {
      setError('Please fill in all required fields')
      return
    }

    const rate = Number(newTaxRate.rate)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setError('Tax rate must be between 0 and 100')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await settingsAPI.createTaxRate({
        name: newTaxRate.name,
        rate,
        location: newTaxRate.location || undefined,
        isActive: true,
        isDefault: false,
      })
      setNewTaxRate({ name: '', rate: '', location: '' })
      setShowAddTaxRate(false)
      await onReload()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add tax rate')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTaxRate = async (id: string) => {
    if (!window.confirm('Delete this tax rate?')) return

    try {
      setLoading(true)
      setError(null)
      await settingsAPI.deleteTaxRate(id)
      await onReload()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete tax rate')
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      await settingsAPI.updateTaxRate(id, { isDefault: true })
      await onReload()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update tax rate')
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

      {/* Basic Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Tax Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tax Enabled Toggle */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Enable Tax Calculation</label>
            <p className="text-xs text-muted-foreground">
              When enabled, taxes will be calculated and displayed on all sales
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTaxEnabled(!taxEnabled)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                  taxEnabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                    taxEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm">{taxEnabled ? 'Enabled' : 'Disabled'}</span>
              {!loading && <Button onClick={handleSaveTaxEnabled} size="sm">Save</Button>}
            </div>
          </div>

          {/* Tax Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Tax Name</label>
            <p className="text-xs text-muted-foreground">
              How tax appears on receipts (e.g., "Sales Tax", "VAT")
            </p>
            <div className="flex gap-2">
              <Input
                value={taxName}
                onChange={(e) => setTaxName(e.target.value)}
                placeholder="Sales Tax"
                disabled={loading}
              />
              <Button onClick={handleSaveTaxName} disabled={loading}>
                Update
              </Button>
            </div>
          </div>

          {/* Default Tax Rate */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Default Tax Rate (%)</label>
            <p className="text-xs text-muted-foreground">Applied to all sales by default (0-100)</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={defaultRate}
                onChange={(e) => setDefaultRate(e.target.value)}
                placeholder="8.5"
                disabled={loading}
              />
              <Button onClick={handleSaveDefaultRate} disabled={loading}>
                Update
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Rates Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tax Rates</CardTitle>
          <Button
            onClick={() => setShowAddTaxRate(!showAddTaxRate)}
            size="sm"
            className="gap-2"
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
            Add Tax Rate
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddTaxRate && (
            <div className="p-4 border border-border rounded-lg space-y-3 bg-muted/50">
              <Input
                placeholder="Tax rate name (e.g., 'Sales Tax - CA')"
                value={newTaxRate.name}
                onChange={(e) => setNewTaxRate({ ...newTaxRate, name: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Rate %"
                min="0"
                max="100"
                value={newTaxRate.rate}
                onChange={(e) => setNewTaxRate({ ...newTaxRate, rate: e.target.value })}
              />
              <Input
                placeholder="Location (optional, e.g., 'CA', 'NY')"
                value={newTaxRate.location}
                onChange={(e) => setNewTaxRate({ ...newTaxRate, location: e.target.value })}
              />
              <div className="flex gap-2">
                <Button onClick={handleAddTaxRate} disabled={loading}>
                  Add
                </Button>
                <Button
                  onClick={() => {
                    setShowAddTaxRate(false)
                    setNewTaxRate({ name: '', rate: '', location: '' })
                  }}
                  variant="outline"
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {taxRates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No tax rates configured</p>
          ) : (
            <div className="space-y-2">
              {taxRates.map((rate) => (
                <div key={rate.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">
                      {rate.name} ({rate.rate}%)
                      {rate.isDefault && <span className="text-xs ml-2 px-2 py-1 bg-green-100 text-green-700 rounded">Default</span>}
                    </div>
                    {rate.location && <p className="text-xs text-muted-foreground">Location: {rate.location}</p>}
                    {rate.description && (
                      <p className="text-xs text-muted-foreground">{rate.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!rate.isDefault && (
                      <Button
                        onClick={() => handleSetDefault(rate.id)}
                        size="sm"
                        variant="outline"
                        disabled={loading}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDeleteTaxRate(rate.id)}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
