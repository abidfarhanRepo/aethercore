import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertCircle, CheckCircle, X, Save, RotateCcw, Settings } from 'lucide-react'
import { settingsAPI, Setting, TaxRate } from '@/lib/settingsAPI'
import TaxSettings from './settings/TaxSettings'
import StoreSettings from './settings/StoreSettings'
import PaymentSettings from './settings/PaymentSettings'
import SystemSettings from './settings/SystemSettings'
import InventorySettings from './settings/InventorySettings'
import UserSettings from './settings/UserSettings'

type Tab = 'tax' | 'store' | 'payment' | 'system' | 'inventory' | 'user'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('store')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [settings, setSettings] = useState<Record<string, Setting[]>>({})
  const [taxRates, setTaxRates] = useState<TaxRate[]>([])

  const tabs = [
    { id: 'store' as Tab, label: 'Store Info', icon: '🏪' },
    { id: 'tax' as Tab, label: 'Tax Settings', icon: '💰' },
    { id: 'payment' as Tab, label: 'Payment', icon: '💳' },
    { id: 'system' as Tab, label: 'System', icon: '⚙️' },
    { id: 'inventory' as Tab, label: 'Inventory', icon: '📦' },
    { id: 'user' as Tab, label: 'User Settings', icon: '👥' },
  ]

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      const [settingsRes, taxRatesRes] = await Promise.all([
        settingsAPI.getAll(),
        settingsAPI.getTaxRates(),
      ])

      setSettings(settingsRes.data)
      setTaxRates(taxRatesRes.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSetting = async (key: string, value: string | number | boolean) => {
    try {
      setError(null)
      await settingsAPI.update(key, value)
      setSuccess('Setting saved successfully')
      setTimeout(() => setSuccess(null), 3000)
      
      // Reload settings
      await loadSettings()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save setting')
    }
  }

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reload all settings? Any unsaved changes will be lost.')) {
      await loadSettings()
      setSuccess('Settings reloaded')
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  if (loading && Object.keys(settings).length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground">Configure your POS system settings and preferences</p>
      </div>

      {/* Alerts */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 text-red-600" />
            </button>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-800 font-medium">Success</p>
              <p className="text-green-700 text-sm">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)}>
              <X className="h-4 w-4 text-green-600" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Tab Navigation */}
      <Card>
        <CardContent className="pt-0 px-0">
          <div className="flex flex-wrap border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      <div>
        {activeTab === 'store' && (
          <StoreSettings settings={settings.store || []} onSave={handleSaveSetting} />
        )}
        {activeTab === 'tax' && (
          <TaxSettings
            settings={settings.tax || []}
            taxRates={taxRates}
            onSave={handleSaveSetting}
            onReload={loadSettings}
          />
        )}
        {activeTab === 'payment' && (
          <PaymentSettings settings={settings.payment || []} onSave={handleSaveSetting} />
        )}
        {activeTab === 'system' && (
          <SystemSettings settings={settings.system || []} onSave={handleSaveSetting} />
        )}
        {activeTab === 'inventory' && (
          <InventorySettings settings={settings.inventory || []} onSave={handleSaveSetting} />
        )}
        {activeTab === 'user' && (
          <UserSettings settings={settings.user || []} onSave={handleSaveSetting} />
        )}
      </div>

      {/* Footer Actions */}
      <Card>
        <CardContent className="pt-6 flex justify-end gap-3">
          <Button onClick={handleReset} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button className="gap-2">
            <Save className="h-4 w-4" />
            All Saved
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
