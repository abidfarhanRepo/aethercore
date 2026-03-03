import React from 'react'
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
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .total-line { font-weight: bold; font-size: 14px; }
          .section-title { font-weight: bold; margin-top: 10px; margin-bottom: 5px; }
          .footer { text-align: center; font-size: 10px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            AETHER POS SYSTEM<br/>
            Receipt #${saleId || 'N/A'}<br/>
            ${timestamp ? timestamp.toLocaleString() : ''}
          </div>

          <div class="section-title">Items</div>
          ${items.map(item => `
            <div class="line">
              <span class="line-item">${item.name} x${item.qty}</span>
              <span class="line-price">$${((item.qty * item.unitPrice) / 100).toFixed(2)}</span>
            </div>
            <div style="font-size: 10px; color: #666;">@ $${(item.unitPrice / 100).toFixed(2)} each</div>
          `).join('')}

          <div class="divider"></div>

          <div class="line">
            <span>Subtotal:</span>
            <span class="line-price">$${(subtotalCents / 100).toFixed(2)}</span>
          </div>

          ${discountTotalCents > 0 ? `
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

          ${taxCents > 0 ? `
            <div class="line">
              <span>Tax (10%):</span>
              <span class="line-price">$${(taxCents / 100).toFixed(2)}</span>
            </div>
          ` : ''}

          <div class="divider"></div>

          <div class="line total-line">
            <span>TOTAL:</span>
            <span class="line-price">$${(totalCents / 100).toFixed(2)}</span>
          </div>

          <div class="section-title">Payment</div>
          ${payments.map(p => `
            <div class="line">
              <span>${p.method}</span>
              <span class="line-price">$${(p.amountCents / 100).toFixed(2)}</span>
            </div>
            ${p.changeCents ? `
              <div class="line">
                <span>Change:</span>
                <span class="line-price">$${(p.changeCents / 100).toFixed(2)}</span>
              </div>
            ` : ''}
          `).join('')}

          <div class="footer">
            ${cashierName ? `<div>Cashier: ${cashierName}</div>` : ''}
            <div>Thank you for your purchase!</div>
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
              <div>AETHER POS SYSTEM</div>
              <div>Receipt #{saleId || 'N/A'}</div>
              {timestamp && (
                <div className="text-xs mt-1">
                  {timestamp.toLocaleString()}
                </div>
              )}
            </div>

            <div className="border-t border-dashed my-2 pt-2">
              Items
            </div>
            {items.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between text-xs">
                  <span>{item.name}</span>
                  <span>${((item.qty * item.unitPrice) / 100).toFixed(2)}</span>
                </div>
                <div className="text-xs text-muted-foreground ml-2">
                  {item.qty} × ${(item.unitPrice / 100).toFixed(2)}
                </div>
              </div>
            ))}

            <div className="border-t border-dashed my-2 pt-2">
              <div className="flex justify-between text-xs">
                <span>Subtotal:</span>
                <span>${(subtotalCents / 100).toFixed(2)}</span>
              </div>
            </div>

            {discountTotalCents > 0 && (
              <div className="bg-muted p-2 rounded my-2">
                <div className="text-xs font-bold mb-1">Discounts</div>
                {discounts.map((d, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>{d.reason}</span>
                    <span>-${(d.amountCents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {taxCents > 0 && (
              <div className="flex justify-between text-xs my-2">
                <span>Tax (10%):</span>
                <span>${(taxCents / 100).toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-dashed my-2 pt-2">
              <div className="flex justify-between font-bold">
                <span>TOTAL:</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-dashed my-2 pt-2">
              <div className="text-xs font-bold mb-1">Payment</div>
              {payments.map((p, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs">
                    <span>{p.method}:</span>
                    <span>${(p.amountCents / 100).toFixed(2)}</span>
                  </div>
                  {p.changeCents > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Change:</span>
                      <span>${(p.changeCents / 100).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center text-xs mt-4 pt-2 border-t border-dashed">
              {cashierName && <div>Cashier: {cashierName}</div>}
              <div className="mt-2">Thank you for your purchase!</div>
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
