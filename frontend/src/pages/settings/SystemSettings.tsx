import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertCircle } from 'lucide-react'
import { Setting } from '@/lib/settingsAPI'

interface SystemSettingsProps {
  settings: Setting[]
  onSave: (key: string, value: string | number | boolean) => Promise<void>
}

export default function SystemSettings({ settings, onSave }: SystemSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    currency: 'USD',
    timezone: 'UTC',
    date_format: 'MM/DD/YYYY',
    time_format: '12h',
    language: 'en',
    backup_frequency: 'daily',
  })

  const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'MXN', 'BRL']
  const TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
  ]
  const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY']
  const TIME_FORMATS = ['12h', '24h']
  const LANGUAGES = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh']
  const BACKUP_FREQUENCIES = ['hourly', 'daily', 'weekly', 'monthly']

  useEffect(() => {
    const loadInitialValues = () => {
      const newData = { ...formData }
      settings.forEach((setting) => {
        if (setting.key in newData) {
          newData[setting.key as keyof typeof newData] = setting.value
        }
      })
      setFormData(newData)
    }
    loadInitialValues()
  }, [settings])

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async (fieldKey: keyof typeof formData) => {
    try {
      setLoading(true)
      setError(null)
      await onSave(fieldKey, formData[fieldKey])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    {
      key: 'currency' as const,
      label: 'Currency',
      description: 'Default currency for prices and transactions',
      options: CURRENCIES,
    },
    {
      key: 'timezone' as const,
      label: 'Timezone',
      description: 'Business timezone for date/time operations',
      options: TIMEZONES,
    },
    {
      key: 'date_format' as const,
      label: 'Date Format',
      description: 'How to display dates in the system',
      options: DATE_FORMATS,
    },
    {
      key: 'time_format' as const,
      label: 'Time Format',
      description: '12-hour or 24-hour time display',
      options: TIME_FORMATS,
    },
    {
      key: 'language' as const,
      label: 'Language',
      description: 'System interface language',
      options: LANGUAGES,
    },
    {
      key: 'backup_frequency' as const,
      label: 'Backup Frequency',
      description: 'How often to back up database',
      options: BACKUP_FREQUENCIES,
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

      {/* Settings Grid */}
      <Card>
        <CardHeader>
          <CardTitle>System Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="block text-sm font-medium">{field.label}</label>
              <p className="text-xs text-muted-foreground">{field.description}</p>
              <div className="flex gap-2">
                <select
                  name={field.key}
                  value={formData[field.key]}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => handleSave(field.key)}
                  disabled={loading}
                >
                  Save
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Current Settings Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Current Settings Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Currency</p>
              <p className="font-semibold text-lg">{formData.currency}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Timezone</p>
              <p className="font-semibold">{formData.timezone}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Date Format</p>
              <p className="font-semibold">{formData.date_format}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Time Format</p>
              <p className="font-semibold">{formData.time_format}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Language</p>
              <p className="font-semibold">{formData.language.toUpperCase()}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Backups</p>
              <p className="font-semibold capitalize">{formData.backup_frequency}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Localization</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>
            🌍 <strong>Multi-language Support:</strong> Interface language affects UI text, not
            data.
          </p>
          <p>
            🔔 <strong>Timezone Important:</strong> Used for calculating business hours, scheduled
            reports, and audit logs.
          </p>
          <p>
            💾 <strong>Automatic Backups:</strong> Database backups are created at your configured
            frequency.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
