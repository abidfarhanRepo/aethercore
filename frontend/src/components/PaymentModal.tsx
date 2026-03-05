import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { X } from 'lucide-react'

type PaymentMethod = 'CASH' | 'CARD'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (payments: Array<{ method: PaymentMethod; amountCents: number; reference?: string }>) => void
  totalCents: number
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string; icon: string }> = [
  { value: 'CASH', label: 'Cash', icon: '💵' },
  { value: 'CARD', label: 'Credit Card', icon: '💳' },
]

export function PaymentModal({ isOpen, onClose, onApply, totalCents }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [cashTendered, setCashTendered] = useState('')
  const [cardLast4, setCardLast4] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setMethod('CASH')
    setCashTendered((totalCents / 100).toFixed(2))
    setCardLast4('')
    setError('')
  }, [isOpen, totalCents])

  const tenderedCents = useMemo(() => {
    const value = Math.round((parseFloat(cashTendered) || 0) * 100)
    return Number.isFinite(value) ? value : 0
  }, [cashTendered])

  const changeCents = Math.max(0, tenderedCents - totalCents)

  const handleComplete = () => {
    setError('')

    if (method === 'CASH') {
      if (tenderedCents < totalCents) {
        setError(`Insufficient cash. Need at least $${(totalCents / 100).toFixed(2)}`)
        return
      }

      // Persist total collected amount for the sale payment row.
      onApply([
        {
          method: 'CASH',
          amountCents: totalCents,
          reference: `Tendered:${(tenderedCents / 100).toFixed(2)};Change:${(changeCents / 100).toFixed(2)}`,
        },
      ])
      onClose()
      return
    }

    const normalizedLast4 = cardLast4.replace(/\D/g, '')
    if (normalizedLast4.length !== 4) {
      setError('Card payment requires exactly 4 digits')
      return
    }

    onApply([
      {
        method: 'CARD',
        amountCents: totalCents,
        reference: normalizedLast4,
      },
    ])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Select Payment</CardTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-sm font-medium">Payment Method</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {PAYMENT_METHODS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    setMethod(item.value)
                    setError('')
                  }}
                  className={`p-3 rounded border-2 text-left transition-colors ${
                    method === item.value
                      ? 'border-accent bg-accent bg-opacity-10'
                      : 'border-border hover:border-accent'
                  }`}
                >
                  <div className="text-lg mb-1">{item.icon}</div>
                  <div className="text-sm font-medium">{item.label}</div>
                </button>
              ))}
            </div>
          </div>

          {method === 'CASH' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Cash Tendered ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder={(totalCents / 100).toFixed(2)}
              />
              <div className="text-xs text-muted-foreground">
                Change: ${(changeCents / 100).toFixed(2)}
              </div>
            </div>
          )}

          {method === 'CARD' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Card Last 4 Digits</label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
              />
            </div>
          )}

          <div className="bg-muted p-3 rounded space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total Due:</span>
              <span className="font-bold">${(totalCents / 100).toFixed(2)}</span>
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleComplete} className="flex-1">
              Complete Payment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
