import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Printer, X } from 'lucide-react'

interface LineItem {
  id: string
  name: string
  qty: number
  unitPrice: number
  discountCents?: number
}

interface Payment {
  method: string
  amountCents: number
  changeCents?: number
}

interface ReceiptPreviewProps {
  isOpen: boolean
  onClose: () => void
  onPrint?: () => void
  items: LineItem[]
  discounts: Array<{ reason: string; amountCents: number }>
  subtotalCents: number
  discountTotalCents: number
  taxCents: number
  totalCents: number
  payments: Payment[]
  saleId?: string
  timestamp?: Date
  cashierName?: string
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

export function ReceiptPreview({
  isOpen,
  onClose,
  onPrint,
  items,
  discounts,
  subtotalCents,
  discountTotalCents,
  taxCents,
  totalCents,
  payments,
  saleId,
  timestamp,
  cashierName,
}: ReceiptPreviewProps) {
  const [printSettings, setPrintSettings] = useState<PrintDesignSettings>({
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

  useEffect(() => {
    const loadSettings = async () => {
      if (!isOpen) return
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('auth_token') || ''
        const response = await fetch(`${API_BASE_URL}/api/v1/hardware/print-settings`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        })

        if (!response.ok) return
        const data = await response.json()
        if (data.settings) {
          setPrintSettings((prev) => ({ ...prev, ...data.settings }))
        }
      } catch {
        // Keep local defaults if settings endpoint is unavailable.
      }
    }

    void loadSettings()
  }, [API_BASE_URL, isOpen])

  const dividerClass = useMemo(() => {
    if (printSettings.separatorStyle === 'none') return ''
    if (printSettings.separatorStyle === 'double') return 'border-t-2 border-solid'
    return 'border-t border-dashed'
  }, [printSettings.separatorStyle])

  if (!isOpen) return null

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=400,height=600')
    if (printWindow) {
      printWindow.document.write(generateReceiptHTML())
      printWindow.document.close()
      printWindow.print()
    }
    onPrint?.()
  }

  const generateReceiptHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; }
          .receipt { max-width: 280px; margin: 0 auto; }
          .header { text-align: center; font-weight: bold; margin-bottom: 20px; }
          .line { display: flex; justify-content: space-between; margin: 5px 0; }
          .line-item { text-align: left; }
          .line-price { text-align: right; }
          .divider { border-top: ${
            printSettings.separatorStyle === 'none'
              ? '0'
              : printSettings.separatorStyle === 'double'
                ? '2px solid #000'
                : '1px dashed #000'
          }; margin: 10px 0; }
          .total-line { font-weight: bold; font-size: 14px; }
          .section-title { font-weight: bold; margin-top: 10px; margin-bottom: 5px; }
          .footer { text-align: center; font-size: 10px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            ${printSettings.showLogo ? '[LOGO]<br/>' : ''}
            ${printSettings.showStoreName ? 'AETHER POS SYSTEM<br/>' : ''}
            ${printSettings.showReceiptId ? `Receipt #${saleId || 'N/A'}<br/>` : ''}
            ${printSettings.showTimestamp && timestamp ? timestamp.toLocaleString() : ''}
            ${printSettings.headerText ? `<br/>${printSettings.headerText}` : ''}
          </div>

          ${printSettings.showItems ? `
          <div class="section-title">Items</div>
          ${items.map(item => `
            <div class="line">
              <span class="line-item">${item.name} x${item.qty}</span>
              <span class="line-price">$${((item.qty * item.unitPrice) / 100).toFixed(2)}</span>
            </div>
            ${printSettings.showItemDetails ? `<div style="font-size: 10px; color: #666;">@ $${(item.unitPrice / 100).toFixed(2)} each</div>` : ''}
          `).join('')}
          ` : ''}

          <div class="divider"></div>

          ${printSettings.showSubtotal ? `<div class="line">
            <span>Subtotal:</span>
            <span class="line-price">$${(subtotalCents / 100).toFixed(2)}</span>
          </div>` : ''}

          ${printSettings.showDiscounts && discountTotalCents > 0 ? `
            <div class="section-title">Discounts</div>
            ${discounts.map(d => `
              <div class="line">
                <span>${d.reason}</span>
                <span class="line-price">-$${(d.amountCents / 100).toFixed(2)}</span>
              </div>
            `).join('')}
            <div class="line">
              <span>Total Discount:</span>
              <span class="line-price">-$${(discountTotalCents / 100).toFixed(2)}</span>
            </div>
          ` : ''}

          ${printSettings.showTax && taxCents > 0 ? `
            <div class="line">
              <span>Tax:</span>
              <span class="line-price">$${(taxCents / 100).toFixed(2)}</span>
            </div>
          ` : ''}

          ${printSettings.showTotal ? '<div class="divider"></div>' : ''}

          ${printSettings.showTotal ? `<div class="line total-line">
            <span>TOTAL:</span>
            <span class="line-price">$${(totalCents / 100).toFixed(2)}</span>
          </div>` : ''}

          ${printSettings.showPaymentSection ? `
          <div class="section-title">Payment</div>
          ${printSettings.showPaymentBreakdown ? payments.map(p => `
            <div class="line">
              <span>${p.method}</span>
              <span class="line-price">$${(p.amountCents / 100).toFixed(2)}</span>
            </div>
            ${printSettings.showChange && p.changeCents ? `
              <div class="line">
                <span>Change:</span>
                <span class="line-price">$${(p.changeCents / 100).toFixed(2)}</span>
              </div>
            ` : ''}
          `).join('') : ''}
          ` : ''}

          <div class="footer">
            ${printSettings.showCashier && cashierName ? `<div>Cashier: ${cashierName}</div>` : ''}
            ${printSettings.showThankYou ? '<div>Thank you for your purchase!</div>' : ''}
            ${printSettings.footerText ? `<div>${printSettings.footerText}</div>` : ''}
          </div>
        </div>
      </body>
      </html>
    `
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Receipt Preview</CardTitle>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Receipt Simulation */}
          <div className="bg-background border-2 border-dashed border-border p-6 font-mono text-sm max-h-96 overflow-y-auto">
            <div className="text-center font-bold mb-4">
              {printSettings.showLogo && <div>[LOGO]</div>}
              {printSettings.showStoreName && <div>AETHER POS SYSTEM</div>}
              {printSettings.showReceiptId && <div>Receipt #{saleId || 'N/A'}</div>}
              {printSettings.showTimestamp && timestamp && (
                <div className="text-xs mt-1">
                  {timestamp.toLocaleString()}
                </div>
              )}
              {printSettings.headerText && (
                <div className="text-xs mt-2">{printSettings.headerText}</div>
              )}
            </div>

            {printSettings.showItems && (
              <div className={`${dividerClass} my-2 pt-2`}>
                Items
              </div>
            )}
            {printSettings.showItems && items.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between text-xs">
                  <span>{item.name}</span>
                  <span>${((item.qty * item.unitPrice) / 100).toFixed(2)}</span>
                </div>
                {printSettings.showItemDetails && (
                  <div className="text-xs text-muted-foreground ml-2">
                    {item.qty} × ${(item.unitPrice / 100).toFixed(2)}
                  </div>
                )}
              </div>
            ))}

            {printSettings.showSubtotal && (
              <div className={`${dividerClass} my-2 pt-2`}>
                <div className="flex justify-between text-xs">
                  <span>Subtotal:</span>
                  <span>${(subtotalCents / 100).toFixed(2)}</span>
                </div>
              </div>
            )}

            {printSettings.showDiscounts && discountTotalCents > 0 && (
              <div className="bg-muted p-2 rounded my-2">
                <div className="text-xs font-bold mb-1">Discounts</div>
                {discounts.map((d, i) => (
                  <div key={`${d.reason}-${d.amountCents}-${i}`} className="flex justify-between text-xs">
                    <span>{d.reason}</span>
                    <span>-${(d.amountCents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {printSettings.showTax && taxCents > 0 && (
              <div className="flex justify-between text-xs my-2">
                <span>Tax:</span>
                <span>${(taxCents / 100).toFixed(2)}</span>
              </div>
            )}

            {printSettings.showTotal && (
              <div className={`${dividerClass} my-2 pt-2`}>
                <div className="flex justify-between font-bold">
                  <span>TOTAL:</span>
                  <span>${(totalCents / 100).toFixed(2)}</span>
                </div>
              </div>
            )}

            {printSettings.showPaymentSection && (
              <div className={`${dividerClass} my-2 pt-2`}>
                <div className="text-xs font-bold mb-1">Payment</div>
                {printSettings.showPaymentBreakdown && payments.map((p, i) => (
                  <div key={`${p.method}-${p.amountCents}-${p.changeCents ?? 0}-${i}`}>
                    <div className="flex justify-between text-xs">
                      <span>{p.method}:</span>
                      <span>${(p.amountCents / 100).toFixed(2)}</span>
                    </div>
                    {printSettings.showChange && p.changeCents > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Change:</span>
                        <span>${(p.changeCents / 100).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className={`text-center text-xs mt-4 pt-2 ${dividerClass}`}>
              {printSettings.showCashier && cashierName && <div>Cashier: {cashierName}</div>}
              {printSettings.showThankYou && <div className="mt-2">Thank you for your purchase!</div>}
              {printSettings.footerText && <div className="mt-1">{printSettings.footerText}</div>}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              onClick={handlePrint}
              className="flex-1 gap-2"
            >
              <Printer className="h-4 w-4" />
              Print Receipt
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
