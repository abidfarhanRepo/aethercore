import { useEffect, useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertCircle } from 'lucide-react'
import { Setting } from '@/lib/settingsAPI'
import { productsAPI } from '@/lib/api'

export interface SettingMeta {
  category: string
  type: 'string' | 'number' | 'boolean' | 'json'
  label: string
  description: string
}

interface Product {
  id: string
  sku: string
  name: string
  priceCents: number
}

interface IndustryFeaturesSettingsProps {
  settings: Setting[]
  onSave: (key: string, value: string | number | boolean, meta?: SettingMeta) => Promise<void>
}

type IndustryProfile = 'GENERAL' | 'SUPERMARKET' | 'RESTAURANT' | 'PHARMACY'

type FeatureToggles = {
  feature_restaurant_enabled: boolean
  feature_kitchen_enabled: boolean
  feature_pharmacy_enabled: boolean
  feature_receiving_enabled: boolean
  feature_expiry_lots_enabled: boolean
}

const INDUSTRY_DEFAULTS: Record<IndustryProfile, FeatureToggles> = {
  GENERAL: {
    feature_restaurant_enabled: false,
    feature_kitchen_enabled: false,
    feature_pharmacy_enabled: false,
    feature_receiving_enabled: false,
    feature_expiry_lots_enabled: false,
  },
  SUPERMARKET: {
    feature_restaurant_enabled: false,
    feature_kitchen_enabled: false,
    feature_pharmacy_enabled: false,
    feature_receiving_enabled: true,
    feature_expiry_lots_enabled: true,
  },
  RESTAURANT: {
    feature_restaurant_enabled: true,
    feature_kitchen_enabled: true,
    feature_pharmacy_enabled: false,
    feature_receiving_enabled: false,
    feature_expiry_lots_enabled: false,
  },
  PHARMACY: {
    feature_restaurant_enabled: false,
    feature_kitchen_enabled: false,
    feature_pharmacy_enabled: true,
    feature_receiving_enabled: false,
    feature_expiry_lots_enabled: true,
  },
}

const META: Record<string, SettingMeta> = {
  industry_profile: {
    category: 'system',
    type: 'string',
    label: 'Industry Profile',
    description: 'Primary business mode used for feature defaults and navigation.',
  },
  feature_restaurant_enabled: {
    category: 'system',
    type: 'boolean',
    label: 'Restaurant Module Enabled',
    description: 'Controls access to restaurant table workflow.',
  },
  feature_kitchen_enabled: {
    category: 'system',
    type: 'boolean',
    label: 'Kitchen Module Enabled',
    description: 'Controls access to kitchen ticket board workflow.',
  },
  feature_pharmacy_enabled: {
    category: 'system',
    type: 'boolean',
    label: 'Pharmacy Module Enabled',
    description: 'Controls access to pharmacy dispensing workflow.',
  },
  feature_receiving_enabled: {
    category: 'system',
    type: 'boolean',
    label: 'Receiving Module Enabled',
    description: 'Controls access to receiving center workflow.',
  },
  feature_expiry_lots_enabled: {
    category: 'system',
    type: 'boolean',
    label: 'Expiry and Lots Module Enabled',
    description: 'Controls access to lot and expiry management pages.',
  },
  checkout_shortcuts_enabled: {
    category: 'system',
    type: 'boolean',
    label: 'Checkout Shortcuts Enabled',
    description: 'Enable or disable keyboard shortcuts in the checkout screen.',
  },
  checkout_quicksell_enabled: {
    category: 'system',
    type: 'boolean',
    label: 'Checkout Quick Sell Enabled',
    description: 'Enable quick-sell controls for selected products in checkout.',
  },
  checkout_quicksell_product_ids: {
    category: 'system',
    type: 'string',
    label: 'Checkout Quick Sell Product IDs',
    description: 'Comma-separated product IDs shown in quick-sell controls.',
  },
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback
  }
  return value === 'true'
}

export default function IndustryFeaturesSettings({ settings, onSave }: IndustryFeaturesSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')

  const [industryProfile, setIndustryProfile] = useState<IndustryProfile>('GENERAL')
  const [features, setFeatures] = useState<FeatureToggles>(INDUSTRY_DEFAULTS.GENERAL)
  const [checkoutShortcutsEnabled, setCheckoutShortcutsEnabled] = useState(true)
  const [checkoutQuickSellEnabled, setCheckoutQuickSellEnabled] = useState(false)
  const [selectedQuickSellProductIds, setSelectedQuickSellProductIds] = useState<string[]>([])

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await productsAPI.list()
        const loaded = Array.isArray(response.data) ? response.data : response.data?.products || []
        setProducts(loaded)
      } catch (err) {
        console.error('Failed to load products for quick-sell settings', err)
      }
    }

    void loadProducts()
  }, [])

  useEffect(() => {
    const getSetting = (key: string): string | undefined => {
      const found = settings.find((setting) => setting.key === key)
      return found?.value
    }

    const profile = getSetting('industry_profile') as IndustryProfile | undefined
    setIndustryProfile(profile || 'GENERAL')

    setFeatures({
      feature_restaurant_enabled: parseBoolean(getSetting('feature_restaurant_enabled'), false),
      feature_kitchen_enabled: parseBoolean(getSetting('feature_kitchen_enabled'), false),
      feature_pharmacy_enabled: parseBoolean(getSetting('feature_pharmacy_enabled'), false),
      feature_receiving_enabled: parseBoolean(getSetting('feature_receiving_enabled'), false),
      feature_expiry_lots_enabled: parseBoolean(getSetting('feature_expiry_lots_enabled'), false),
    })

    setCheckoutShortcutsEnabled(parseBoolean(getSetting('checkout_shortcuts_enabled'), true))
    setCheckoutQuickSellEnabled(parseBoolean(getSetting('checkout_quicksell_enabled'), false))

    const quickSellIds = getSetting('checkout_quicksell_product_ids')
    setSelectedQuickSellProductIds(
      quickSellIds
        ? quickSellIds
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : []
    )
  }, [settings])

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()
    if (!search) {
      return products
    }

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        product.id.toLowerCase().includes(search)
      )
    })
  }, [products, productSearch])

  const handleProfileChange = (nextProfile: IndustryProfile) => {
    setIndustryProfile(nextProfile)

    // Keep this opinionated to reduce setup friction for common business modes.
    setFeatures(INDUSTRY_DEFAULTS[nextProfile])
  }

  const toggleFeature = (key: keyof FeatureToggles) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleQuickSellProduct = (productId: string) => {
    setSelectedQuickSellProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId)
      }
      return [...prev, productId]
    })
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      setError(null)

      const quickSellIdsValue = selectedQuickSellProductIds.join(',')

      await onSave('industry_profile', industryProfile, META.industry_profile)
      await onSave('feature_restaurant_enabled', features.feature_restaurant_enabled, META.feature_restaurant_enabled)
      await onSave('feature_kitchen_enabled', features.feature_kitchen_enabled, META.feature_kitchen_enabled)
      await onSave('feature_pharmacy_enabled', features.feature_pharmacy_enabled, META.feature_pharmacy_enabled)
      await onSave('feature_receiving_enabled', features.feature_receiving_enabled, META.feature_receiving_enabled)
      await onSave('feature_expiry_lots_enabled', features.feature_expiry_lots_enabled, META.feature_expiry_lots_enabled)
      await onSave('checkout_shortcuts_enabled', checkoutShortcutsEnabled, META.checkout_shortcuts_enabled)
      await onSave('checkout_quicksell_enabled', checkoutQuickSellEnabled, META.checkout_quicksell_enabled)
      await onSave('checkout_quicksell_product_ids', quickSellIdsValue, META.checkout_quicksell_product_ids)
    } catch (err: any) {
      setError(err.message || 'Failed to save industry and feature settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Industry Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Select your primary business type to apply default feature toggles.</p>
          <select
            value={industryProfile}
            onChange={(event) => handleProfileChange(event.target.value as IndustryProfile)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
            disabled={loading}
          >
            <option value="GENERAL">GENERAL</option>
            <option value="SUPERMARKET">SUPERMARKET</option>
            <option value="RESTAURANT">RESTAURANT</option>
            <option value="PHARMACY">PHARMACY</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Access Toggles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'feature_restaurant_enabled' as const, label: 'Restaurant pages' },
            { key: 'feature_kitchen_enabled' as const, label: 'Kitchen board' },
            { key: 'feature_pharmacy_enabled' as const, label: 'Pharmacy console' },
            { key: 'feature_receiving_enabled' as const, label: 'Receiving center' },
            { key: 'feature_expiry_lots_enabled' as const, label: 'Expiry and lots' },
          ].map((feature) => (
            <label key={feature.key} className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm">{feature.label}</span>
              <input
                type="checkbox"
                checked={features[feature.key]}
                onChange={() => toggleFeature(feature.key)}
                disabled={loading}
                className="h-4 w-4"
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checkout Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm">Enable checkout keyboard shortcuts</span>
            <input
              type="checkbox"
              checked={checkoutShortcutsEnabled}
              onChange={() => setCheckoutShortcutsEnabled((prev) => !prev)}
              disabled={loading}
              className="h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm">Enable quick-sell products section</span>
            <input
              type="checkbox"
              checked={checkoutQuickSellEnabled}
              onChange={() => setCheckoutQuickSellEnabled((prev) => !prev)}
              disabled={loading}
              className="h-4 w-4"
            />
          </label>

          {checkoutQuickSellEnabled && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Quick-sell product selection</label>
                <Input
                  placeholder="Search by name, SKU, or product ID"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  className="h-10"
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredProducts.map((product) => (
                  <label key={product.id} className="flex items-center justify-between rounded-md border border-border p-2">
                    <div>
                      <div className="text-sm font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku} | ${(product.priceCents / 100).toFixed(2)}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedQuickSellProductIds.includes(product.id)}
                      onChange={() => toggleQuickSellProduct(product.id)}
                      className="h-4 w-4"
                    />
                  </label>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Selected: {selectedQuickSellProductIds.length} products
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={loading} className="min-w-36">
          {loading ? 'Saving...' : 'Save Industry Settings'}
        </Button>
      </div>
    </div>
  )
}
