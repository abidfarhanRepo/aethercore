import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { AlertCircle, CheckCircle, Target, X, Eye, EyeOff } from 'lucide-react'

interface PaymentProcessor {
  id: string
  name: string
  displayName: string
  isActive: boolean
  webhookUrl?: string
  createdAt: string
}

/**
 * Payment Settings Page
 * Admin-only page for configuring payment processors (Stripe, Square, PayPal)
 */
export function PaymentSettings() {
  const [processors, setProcessors] = useState<PaymentProcessor[]>([])
  const [loading, setLoading] = useState(true)
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [activeProcessor, setActiveProcessor] = useState<string | null>(null)
  const [config, setConfig] = useState({
    apiKey: '',
    secretKey: '',
    webhookSecret: '',
    showApiKey: false,
    showSecretKey: false,
    showWebhookSecret: false,
  })

  const PROCESSOR_DETAILS = {
    STRIPE: {
      displayName: 'Stripe',
      description: 'Credit/debit card payments with 3D Secure support',
      fields: ['apiKey', 'webhookSecret'],
      docs: 'https://stripe.com/docs',
    },
    SQUARE: {
      displayName: 'Square',
      description: 'Card payments, digital wallets, and hardware readers',
      fields: ['apiKey'],
      docs: 'https://developer.squareup.com/docs',
    },
    PAYPAL: {
      displayName: 'PayPal',
      description: 'Express Checkout and standard PayPal payments',
      fields: ['apiKey', 'secretKey', 'webhookSecret'],
      docs: 'https://developer.paypal.com/docs',
    },
  }

  useEffect(() => {
    loadProcessors()
  }, [])

  const loadProcessors = async () => {
    try {
      const response = await fetch('/api/payments/settings', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load payment processors')
      }

      const data = await response.json()
      setProcessors(data.processors || [])
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfigureProcessor = (processorName: string) => {
    setActiveProcessor(processorName)
    setConfig({
      apiKey: '',
      secretKey: '',
      webhookSecret: '',
      showApiKey: false,
      showSecretKey: false,
      showWebhookSecret: false,
    })
    setSavedMessage(null)
    setError(null)
  }

  const handleSaveConfiguration = async () => {
    if (!activeProcessor) return

    if (!config.apiKey.trim()) {
      setError('API Key is required')
      return
    }

    const processorConfig = PROCESSOR_DETAILS[activeProcessor as keyof typeof PROCESSOR_DETAILS]
    if (!processorConfig) {
      setError('Invalid processor')
      return
    }

    setIsConfiguring(true)
    setError(null)
    setSavedMessage(null)

    try {
      const payload: Record<string, any> = {
        name: activeProcessor,
        displayName: processorConfig.displayName,
        apiKey: config.apiKey,
        isActive: true,
      }

      if (processorConfig.fields.includes('secretKey') && config.secretKey) {
        payload.secretKey = config.secretKey
      }

      if (processorConfig.fields.includes('webhookSecret') && config.webhookSecret) {
        payload.webhookSecret = config.webhookSecret
      }

      const response = await fetch('/api/payments/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.details?.[0] || data.error || 'Failed to save configuration')
      }

      setSavedMessage(`${processorConfig.displayName} configured successfully!`)
      setActiveProcessor(null)
      loadProcessors()

      // Clear message after 3 seconds
      setTimeout(() => setSavedMessage(null), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save configuration'
      setError(message)
    } finally {
      setIsConfiguring(false)
    }
  }

  const handleCancel = () => {
    setActiveProcessor(null)
    setError(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading payment settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payment Settings</h1>
        <p className="text-gray-600">Configure payment processors for your POS system</p>
      </div>

      {/* Success Message */}
      {savedMessage && (
        <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded">
          <CheckCircle className="h-5 w-5" />
          <span>{savedMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Processor Configuration Form */}
      {activeProcessor && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Configure {PROCESSOR_DETAILS[activeProcessor as keyof typeof PROCESSOR_DETAILS]?.displayName}
            </CardTitle>
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700"
              disabled={isConfiguring}
            >
              <X className="h-5 w-5" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* API Key */}
            <div>
              <label className="text-sm font-medium">API Key</label>
              <div className="flex gap-2">
                <Input
                  type={config.showApiKey ? 'text' : 'password'}
                  placeholder="Enter API Key"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  disabled={isConfiguring}
                />
                <button
                  onClick={() =>
                    setConfig({ ...config, showApiKey: !config.showApiKey })
                  }
                  disabled={isConfiguring}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  {config.showApiKey ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your API keys are encrypted and never displayed again
              </p>
            </div>

            {/* Secret Key (if needed) */}
            {PROCESSOR_DETAILS[activeProcessor as keyof typeof PROCESSOR_DETAILS]?.fields.includes(
              'secretKey'
            ) && (
              <div>
                <label className="text-sm font-medium">Secret Key</label>
                <div className="flex gap-2">
                  <Input
                    type={config.showSecretKey ? 'text' : 'password'}
                    placeholder="Enter Secret Key"
                    value={config.secretKey}
                    onChange={(e) =>
                      setConfig({ ...config, secretKey: e.target.value })
                    }
                    disabled={isConfiguring}
                  />
                  <button
                    onClick={() =>
                      setConfig({
                        ...config,
                        showSecretKey: !config.showSecretKey,
                      })
                    }
                    disabled={isConfiguring}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    {config.showSecretKey ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Webhook Secret (if needed) */}
            {PROCESSOR_DETAILS[activeProcessor as keyof typeof PROCESSOR_DETAILS]?.fields.includes(
              'webhookSecret'
            ) && (
              <div>
                <label className="text-sm font-medium">Webhook Secret</label>
                <div className="flex gap-2">
                  <Input
                    type={config.showWebhookSecret ? 'text' : 'password'}
                    placeholder="Enter Webhook Secret"
                    value={config.webhookSecret}
                    onChange={(e) =>
                      setConfig({ ...config, webhookSecret: e.target.value })
                    }
                    disabled={isConfiguring}
                  />
                  <button
                    onClick={() =>
                      setConfig({
                        ...config,
                        showWebhookSecret: !config.showWebhookSecret,
                      })
                    }
                    disabled={isConfiguring}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    {config.showWebhookSecret ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isConfiguring}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveConfiguration}
                disabled={isConfiguring || !config.apiKey}
                className="flex-1"
              >
                {isConfiguring ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processor List */}
      {!activeProcessor && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(PROCESSOR_DETAILS).map(([key, details]) => {
            const isConfigured = processors.some(
              (p) => p.name === key && p.isActive
            )

            return (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {details.displayName}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {details.description}
                      </p>
                    </div>
                    {isConfigured && (
                      <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium">
                        <Target className="h-3 w-3" />
                        Active
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isConfigured && (
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                      <div className="font-medium mb-1">Configured on:</div>
                      {new Date(
                        processors.find((p) => p.name === key)?.createdAt || ''
                      ).toLocaleDateString()}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      onClick={() => handleConfigureProcessor(key)}
                      className="w-full"
                      variant={isConfigured ? 'outline' : 'default'}
                    >
                      {isConfigured ? 'Update Configuration' : 'Configure'}
                    </Button>
                    <a
                      href={details.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-xs text-blue-600 hover:underline"
                    >
                      View Documentation →
                    </a>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Security Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-blue-900 mb-2">🔒 Security Notice</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>All API keys are encrypted at rest using AES-256 encryption</li>
            <li>Payment data is never stored in logs or backups</li>
            <li>HTTPS is required for all payment processing</li>
            <li>Webhook signatures are verified to prevent spoofing</li>
            <li>Regular security audits are recommended</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
