import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AlertCircle } from 'lucide-react'
import { Setting } from '@/lib/settingsAPI'

interface PaymentSettingsProps {
  settings: Setting[]
  onSave: (key: string, value: string | number | boolean) => Promise<void>
}

const PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE_PAYMENT', 'CHECK', 'GIFT_CARD', 'STORE_CREDIT']

export default function PaymentSettings({ settings, onSave }: PaymentSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('CASH')
  const [acceptedMethods, setAcceptedMethods] = useState<string[]>(['CASH', 'CARD', 'MOBILE_PAYMENT'])
  const [refundDays, setRefundDays] = useState('30')

  useEffect(() => {
    const loadInitialValues = () => {
      const defaultSetting = settings.find((s) => s.key === 'default_payment_method')
      const acceptedSetting = settings.find((s) => s.key === 'accepted_payment_methods')
      const refundSetting = settings.find((s) => s.key === 'refund_days_allowed')

      if (defaultSetting) setDefaultPaymentMethod(defaultSetting.value)
      if (acceptedSetting) {
        setAcceptedMethods(acceptedSetting.value.split(',').map((m) => m.trim()))
      }
      if (refundSetting) setRefundDays(refundSetting.value)
    }

    loadInitialValues()
  }, [settings])

  const togglePaymentMethod = (method: string) => {
    setAcceptedMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    )
  }

  const handleSaveDefault = async () => {
    try {
      setLoading(true)
      setError(null)
      await onSave('default_payment_method', defaultPaymentMethod)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAcceptedMethods = async () => {
    if (acceptedMethods.length === 0) {
      setError('At least one payment method must be selected')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSave('accepted_payment_methods', acceptedMethods.join(','))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRefundDays = async () => {
    const days = Number(refundDays)
    if (isNaN(days) || days < 0) {
      setError('Refund period must be a positive number')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onSave('refund_days_allowed', days)
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

      {/* Default Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle>Default Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The payment method pre-selected for new transactions
          </p>
          <div className="space-y-3">
            {PAYMENT_METHODS.map((method) => (
              <label key={method} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="defaultMethod"
                  value={method}
                  checked={defaultPaymentMethod === method}
                  onChange={(e) => setDefaultPaymentMethod(e.target.value)}
                  disabled={loading}
                  className="h-4 w-4"
                />
                <span className="text-sm">{method.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
          <Button onClick={handleSaveDefault} disabled={loading}>
            Save Default Method
          </Button>
        </CardContent>
      </Card>

      {/* Accepted Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Accepted Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Which payment methods to enable in the system
          </p>
          <div className="space-y-3">
            {PAYMENT_METHODS.map((method) => (
              <label key={method} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedMethods.includes(method)}
                  onChange={() => togglePaymentMethod(method)}
                  disabled={loading}
                  className="h-4 w-4"
                />
                <span className="text-sm">{method.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
          <Button onClick={handleSaveAcceptedMethods} disabled={loading}>
            Save Payment Methods
          </Button>
        </CardContent>
      </Card>

      {/* Refund Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Refund Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Refund Period (Days)</label>
            <p className="text-xs text-muted-foreground">
              Number of days after purchase that refunds are allowed
            </p>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                value={refundDays}
                onChange={(e) => setRefundDays(e.target.value)}
                placeholder="30"
                disabled={loading}
              />
              <Button onClick={handleSaveRefundDays} disabled={loading}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Processor Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Payment Processing</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>
            🔒 <strong>Secure Processing:</strong> All payment gateway credentials are encrypted and
            never displayed in full on the interface.
          </p>
          <p>
            💳 <strong>Supported Providers:</strong> Stripe, Square, PayPal
          </p>
          <p>
            🛡️ <strong>Security:</strong> PCI-DSS compliant payment processing with tokenization
          </p>
          <p className="text-xs pt-2">
            Note: Payment processor API keys are configured elsewhere in the Payment Settings page.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
