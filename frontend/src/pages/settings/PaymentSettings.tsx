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

type ProcessorState = {
  id: string
  name: 'STRIPE' | 'SQUARE' | 'PAYPAL'
  displayName: string
  isActive: boolean
  enabled: boolean
  dummyMode: boolean
}

type HardwareDevice = {
  id: string
  name: string
  model: string
  connectionType: 'usb' | 'network' | 'serial' | 'bluetooth' | 'hid'
  connectionValue: string
  isActive: boolean
}

type PrintDesignSettings = {
  paperWidth: number
  showLogo: boolean
  headerText: string
  footerText: string
  fontStyle: string
  fontSize: string
  separatorStyle: 'dashed' | 'double' | 'none'
  showStoreName: boolean
  showReceiptId: boolean
  showTimestamp: boolean
  showItems: boolean
  showItemDetails: boolean
  showSubtotal: boolean
  showDiscounts: boolean
  showTax: boolean
  showTotal: boolean
  showPaymentSection: boolean
  showPaymentBreakdown: boolean
  showChange: boolean
  showCashier: boolean
  showThankYou: boolean
}

const PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE_PAYMENT', 'CHECK', 'GIFT_CARD', 'STORE_CREDIT']

export default function PaymentSettings({ settings, onSave }: PaymentSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [savingProcessor, setSavingProcessor] = useState<string | null>(null)
  const [savingPrintSettings, setSavingPrintSettings] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('CASH')
  const [acceptedMethods, setAcceptedMethods] = useState<string[]>(['CASH', 'CARD'])
  const [refundDays, setRefundDays] = useState('30')
  const [processors, setProcessors] = useState<ProcessorState[]>([])
  const [printerCount, setPrinterCount] = useState(0)
  const [scannerCount, setScannerCount] = useState(0)
  const [printers, setPrinters] = useState<HardwareDevice[]>([])
  const [scanners, setScanners] = useState<HardwareDevice[]>([])
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null)
  const [testPrintPayload, setTestPrintPayload] = useState<string>('')
  const [newPrinter, setNewPrinter] = useState({
    name: '',
    model: 'Generic Thermal',
    connectionType: 'network',
    connectionValue: '',
  })
  const [printDesign, setPrintDesign] = useState<PrintDesignSettings>({
    paperWidth: 48,
    showLogo: false,
    headerText: 'THANK YOU FOR YOUR PURCHASE',
    footerText: 'Come Again Soon!',
    fontStyle: 'normal',
    fontSize: 'medium',
    separatorStyle: 'dashed',
    showStoreName: true,
    showReceiptId: true,
    showTimestamp: true,
    showItems: true,
    showItemDetails: true,
    showSubtotal: true,
    showDiscounts: true,
    showTax: true,
    showTotal: true,
    showPaymentSection: true,
    showPaymentBreakdown: true,
    showChange: true,
    showCashier: false,
    showThankYou: true,
  })

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('auth_token') || ''}`,
  })

  const previewDivider =
    printDesign.separatorStyle === 'none'
      ? ''
      : printDesign.separatorStyle === 'double'
        ? 'border-t-2 border-solid'
        : 'border-t border-dashed'

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

  useEffect(() => {
    void loadProcessorSettings()
    void loadHardwareSummary()
    void loadPrintDesignSettings()
  }, [])

  const loadProcessorSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/payments/settings`, {
        headers: authHeaders(),
      })
      if (!response.ok) {
        throw new Error('Failed to load processor settings')
      }

      const data = await response.json()
      setProcessors(data.processors || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load processor settings')
    }
  }

  const loadHardwareSummary = async () => {
    try {
      const [printersRes, scannersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/hardware/printers`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/api/v1/hardware/scanners`, { headers: authHeaders() }),
      ])

      if (printersRes.ok) {
        const printersData = await printersRes.json()
        setPrinters(printersData.printers || [])
        setPrinterCount((printersData.printers || []).length)
      }
      if (scannersRes.ok) {
        const scannersData = await scannersRes.json()
        setScanners(scannersData.scanners || [])
        setScannerCount((scannersData.scanners || []).length)
      }
    } catch {
      // Non-blocking summary section.
    }
  }

  const loadPrintDesignSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/hardware/print-settings`, {
        headers: authHeaders(),
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      if (data.settings) {
        setPrintDesign((prev) => ({ ...prev, ...data.settings }))
      }
    } catch {
      // Keep local defaults when endpoint is unavailable.
    }
  }

  const updateProcessorState = (
    name: ProcessorState['name'],
    updates: Partial<ProcessorState>
  ) => {
    setProcessors((prev) =>
      prev.map((processor) =>
        processor.name === name ? { ...processor, ...updates } : processor
      )
    )
  }

  const saveProcessor = async (processor: ProcessorState) => {
    try {
      setSavingProcessor(processor.name)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/v1/payments/settings`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: processor.name,
          displayName: processor.displayName,
          isActive: processor.isActive,
          enabled: processor.enabled,
          dummyMode: processor.dummyMode,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save processor settings')
      }

      await loadProcessorSettings()
    } catch (err: any) {
      setError(err.message || 'Failed to save processor settings')
    } finally {
      setSavingProcessor(null)
    }
  }

  const savePrintDesignSettings = async () => {
    try {
      setSavingPrintSettings(true)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/v1/hardware/print-settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(printDesign),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save print design settings')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save print design settings')
    } finally {
      setSavingPrintSettings(false)
    }
  }

  const addPrinter = async () => {
    if (!newPrinter.name || !newPrinter.connectionValue) {
      setError('Printer name and connection value are required')
      return
    }

    try {
      setError(null)
      const response = await fetch(`${API_BASE_URL}/api/v1/hardware/printers`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...newPrinter,
          isActive: true,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to add printer')
      }

      setNewPrinter({
        name: '',
        model: 'Generic Thermal',
        connectionType: 'network',
        connectionValue: '',
      })
      await loadHardwareSummary()
    } catch (err: any) {
      setError(err.message || 'Failed to add printer')
    }
  }

  const runTestPrint = async (printerId: string) => {
    try {
      setTestingPrinterId(printerId)
      setError(null)
      setTestPrintPayload('')

      const response = await fetch(`${API_BASE_URL}/api/v1/hardware/printers/${printerId}/test-print`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to generate test print')
      }

      const data = await response.json()
      setTestPrintPayload(data.payload || '')
    } catch (err: any) {
      setError(err.message || 'Failed to generate test print')
    } finally {
      setTestingPrinterId(null)
    }
  }

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

      {/* Payment Processors */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Processors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enable/disable each provider and keep dummy mode on while live gateway access is not needed.
          </p>
          {processors.map((processor) => (
            <div key={processor.name} className="rounded border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{processor.displayName}</p>
                  <p className="text-xs text-muted-foreground">Provider key: {processor.name}</p>
                </div>
                <Button
                  onClick={() => saveProcessor(processor)}
                  disabled={savingProcessor === processor.name}
                  variant="outline"
                >
                  {savingProcessor === processor.name ? 'Saving...' : 'Save'}
                </Button>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={processor.enabled}
                  onChange={(e) =>
                    updateProcessorState(processor.name, { enabled: e.target.checked })
                  }
                />
                <span className="text-sm">Enable {processor.displayName}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={processor.dummyMode}
                  onChange={(e) =>
                    updateProcessorState(processor.name, { dummyMode: e.target.checked })
                  }
                />
                <span className="text-sm">Dummy mode (safe placeholder processing)</span>
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Hardware Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Hardware Devices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>Registered printers: {printerCount}</p>
          <p>Registered scanners: {scannerCount}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border rounded p-3">
            <Input
              placeholder="Printer name"
              value={newPrinter.name}
              onChange={(e) => setNewPrinter((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              placeholder="Model"
              value={newPrinter.model}
              onChange={(e) => setNewPrinter((prev) => ({ ...prev, model: e.target.value }))}
            />
            <select
              value={newPrinter.connectionType}
              onChange={(e) =>
                setNewPrinter((prev) => ({
                  ...prev,
                  connectionType: e.target.value,
                }))
              }
              className="border rounded px-3 py-2 bg-background"
            >
              <option value="network">Network</option>
              <option value="usb">USB</option>
              <option value="serial">Serial</option>
              <option value="bluetooth">Bluetooth</option>
              <option value="hid">HID</option>
            </select>
            <Input
              placeholder="Connection value (e.g. 192.168.1.200:9100)"
              value={newPrinter.connectionValue}
              onChange={(e) => setNewPrinter((prev) => ({ ...prev, connectionValue: e.target.value }))}
            />
            <Button className="md:col-span-2" variant="outline" onClick={addPrinter}>
              Add Printer
            </Button>
          </div>

          <div className="space-y-2">
            {printers.map((printer) => (
              <div key={printer.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-medium">{printer.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {printer.model} • {printer.connectionType} • {printer.connectionValue}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => runTestPrint(printer.id)}
                  disabled={testingPrinterId === printer.id}
                >
                  {testingPrinterId === printer.id ? 'Testing...' : 'Test Print'}
                </Button>
              </div>
            ))}
            {printers.length === 0 && (
              <p className="text-muted-foreground">No printers registered yet.</p>
            )}
          </div>

          {testPrintPayload && (
            <div className="border rounded p-3 bg-muted">
              <div className="font-medium mb-2">Test Print Output</div>
              <pre className="text-xs whitespace-pre-wrap font-mono">{testPrintPayload}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Printer Design */}
      <Card>
        <CardHeader>
          <CardTitle>Printer Design Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Fine tune exactly what appears on printer paper and preview the result before saving.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Paper Width (chars)</label>
              <Input
                type="number"
                min="24"
                max="80"
                value={printDesign.paperWidth}
                onChange={(e) =>
                  setPrintDesign((prev) => ({
                    ...prev,
                    paperWidth: Number(e.target.value || 48),
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Font Style</label>
              <Input
                value={printDesign.fontStyle}
                onChange={(e) =>
                  setPrintDesign((prev) => ({ ...prev, fontStyle: e.target.value }))
                }
                placeholder="normal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Font Size</label>
              <Input
                value={printDesign.fontSize}
                onChange={(e) =>
                  setPrintDesign((prev) => ({ ...prev, fontSize: e.target.value }))
                }
                placeholder="medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Separator Style</label>
              <select
                value={printDesign.separatorStyle}
                onChange={(e) =>
                  setPrintDesign((prev) => ({
                    ...prev,
                    separatorStyle: e.target.value as PrintDesignSettings['separatorStyle'],
                  }))
                }
                className="w-full border rounded px-3 py-2 bg-background"
              >
                <option value="dashed">Dashed</option>
                <option value="double">Double Line</option>
                <option value="none">None</option>
              </select>
            </div>

            <div className="flex items-center pt-7">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printDesign.showLogo}
                  onChange={(e) =>
                    setPrintDesign((prev) => ({ ...prev, showLogo: e.target.checked }))
                  }
                />
                <span className="text-sm">Show logo on print</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {[
              ['showStoreName', 'Store Name'],
              ['showReceiptId', 'Receipt ID'],
              ['showTimestamp', 'Timestamp'],
              ['showItems', 'Items Section'],
              ['showItemDetails', 'Item Qty x Price'],
              ['showSubtotal', 'Subtotal'],
              ['showDiscounts', 'Discounts'],
              ['showTax', 'Tax'],
              ['showTotal', 'Total'],
              ['showPaymentSection', 'Payment Section'],
              ['showPaymentBreakdown', 'Payment Breakdown'],
              ['showChange', 'Change'],
              ['showCashier', 'Cashier'],
              ['showThankYou', 'Thank You Message'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(printDesign as any)[key]}
                  onChange={(e) =>
                    setPrintDesign((prev) => ({ ...prev, [key]: e.target.checked } as PrintDesignSettings))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Header Text</label>
            <Input
              value={printDesign.headerText}
              onChange={(e) =>
                setPrintDesign((prev) => ({ ...prev, headerText: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Footer Text</label>
            <Input
              value={printDesign.footerText}
              onChange={(e) =>
                setPrintDesign((prev) => ({ ...prev, footerText: e.target.value }))
              }
            />
          </div>

          <div className="bg-background border-2 border-dashed border-border p-4 font-mono text-sm max-h-96 overflow-y-auto">
            <div className="text-center font-bold mb-4">
              {printDesign.showLogo && <div>[LOGO]</div>}
              {printDesign.showStoreName && <div>AETHER POS SYSTEM</div>}
              {printDesign.showReceiptId && <div>Receipt #PREVIEW-001</div>}
              {printDesign.showTimestamp && <div className="text-xs mt-1">3/5/2026, 1:05:00 PM</div>}
              {printDesign.headerText && <div className="text-xs mt-2">{printDesign.headerText}</div>}
            </div>

            {printDesign.showItems && (
              <>
                <div className={`${previewDivider} my-2 pt-2`}>Items</div>
                <div className="flex justify-between text-xs">
                  <span>Demo Item</span>
                  <span>$9.99</span>
                </div>
                {printDesign.showItemDetails && (
                  <div className="text-xs text-muted-foreground ml-2">1 × $9.99</div>
                )}
              </>
            )}

            {printDesign.showSubtotal && (
              <div className={`${previewDivider} my-2 pt-2 flex justify-between text-xs`}>
                <span>Subtotal:</span>
                <span>$9.99</span>
              </div>
            )}

            {printDesign.showDiscounts && (
              <div className="bg-muted p-2 rounded my-2">
                <div className="text-xs font-bold mb-1">Discounts</div>
                <div className="flex justify-between text-xs">
                  <span>PROMO</span>
                  <span>-$0.00</span>
                </div>
              </div>
            )}

            {printDesign.showTax && (
              <div className="flex justify-between text-xs my-2">
                <span>Tax:</span>
                <span>$0.00</span>
              </div>
            )}

            {printDesign.showTotal && (
              <div className={`${previewDivider} my-2 pt-2 flex justify-between font-bold`}>
                <span>TOTAL:</span>
                <span>$9.99</span>
              </div>
            )}

            {printDesign.showPaymentSection && (
              <div className={`${previewDivider} my-2 pt-2`}>
                <div className="text-xs font-bold mb-1">Payment</div>
                {printDesign.showPaymentBreakdown && (
                  <div className="flex justify-between text-xs">
                    <span>CASH:</span>
                    <span>$10.00</span>
                  </div>
                )}
                {printDesign.showChange && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Change:</span>
                    <span>$0.01</span>
                  </div>
                )}
              </div>
            )}

            <div className={`text-center text-xs mt-4 pt-2 ${previewDivider}`}>
              {printDesign.showCashier && <div>Cashier: Demo User</div>}
              {printDesign.showThankYou && <div className="mt-2">Thank you for your purchase!</div>}
              {printDesign.footerText && <div className="mt-1">{printDesign.footerText}</div>}
            </div>
          </div>

          <Button onClick={savePrintDesignSettings} disabled={savingPrintSettings}>
            {savingPrintSettings ? 'Saving...' : 'Save Printer Design'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
