import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertCircle } from 'lucide-react'
import { Setting } from '@/lib/settingsAPI'

interface StoreSettingsProps {
  settings: Setting[]
  onSave: (key: string, value: string | number | boolean) => Promise<void>
}

export default function StoreSettings({ settings, onSave }: StoreSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const createDefaultFormData = () => ({
    store_name: '',
    store_address: '',
    store_phone: '',
    store_email: '',
    store_website: '',
    business_registration: '',
    store_logo_url: '',
  })

  const [formData, setFormData] = useState(createDefaultFormData)
  const [initialData, setInitialData] = useState(createDefaultFormData)

  useEffect(() => {
    const loadInitialValues = () => {
      const newData = createDefaultFormData()
      settings.forEach((setting) => {
        if (setting.key in newData) {
          newData[setting.key as keyof typeof newData] = setting.value
        }
      })
      setFormData(newData)
      setInitialData(newData)
    }
    loadInitialValues()
  }, [settings])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const requiredFields: Array<keyof typeof formData> = [
    'store_name',
    'store_address',
    'store_phone',
    'store_email',
  ]

  const fieldLabelMap: Record<keyof typeof formData, string> = {
    store_name: 'Store Name',
    store_address: 'Store Address',
    store_phone: 'Store Phone',
    store_email: 'Store Email',
    store_website: 'Store Website',
    business_registration: 'Business Registration Number',
    store_logo_url: 'Store Logo URL',
  }

  const changedFields = (Object.keys(formData) as Array<keyof typeof formData>).filter(
    (key) => formData[key] !== initialData[key]
  )

  const handleSaveAll = async () => {
    setSuccess(null)

    const invalidRequiredField = requiredFields.find((field) => !formData[field].trim())
    if (invalidRequiredField) {
      setError(`${fieldLabelMap[invalidRequiredField]} cannot be empty`)
      return
    }

    if (changedFields.length === 0) {
      setError('No changes to save')
      return
    }

    try {
      setLoading(true)
      setError(null)
      for (const fieldKey of changedFields) {
        await onSave(fieldKey, formData[fieldKey])
      }
      setInitialData({ ...formData })
      setSuccess('Store information saved successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      key: 'store_name' as const,
      label: 'Store Name',
      description: 'Your business or store name',
      type: 'text',
    },
    {
      key: 'store_address' as const,
      label: 'Store Address',
      description: 'Complete street address for receipts',
      type: 'text',
    },
    {
      key: 'store_phone' as const,
      label: 'Store Phone',
      description: 'Customer service phone number',
      type: 'tel',
    },
    {
      key: 'store_email' as const,
      label: 'Store Email',
      description: 'Customer service email address',
      type: 'email',
    },
    {
      key: 'store_website' as const,
      label: 'Store Website',
      description: 'Your business website URL (optional)',
      type: 'url',
    },
    {
      key: 'business_registration' as const,
      label: 'Business Registration Number',
      description: 'Tax ID, EIN, or other registration number',
      type: 'text',
    },
    {
      key: 'store_logo_url' as const,
      label: 'Store Logo URL',
      description: 'URL to your logo image for receipts',
      type: 'url',
    },
  ]

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

      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-green-700 text-sm">{success}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="block text-sm font-medium">{field.label}</label>
              <p className="text-xs text-muted-foreground">{field.description}</p>
              <Input
                type={field.type}
                name={field.key}
                value={formData[field.key]}
                onChange={handleInputChange}
                placeholder={field.label}
                disabled={loading}
              />
            </div>
          ))}

          <div className="pt-1 flex justify-end">
            <Button onClick={handleSaveAll} disabled={loading || changedFields.length === 0}>
              {loading ? 'Saving...' : 'Save Store Information'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg font-mono text-xs space-y-1 max-w-xs">
            {formData.store_logo_url && (
              <img src={formData.store_logo_url} alt="Logo" className="h-12 mb-2" />
            )}
            <div className="text-center font-bold">{formData.store_name || 'Store Name'}</div>
            <div className="text-center text-xs">{formData.store_address || 'Address here'}</div>
            <div className="text-center text-xs">{formData.store_phone || 'Phone here'}</div>
            <div className="text-center text-xs">{formData.store_email || 'Email here'}</div>
            <div className="border-t border-current my-2" />
            <div className="text-xs">Item Name ................. $10.00</div>
            <div className="text-xs">Subtotal ....... $10.00</div>
            <div className="text-xs">Tax ........................... $0.85</div>
            <div className="text-xs font-bold">Total ..................... $10.85</div>
            <div className="border-t border-current my-2" />
            <div className="text-center text-xs">Thank you for your purchase!</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
