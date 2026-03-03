import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Plus, Trash2, X } from 'lucide-react'

interface Payment {
  id: string
  method: 'CASH' | 'CARD' | 'CHECK' | 'GIFT_CARD' | 'LOYALTY_POINTS' | 'STORE_CREDIT'
  amountCents: number
  reference?: string
  changeCents?: number
}

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (payments: any[]) => void
  totalCents: number
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', icon: '💵' },
  { value: 'CARD', label: 'Credit/Debit Card', icon: '💳' },
  { value: 'CHECK', label: 'Check', icon: '📋' },
  { value: 'GIFT_CARD', label: 'Gift Card', icon: '🎁' },
  { value: 'LOYALTY_POINTS', label: 'Loyalty Points', icon: '⭐' },
  { value: 'STORE_CREDIT', label: 'Store Credit', icon: '💰' },
]

export function PaymentModal({
  isOpen,
  onClose,
  onApply,
  totalCents,
}: PaymentModalProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [currentMethod, setCurrentMethod] = useState<'CASH' | 'CARD' | 'CHECK' | 'GIFT_CARD' | 'LOYALTY_POINTS' | 'STORE_CREDIT'>('CASH')
  const [currentAmount, setCurrentAmount] = useState('')
  const [currentReference, setCurrentReference] = useState('')
  const [error, setError] = useState('')

  const totalPaid = payments.reduce((sum, p) => sum + p.amountCents, 0)
  const remainingCents = Math.max(0, totalCents - totalPaid)
  const totalChange = payments
    .filter(p => p.method === 'CASH')
    .reduce((sum, p) => sum + (p.changeCents || 0), 0)

  const handleAddPayment = () => {
    setError('')

    const amountCents = Math.round(parseFloat(currentAmount) * 100 || 0)
    if (amountCents <= 0) {
      setError('Amount must be greater than 0')
      return
    }

    if (currentMethod === 'CARD' && !currentReference) {
      setError('Card payment requires last 4 digits')
      return
    }

    if (currentMethod === 'CHECK' && !currentReference) {
      setError('Check payment requires check number')
      return
    }

    let changeCents = 0
    if (currentMethod === 'CASH') {
      changeCents = Math.max(0, amountCents - remainingCents)
    }

    const newPayment: Payment = {
      id: `payment-${Date.now()}`,
      method: currentMethod,
      amountCents: currentMethod === 'CASH' ? totalCents : amountCents,
      reference: currentReference || undefined,
      changeCents,
    }

    setPayments([...payments, newPayment])
    setCurrentAmount('')
    setCurrentReference('')

    // Auto-close if payment is complete for single payment
    if (payments.length === 0 && currentMethod === 'CASH') {
      setTimeout(() => {
        handleApply()
      }, 300)
    }
  }

  const handleRemovePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id))
  }

  const handleApply = () => {
    setError('')

    if (payments.length === 0) {
      setError('Select at least one payment method')
      return
    }

    onApply(payments.map(p => ({
      method: p.method,
      amountCents: p.amountCents,
      reference: p.reference,
    })))

    setPayments([])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payment Method</CardTitle>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Payment Method Selection */}
          <div>
            <label className="text-sm font-medium">Select Payment Method</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => setCurrentMethod(method.value as any)}
                  className={`p-3 rounded border-2 text-left transition-colors ${
                    currentMethod === method.value
                      ? 'border-accent bg-accent bg-opacity-10'
                      : 'border-border hover:border-accent'
                  }`}
                >
                  <div className="text-lg mb-1">{method.icon}</div>
                  <div className="text-sm font-medium">{method.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Amount ($)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                step="0.01"
                min="0"
                className="mt-1"
                disabled={payments.length > 0 && currentMethod === 'CASH'}
              />
            </div>

            {/* Reference (Card, Check, etc.) */}
            {['CARD', 'CHECK', 'GIFT_CARD', 'LOYALTY_POINTS'].includes(currentMethod) && (
              <div>
                <label className="text-sm font-medium">
                  {currentMethod === 'CARD' && 'Last 4 Digits'}
                  {currentMethod === 'CHECK' && 'Check Number'}
                  {currentMethod === 'GIFT_CARD' && 'Card ID'}
                  {currentMethod === 'LOYALTY_POINTS' && 'Member ID'}
                </label>
                <Input
                  type="text"
                  placeholder="Enter reference"
                  value={currentReference}
                  onChange={(e) => setCurrentReference(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {/* Add Payment Button */}
          {payments.length === 0 && (
            <Button
              onClick={handleAddPayment}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              {currentMethod === 'CASH' ? 'Pay with Cash' : 'Add Payment'}
            </Button>
          )}

          {/* Split Payments */}
          {payments.length > 0 && (
            <>
              <div className="bg-muted p-4 rounded space-y-2">
                <div className="text-sm font-medium">Payments Added</div>
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between bg-background p-2 rounded"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {PAYMENT_METHODS.find(m => m.value === payment.method)?.label}
                      </div>
                      {payment.reference && (
                        <div className="text-xs text-muted-foreground">
                          Ref: {payment.reference}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold">
                          ${(payment.amountCents / 100).toFixed(2)}
                        </div>
                        {payment.changeCents > 0 && (
                          <div className="text-xs text-green-600">
                            Change: ${(payment.changeCents / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemovePayment(payment.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add another payment method */}
              {remainingCents > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Add Another Payment</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={currentAmount}
                        onChange={(e) => setCurrentAmount(e.target.value)}
                        step="0.01"
                        min="0"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Method</label>
                      <select
                        value={currentMethod}
                        onChange={(e) => setCurrentMethod(e.target.value as any)}
                        className="w-full mt-1 px-3 py-2 border rounded bg-background"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddPayment}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payment
                  </Button>
                </>
              )}
            </>
          )}

          {/* Summary */}
          <div className="bg-muted p-3 rounded space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Due:</span>
              <span className="font-bold">${(totalCents / 100).toFixed(2)}</span>
            </div>
            {totalPaid > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Total Paid:</span>
                  <span className="font-bold">${(totalPaid / 100).toFixed(2)}</span>
                </div>
                {remainingCents > 0 && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Remaining:</span>
                    <span className="font-bold">${(remainingCents / 100).toFixed(2)}</span>
                  </div>
                )}
                {totalChange > 0 && (
                  <div className="flex justify-between text-sm text-green-600 border-t pt-2">
                    <span>Change:</span>
                    <span className="font-bold">${(totalChange / 100).toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={payments.length === 0 || remainingCents > 0}
              className="flex-1"
            >
              {remainingCents > 0
                ? `Pay Remaining $${(remainingCents / 100).toFixed(2)}`
                : 'Complete Payment'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
