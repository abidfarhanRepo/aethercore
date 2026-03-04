import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { X } from 'lucide-react'

interface DiscountModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (discount: any) => void
  subtotal: number
  maxDiscount?: number
}

const DISCOUNT_REASONS = [
  { value: 'COUPON', label: 'Coupon Code' },
  { value: 'LOYALTY', label: 'Loyalty Program' },
  { value: 'BULK', label: 'Bulk Purchase' },
  { value: 'EMPLOYEE', label: 'Employee Discount' },
  { value: 'PROMOTIONAL', label: 'Promotional' },
  { value: 'DAMAGED', label: 'Damaged Goods' },
]

export function DiscountModal({
  isOpen,
  onClose,
  onApply,
  subtotal,
  maxDiscount,
}: DiscountModalProps) {
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED')
  const [amount, setAmount] = useState('')
  const [percentage, setPercentage] = useState('')
  const [reason, setReason] = useState('COUPON')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const calculateDiscount = (): number => {
    if (discountType === 'FIXED') {
      return Math.min(parseFloat(amount) * 100 || 0, subtotal)
    } else {
      const pct = parseFloat(percentage) || 0
      return Math.floor((subtotal * pct) / 100)
    }
  }

  const discountCents = calculateDiscount()
  const maxAllowedDiscount = maxDiscount || Math.floor(subtotal * 0.5)
  const isValid = discountCents > 0 && discountCents <= maxAllowedDiscount

  const handleApply = () => {
    setError('')

    if (discountCents <= 0) {
      setError('Discount amount must be greater than 0')
      return
    }

    if (discountCents > maxAllowedDiscount) {
      setError(`Discount cannot exceed $${(maxAllowedDiscount / 100).toFixed(2)}`)
      return
    }

    onApply({
      reason,
      type: discountType === 'FIXED' ? 'FIXED_AMOUNT' : 'PERCENTAGE',
      amountCents: discountType === 'FIXED' ? discountCents : undefined,
      percentage: discountType === 'PERCENTAGE' ? parseFloat(percentage) : undefined,
      description: description || undefined,
    })

    // Reset form
    setAmount('')
    setPercentage('')
    setDescription('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Add Discount</CardTitle>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto flex-1">
          {/* Discount Type */}
          <div>
            <label className="text-sm font-medium">Discount Type</label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setDiscountType('FIXED')}
                className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
                  discountType === 'FIXED'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                Fixed Amount
              </button>
              <button
                onClick={() => setDiscountType('PERCENTAGE')}
                className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
                  discountType === 'PERCENTAGE'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                Percentage
              </button>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-sm font-medium">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded bg-background"
            >
              {DISCOUNT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          {discountType === 'FIXED' ? (
            <div>
              <label className="text-sm font-medium">Discount Amount ($)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                className="mt-1"
              />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium">Discount Percentage (%)</label>
              <Input
                type="number"
                placeholder="0"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                step="0.1"
                min="0"
                max="100"
                className="mt-1"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description (Optional)</label>
            <Input
              type="text"
              placeholder="e.g., Back to school promo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Preview */}
          {discountCents > 0 && (
            <div className="bg-muted p-3 rounded">
              <div className="flex justify-between text-sm">
                <span>Discount Preview:</span>
                <span className="font-bold text-green-600">
                  -${(discountCents / 100).toFixed(2)}
                </span>
              </div>
              {discountType === 'PERCENTAGE' && (
                <div className="text-xs text-muted-foreground mt-1">
                  {percentage}% of ${(subtotal / 100).toFixed(2)}
                </div>
              )}
              {discountCents > maxAllowedDiscount && (
                <div className="text-xs text-red-600 mt-1">
                  Exceeds maximum allowed discount
                </div>
              )}
            </div>
          )}

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
              disabled={!isValid}
              className="flex-1"
            >
              Apply Discount
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
