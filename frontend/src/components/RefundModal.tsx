import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { X } from 'lucide-react'
import { salesAPI } from '@/lib/api'

interface RefundItem {
  id: string
  productName: string
  qty: number
  unitPrice: number
  totalPrice: number
  selectedQty: number
}

interface RefundModalProps {
  isOpen: boolean
  onClose: () => void
  onRefund: (result: any) => void
  saleId?: string
}

const REFUND_REASONS = [
  { value: 'DEFECTIVE', label: 'Defective Product' },
  { value: 'CHANGE_MIND', label: 'Customer Changed Mind' },
  { value: 'WRONG_ITEM', label: 'Wrong Item Received' },
  { value: 'DAMAGE', label: 'Item Damaged in Transport' },
  { value: 'CUSTOMER_REQUEST', label: 'Customer Request' },
]

export function RefundModal({
  isOpen,
  onClose,
  onRefund,
  saleId,
}: RefundModalProps) {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full')
  const [reason, setReason] = useState('CHANGE_MIND')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<RefundItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && saleId) {
      loadSaleDetails()
    }
  }, [isOpen, saleId])

  const loadSaleDetails = async () => {
    if (!saleId) return
    try {
      setLoading(true)
      const response = await salesAPI.get(saleId)
      const sale = response.data

      const refundItems: RefundItem[] = sale.items.map((item: any) => ({
        id: item.id,
        productName: item.product.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.qty,
        selectedQty: refundType === 'full' ? item.qty : 0,
      }))

      setItems(refundItems)
    } catch (e) {
      setError('Failed to load sale details')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleRefundTypeChange = (type: 'full' | 'partial') => {
    setRefundType(type)
    if (type === 'full') {
      setItems(items.map(item => ({ ...item, selectedQty: item.qty })))
    } else {
      setItems(items.map(item => ({ ...item, selectedQty: 0 })))
    }
  }

  const handleQtyChange = (itemId: string, qty: number) => {
    setItems(
      items.map(item =>
        item.id === itemId
          ? { ...item, selectedQty: Math.min(qty, item.qty) }
          : item
      )
    )
  }

  const selectedItems = items.filter(item => item.selectedQty > 0)
  const refundAmountCents = selectedItems.reduce(
    (sum, item) => sum + (item.unitPrice * item.selectedQty),
    0
  )

  const handleRefund = async () => {
    setError('')

    if (!saleId) {
      setError('Sale ID is required')
      return
    }

    if (refundAmountCents === 0) {
      setError('Select items to refund')
      return
    }

    try {
      setLoading(true)

      let refundData: any = {
        type: refundType,
        reason,
        notes: notes || undefined,
      }

      if (refundType === 'partial') {
        refundData.items = selectedItems.map(item => ({
          itemId: item.id,
          qty: item.selectedQty,
        }))
      }

      const response = await salesAPI.refund(saleId, refundData)
      onRefund(response.data)
      handleClose()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to process refund')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setRefundType('full')
    setReason('CHANGE_MIND')
    setNotes('')
    setItems([])
    setError('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-96 overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-background">
          <CardTitle>Process Refund</CardTitle>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !items.length ? (
            <div className="text-center py-8">Loading sale details...</div>
          ) : (
            <>
              {/* Refund Type */}
              <div>
                <label className="text-sm font-medium">Refund Type</label>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleRefundTypeChange('full')}
                    className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
                      refundType === 'full'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Full Refund
                  </button>
                  <button
                    onClick={() => handleRefundTypeChange('partial')}
                    className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
                      refundType === 'partial'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Partial Refund
                  </button>
                </div>
              </div>

              {/* Items for Partial Refund */}
              {refundType === 'partial' && items.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Select Items to Refund</label>
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                    {items.map(item => (
                      <div key={item.id} className="p-2 bg-muted rounded">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{item.productName}</div>
                            <div className="text-xs text-muted-foreground">
                              ${(item.unitPrice / 100).toFixed(2)} × {item.qty} = $
                              {(item.totalPrice / 100).toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max={item.qty}
                              value={item.selectedQty}
                              onChange={(e) => handleQtyChange(item.id, parseInt(e.target.value) || 0)}
                              className="w-16 h-8"
                            />
                            <div className="text-xs text-muted-foreground">of {item.qty}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="text-sm font-medium">Reason for Refund</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded bg-background"
                >
                  {REFUND_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input
                  type="text"
                  placeholder="Additional details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Refund Summary */}
              {refundAmountCents > 0 && (
                <div className="bg-muted p-3 rounded">
                  <div className="flex justify-between">
                    <span className="font-medium">Refund Amount:</span>
                    <span className="font-bold text-green-600">
                      ${(refundAmountCents / 100).toFixed(2)}
                    </span>
                  </div>
                  {refundType === 'partial' && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {selectedItems.length} item(s) selected
                    </div>
                  )}
                </div>
              )}

              {error && <div className="text-sm text-red-600">{error}</div>}

              {/* Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRefund}
                  disabled={refundAmountCents === 0 || loading}
                  className="flex-1"
                >
                  {loading ? 'Processing...' : 'Process Refund'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
