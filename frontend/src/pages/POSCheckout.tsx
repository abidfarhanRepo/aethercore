import React, { useState, useEffect } from 'react'
import { productsAPI, salesAPI } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ShoppingCart, Trash2, Plus, Minus, Search, Printer, Gift, Loader, X } from 'lucide-react'
import { DiscountModal } from '@/components/DiscountModal'
import { PaymentModal } from '@/components/PaymentModal'
import { RefundModal } from '@/components/RefundModal'
import { ReceiptPreview } from '@/components/ReceiptPreview'

interface Product {
  id: string
  sku: string
  barcode?: string
  name: string
  priceCents: number
}

interface CartItem {
  productId: string
  name: string
  qty: number
  unitPrice: number
}

interface AppliedDiscount {
  id: string
  reason: string
  type: string
  amountCents: number
  percentage?: number
  description?: string
}

interface AppliedPayment {
  method: string
  amountCents: number
  reference?: string
  changeCents?: number
}

interface CompletedSale {
  id: string
  totalCents: number
  discountCents: number
  taxCents: number
  itemCount: number
  paymentMethods: string[]
}

interface ReceiptSnapshot {
  items: CartItem[]
  discounts: AppliedDiscount[]
  subtotalCents: number
  discountTotalCents: number
  taxCents: number
  totalCents: number
  payments: AppliedPayment[]
  saleId?: string
  timestamp: Date
}

export function POSCheckout() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [appliedDiscounts, setAppliedDiscounts] = useState<AppliedDiscount[]>([])

  // Modal states
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)

  // Loyalty lookupstates
  const [loyaltyNumber, setLoyaltyNumber] = useState('')
  const [isLoyaltyLoading, setIsLoyaltyLoading] = useState(false)

  // Last sale for void operation
  const [lastSaleId, setLastSaleId] = useState<string | null>(null)
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null)
  const [receiptSnapshot, setReceiptSnapshot] = useState<ReceiptSnapshot | null>(null)

  // Selected payments
  const [appliedPayments, setAppliedPayments] = useState<AppliedPayment[]>([])

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setIsLoading(true)
      const response = await productsAPI.list()
      setProducts(Array.isArray(response.data) ? response.data : response.data?.products || [])
    } catch (err) {
      setError('Failed to load products')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id)
    if (existing) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, qty: item.qty + 1 }
          : item
      ))
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        qty: 1,
        unitPrice: product.priceCents,
      }])
    }
    setSearch('')
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId)
    } else {
      setCart(cart.map(item =>
        item.productId === productId ? { ...item, qty } : item
      ))
    }
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId))
  }

  const removeDiscount = (discountId: string) => {
    setAppliedDiscounts(appliedDiscounts.filter(d => d.id !== discountId))
  }

  // Calculations
  const subtotalCents = cart.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  const totalDiscountCents = appliedDiscounts.reduce((sum, d) => sum + d.amountCents, 0)
  const taxableCents = subtotalCents - totalDiscountCents
  const taxCents = Math.floor((taxableCents * 10) / 100) // 10% tax
  const totalCents = taxableCents + taxCents

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode?.includes(search) || false)
  ).slice(0, 10)

  const handleApplyDiscount = (discount: any) => {
    const newDiscount: AppliedDiscount = {
      id: `discount-${Date.now()}`,
      reason: discount.reason,
      type: discount.type,
      amountCents: discount.amountCents,
      percentage: discount.percentage,
      description: discount.description,
    }
    setAppliedDiscounts([...appliedDiscounts, newDiscount])
  }

  const handleApplyPayment = (payments: AppliedPayment[]) => {
    setAppliedPayments(payments)
    proceedWithCheckout(payments)
  }

  const proceedWithCheckout = async (payments: AppliedPayment[]) => {
    // Validate cart is not empty
    if (cart.length === 0) {
      setError('Cart is empty')
      return
    }

    // Validate all products exist
    if (cart.some(item => !item.productId)) {
      setError('Invalid product in cart')
      return
    }

    // Calculate subtotal
    const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0)
    
    // Calculate total discount amount (from applied discounts)
    const totalDiscount = appliedDiscounts.reduce((sum, d) => sum + d.amountCents, 0)
    
    // Validate discounts don't exceed 50% of subtotal
    if (totalDiscount > subtotal * 0.5) {
      setError('Discounts cannot exceed 50% of subtotal')
      return
    }
    
    // FIX: Calculate tax on the DISCOUNTED subtotal (to match backend calculation)
    const taxRatePercent = 10  // Match backend assumption
    const taxableAmount = subtotal - totalDiscount
    const taxAmount = Math.floor((taxableAmount * taxRatePercent) / 100)
    const expectedTotal = taxableAmount + taxAmount

    // Validate payment amount matches total (with small tolerance for rounding)
    const totalPayment = payments.reduce((sum, p) => sum + p.amountCents, 0)
    if (Math.abs(totalPayment - expectedTotal) > 5) {  // Allow 5 cents tolerance
      setError(`Payment mismatch: Expected $${(expectedTotal/100).toFixed(2)}, got $${(totalPayment/100).toFixed(2)}`)
      return
    }

    try {
      setIsProcessing(true)
      setError(null)

      const saleData = {
        items: cart.map(item => ({
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
        })),
        discounts: appliedDiscounts.map(d => ({
          reason: d.reason,
          type: d.type,
          amountCents: d.type === 'FIXED_AMOUNT' ? d.amountCents : undefined,
          percentage: d.type === 'PERCENTAGE' ? d.percentage : undefined,
          description: d.description,
        })),
        payments,
        paymentMethod: payments[0]?.method || 'CASH',
        notes: loyaltyNumber ? `Loyalty Member: ${loyaltyNumber}` : undefined,
      }

      const response = await salesAPI.create(saleData)
      const saleId = response.data.id

      const snapshot: ReceiptSnapshot = {
        items: [...cart],
        discounts: [...appliedDiscounts],
        subtotalCents,
        discountTotalCents: totalDiscountCents,
        taxCents,
        totalCents,
        payments: [...payments],
        saleId,
        timestamp: new Date(),
      }

      setCompletedSale(response.data)
      setLastSaleId(saleId)
      setReceiptSnapshot(snapshot)

      // Reset UI for next transaction
      setCart([])
      setAppliedDiscounts([])
      setAppliedPayments([])
      setLoyaltyNumber('')

      // Show receipt preview
      setIsReceiptModalOpen(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process sale')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleVoidSale = async (saleId: string) => {
    if (!window.confirm('Are you sure you want to void this sale? This cannot be undone.')) {
      return
    }

    try {
      setIsProcessing(true)
      setError(null)

      await salesAPI.void(saleId, {
        reason: 'Operator request',
      })

      setLastSaleId(null)
      setCompletedSale(null)
      alert('Sale voided successfully')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to void sale')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="h-screen grid grid-cols-3 gap-4 p-4 bg-background">
      {/* Products Panel */}
      <div className="col-span-2 flex flex-col gap-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Search Products</h2>
          <Input
            placeholder="Scan barcode or search SKU/name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="text-lg h-12"
          />
        </div>

        {/* Quick Product List */}
        <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader className="h-6 w-6 animate-spin" />
            </div>
          ) : error && search === '' ? (
            <div className="flex items-center justify-center h-full text-red-600">{error}</div>
          ) : filteredProducts.length === 0 || search === '' ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Search for products above
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-3 rounded-lg border border-border hover:bg-accent active:scale-95 transition-all text-left"
                >
                  <div className="font-semibold">{product.name}</div>
                  <div className="text-sm text-muted-foreground">{product.sku}</div>
                  <div className="text-lg font-bold text-accent">
                    ${(product.priceCents / 100).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      <div className="flex flex-col gap-4">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Cart ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground">Cart is empty</div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="p-2 rounded-lg border border-border">
                    <div className="font-semibold text-sm">{item.name}</div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="text-sm text-muted-foreground">
                        ${(item.unitPrice / 100).toFixed(2)} × {item.qty}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => updateQty(item.productId, item.qty - 1)}
                        className="flex-1 py-1 text-sm border rounded hover:bg-muted"
                      >
                        <Minus className="h-3 w-3 mx-auto" />
                      </button>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateQty(item.productId, parseInt(e.target.value) || 1)}
                        className="flex-1 text-center text-sm border rounded"
                      />
                      <button
                        onClick={() => updateQty(item.productId, item.qty + 1)}
                        className="flex-1 py-1 text-sm border rounded hover:bg-muted"
                      >
                        <Plus className="h-3 w-3 mx-auto" />
                      </button>
                    </div>
                    <div className="text-right font-semibold text-sm mt-2">
                      ${((item.qty * item.unitPrice) / 100).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loyalty Number & Discounts */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            {/* Loyalty Number */}
            <div className="flex gap-2">
              <Input
                placeholder="Loyalty #"
                value={loyaltyNumber}
                onChange={(e) => setLoyaltyNumber(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!loyaltyNumber || isLoyaltyLoading}
              >
                {isLoyaltyLoading ? 'Loading...' : <Gift className="h-4 w-4" />}
              </Button>
            </div>

            {/* Discounts Display */}
            {appliedDiscounts.length > 0 && (
              <div className="bg-muted p-3 rounded space-y-2">
                <div className="text-sm font-medium">Applied Discounts</div>
                {appliedDiscounts.map((discount) => (
                  <div
                    key={discount.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="text-xs text-muted-foreground">{discount.reason}</span>
                      {discount.description && (
                        <div className="text-xs text-muted-foreground">{discount.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-600">
                        -${(discount.amountCents / 100).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeDiscount(discount.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals and Checkout */}
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>

            {totalDiscountCents > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discounts:</span>
                <span>-${(totalDiscountCents / 100).toFixed(2)}</span>
              </div>
            )}

            {taxCents > 0 && (
              <div className="flex justify-between text-sm text-blue-600">
                <span>Tax (10%):</span>
                <span>${(taxCents / 100).toFixed(2)}</span>
              </div>
            )}

            <div className="border-t pt-3 flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>${(totalCents / 100).toFixed(2)}</span>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDiscountModalOpen(true)}
                disabled={cart.length === 0 || isProcessing}
                size="sm"
              >
                Discount
              </Button>
              <Button
                variant="outline"
                onClick={() => setCart([])}
                disabled={cart.length === 0 || isProcessing}
                size="sm"
              >
                Clear
              </Button>
              <Button
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={cart.length === 0 || isProcessing}
                className="gap-2"
              >
                {isProcessing ? <Loader className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                {isProcessing ? 'Payment...' : `Pay $${(totalCents / 100).toFixed(2)}`}
              </Button>
            </div>

            {lastSaleId && (
              <Button
                variant="outline"
                onClick={() => handleVoidSale(lastSaleId)}
                disabled={isProcessing}
                size="sm"
                className="w-full text-red-600"
              >
                Void Last Sale
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        onApply={handleApplyDiscount}
        subtotal={subtotalCents}
        maxDiscount={Math.floor(subtotalCents * 0.5)}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onApply={handleApplyPayment}
        totalCents={totalCents}
      />

      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        onRefund={(result) => {
          alert('Refund processed successfully')
          setIsRefundModalOpen(false)
        }}
        saleId={lastSaleId || undefined}
      />

      <ReceiptPreview
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        items={receiptSnapshot?.items || []}
        discounts={receiptSnapshot?.discounts || []}
        subtotalCents={receiptSnapshot?.subtotalCents || 0}
        discountTotalCents={receiptSnapshot?.discountTotalCents || 0}
        taxCents={receiptSnapshot?.taxCents || 0}
        totalCents={receiptSnapshot?.totalCents || 0}
        payments={receiptSnapshot?.payments || []}
        saleId={receiptSnapshot?.saleId || completedSale?.id}
        timestamp={receiptSnapshot?.timestamp || new Date()}
      />
    </div>
  )
}

export default POSCheckout
