import React, { useState, useEffect, useRef } from 'react'
import { productsAPI, salesAPI } from '@/lib/api'
import { networkMonitor } from '@/lib/offline/network'
import {
  generateOfflineOpId,
  generateReceiptPublicId,
  getOrCreateTerminalId,
} from '@/lib/offline/receiptIdentity'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ShoppingCart, Trash2, Plus, Minus, Printer, Gift, Loader, X, Keyboard } from 'lucide-react'
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
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(-1)
  const [productQtyBuffer, setProductQtyBuffer] = useState('')
  const [isProductKeyboardMode, setIsProductKeyboardMode] = useState(false)
  const [highlightedCartIndex, setHighlightedCartIndex] = useState(-1)
  const [cartQtyBuffer, setCartQtyBuffer] = useState('')
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
  const [terminalId] = useState(() => getOrCreateTerminalId())
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  const addToCart = (product: Product, qty: number = 1) => {
    const sanitizedQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1
    const existing = cart.find(item => item.productId === product.id)
    if (existing) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, qty: item.qty + sanitizedQty }
          : item
      ))
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        qty: sanitizedQty,
        unitPrice: product.priceCents,
      }])
    }
    setSearch('')
    setHighlightedProductIndex(-1)
    setProductQtyBuffer('')
    setIsProductKeyboardMode(false)
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

  const normalizedSearch = search.trim().toLowerCase()
  const isSearchActive = normalizedSearch.length > 0
  const isAnyModalOpen =
    isDiscountModalOpen || isPaymentModalOpen || isRefundModalOpen || isReceiptModalOpen

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(normalizedSearch) ||
    p.sku.toLowerCase().includes(normalizedSearch) ||
    (p.barcode?.includes(search.trim()) || false)
  ).slice(0, 10)

  useEffect(() => {
    if (!isSearchActive || filteredProducts.length === 0) {
      if (highlightedProductIndex !== -1) {
        setHighlightedProductIndex(-1)
      }
      if (productQtyBuffer !== '') {
        setProductQtyBuffer('')
      }
      if (isProductKeyboardMode) {
        setIsProductKeyboardMode(false)
      }
      return
    }

    if (highlightedProductIndex < 0) {
      setHighlightedProductIndex(0)
      return
    }

    if (highlightedProductIndex >= filteredProducts.length) {
      setHighlightedProductIndex(filteredProducts.length - 1)
    }
  }, [isSearchActive, filteredProducts, highlightedProductIndex, productQtyBuffer, isProductKeyboardMode])

  useEffect(() => {
    if (cart.length === 0) {
      if (highlightedCartIndex !== -1) {
        setHighlightedCartIndex(-1)
      }
      if (cartQtyBuffer !== '') {
        setCartQtyBuffer('')
      }
      return
    }

    if (highlightedCartIndex < 0) {
      setHighlightedCartIndex(0)
      return
    }

    if (highlightedCartIndex >= cart.length) {
      setHighlightedCartIndex(cart.length - 1)
    }
  }, [cart, highlightedCartIndex, cartQtyBuffer])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false
      }

      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
    }

    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isAnyModalOpen) {
        return
      }

      // Never override browser/system shortcuts.
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      const editableTarget = isEditableTarget(event.target)
      const isSearchInputTarget = event.target === searchInputRef.current
      const hasHighlightedProduct =
        highlightedProductIndex >= 0 && highlightedProductIndex < filteredProducts.length
      const highlightedProduct = hasHighlightedProduct ? filteredProducts[highlightedProductIndex] : null
      const hasHighlightedCartItem =
        highlightedCartIndex >= 0 && highlightedCartIndex < cart.length
      const highlightedItem = hasHighlightedCartItem ? cart[highlightedCartIndex] : null

      if ((!editableTarget || isSearchInputTarget) && isSearchActive && filteredProducts.length > 0 && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        setIsProductKeyboardMode(true)
        setProductQtyBuffer('')
        setHighlightedProductIndex((prev) => {
          if (prev < 0) {
            return 0
          }

          if (event.key === 'ArrowUp') {
            return prev === 0 ? filteredProducts.length - 1 : prev - 1
          }

          return prev === filteredProducts.length - 1 ? 0 : prev + 1
        })
        return
      }

      if ((!editableTarget || isSearchInputTarget) && highlightedProduct && isSearchActive && isProductKeyboardMode && /^\d$/.test(event.key)) {
        event.preventDefault()
        setProductQtyBuffer((prev) => `${prev}${event.key}`.slice(0, 6))
        return
      }

      if ((!editableTarget || isSearchInputTarget) && highlightedProduct && isSearchActive && event.key === 'Enter') {
        event.preventDefault()
        const parsedQty = parseInt(isProductKeyboardMode ? productQtyBuffer : '', 10)
        const qtyToAdd = !Number.isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1
        addToCart(highlightedProduct, qtyToAdd)
        return
      }

      if (!editableTarget && cart.length > 0 && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault()
        setCartQtyBuffer('')
        setHighlightedCartIndex((prev) => {
          if (prev < 0) {
            return 0
          }

          if (event.key === 'ArrowUp') {
            return prev === 0 ? cart.length - 1 : prev - 1
          }

          return prev === cart.length - 1 ? 0 : prev + 1
        })
        return
      }

      if (!editableTarget && highlightedItem && (event.key === '+' || event.key === '=')) {
        event.preventDefault()
        setCartQtyBuffer('')
        updateQty(highlightedItem.productId, highlightedItem.qty + 1)
        return
      }

      if (!editableTarget && highlightedItem && event.key === '-') {
        event.preventDefault()
        setCartQtyBuffer('')
        updateQty(highlightedItem.productId, highlightedItem.qty - 1)
        return
      }

      if (!editableTarget && highlightedItem && (event.key === 'Delete' || event.key === 'Backspace')) {
        // Prevent browser back only when backspace/delete is used for cart removal.
        event.preventDefault()
        setCartQtyBuffer('')
        removeFromCart(highlightedItem.productId)
        return
      }

      if (!editableTarget && highlightedItem && !isSearchActive && /^\d$/.test(event.key)) {
        event.preventDefault()
        setCartQtyBuffer((prev) => `${prev}${event.key}`.slice(0, 6))
        return
      }

      if (!editableTarget && highlightedItem && event.key === 'Enter' && cartQtyBuffer.length > 0) {
        event.preventDefault()
        const parsedQty = parseInt(cartQtyBuffer, 10)
        setCartQtyBuffer('')
        if (!Number.isNaN(parsedQty) && parsedQty > 0) {
          updateQty(highlightedItem.productId, parsedQty)
        }
        return
      }

      if (!editableTarget && event.key.length === 1) {
        event.preventDefault()
        setIsProductKeyboardMode(false)
        setProductQtyBuffer('')
        searchInputRef.current?.focus()
        setSearch((prev) => prev + event.key)
        return
      }

      if ((!editableTarget || isSearchInputTarget) && event.key === 'Enter' && isSearchActive && filteredProducts.length > 0) {
        event.preventDefault()
        addToCart(filteredProducts[0])
        return
      }

      if (event.key === 'Escape' && isSearchActive) {
        setIsProductKeyboardMode(false)
        setProductQtyBuffer('')
        setSearch('')
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [
    isAnyModalOpen,
    isSearchActive,
    filteredProducts,
    highlightedProductIndex,
    productQtyBuffer,
    isProductKeyboardMode,
    highlightedCartIndex,
    cart,
    cartQtyBuffer,
  ])

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
        terminalId,
        offlineOpId: generateOfflineOpId(),
        receiptPublicId: generateReceiptPublicId(terminalId),
        clientCreatedAt: new Date().toISOString(),
        syncState: networkMonitor.isConnected() ? 'online_created' : 'offline_pending',
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
      const isQueuedOffline = Boolean(response.data?.queued)
      const saleId = isQueuedOffline ? saleData.receiptPublicId : response.data.id

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

      if (isQueuedOffline) {
        setCompletedSale({
          id: saleData.receiptPublicId,
          totalCents,
          discountCents: totalDiscountCents,
          taxCents,
          itemCount: cart.reduce((sum, item) => sum + item.qty, 0),
          paymentMethods: payments.map((p) => p.method),
        })
        setLastSaleId(null)
      } else {
        setCompletedSale(response.data)
        setLastSaleId(saleId)
      }
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
    <div className="min-h-screen bg-background p-3 sm:p-4 lg:p-5">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] gap-4 h-full">
      {/* Products Panel */}
      <div className="flex flex-col gap-4 min-h-[60vh]">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Search Products</h2>
          <Input
            ref={searchInputRef}
            placeholder="Scan barcode or search SKU/name..."
            value={search}
            onChange={(e) => {
              setIsProductKeyboardMode(false)
              setProductQtyBuffer('')
              setSearch(e.target.value)
            }}
            autoFocus
            className="text-lg h-12"
          />
        </div>

        {/* Quick Product List */}
        <div className="relative flex-1 overflow-y-auto rounded-lg border border-border bg-card min-h-[420px]">
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center px-4 transition-opacity duration-300 ${
              isSearchActive ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
            aria-hidden={isSearchActive}
          >
            <div className="w-full max-w-xl rounded-xl border border-border bg-background/95 backdrop-blur-sm p-5 shadow-sm">
              <div className="flex items-center gap-2 text-base font-semibold mb-3">
                <Keyboard className="h-4 w-4" />
                Checkout Shortcuts
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div><span className="font-medium text-foreground">Type</span> Focus search + append text</div>
                <div><span className="font-medium text-foreground">Arrow Up/Down</span> Highlight result (selection mode)</div>
                <div><span className="font-medium text-foreground">0-9 + Enter</span> Set qty and add highlighted result</div>
                <div><span className="font-medium text-foreground">Escape</span> Clear search</div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Start typing a SKU, barcode, or product name to hide this overlay and show matching products.
              </p>
            </div>
          </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 p-3 sm:p-4">
              {filteredProducts.map((product, index) => {
                const isHighlightedProduct = index === highlightedProductIndex
                const highlightedQty = productQtyBuffer.length > 0 ? productQtyBuffer : '1'

                return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  onMouseEnter={() => {
                    setHighlightedProductIndex(index)
                    setIsProductKeyboardMode(true)
                  }}
                  onFocus={() => {
                    setHighlightedProductIndex(index)
                    setIsProductKeyboardMode(true)
                  }}
                  className={`min-h-24 p-3 rounded-lg border hover:bg-accent/20 active:scale-[0.99] transition-all text-left ${
                    isHighlightedProduct ? 'border-accent bg-accent/10 ring-1 ring-accent/50' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{product.name}</div>
                    {isHighlightedProduct && isSearchActive && isProductKeyboardMode && (
                      <span className="text-[11px] leading-none rounded bg-accent/15 text-accent px-2 py-1">
                        Qty {highlightedQty} + Enter
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{product.sku}</div>
                  <div className="text-lg font-bold text-accent">
                    ${(product.priceCents / 100).toFixed(2)}
                  </div>
                </button>
              )})}
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
                {cart.map((item, index) => {
                  const isHighlighted = index === highlightedCartIndex

                  return (
                  <div
                    key={item.productId}
                    className={`p-3 rounded-lg border transition-colors ${
                      isHighlighted ? 'border-accent bg-accent/10 ring-1 ring-accent/50' : 'border-border'
                    }`}
                    onClick={() => {
                      setHighlightedCartIndex(index)
                      setCartQtyBuffer('')
                    }}
                  >
                    <div className="font-semibold text-sm">{item.name}</div>
                    {isHighlighted && cartQtyBuffer.length > 0 && (
                      <div className="text-xs text-accent mt-1">Qty input: {cartQtyBuffer}</div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="text-sm text-muted-foreground">
                        ${(item.unitPrice / 100).toFixed(2)} × {item.qty}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="h-11 min-w-11 rounded-md inline-flex items-center justify-center text-red-600 hover:text-red-800 hover:bg-muted"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => updateQty(item.productId, item.qty - 1)}
                        className="h-11 flex-1 text-sm border rounded hover:bg-muted inline-flex items-center justify-center"
                        aria-label={`Decrease quantity for ${item.name}`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateQty(item.productId, parseInt(e.target.value) || 1)}
                        className="h-11 min-w-[72px] flex-1 text-center text-sm border rounded"
                        aria-label={`Quantity for ${item.name}`}
                      />
                      <button
                        onClick={() => updateQty(item.productId, item.qty + 1)}
                        className="h-11 flex-1 text-sm border rounded hover:bg-muted inline-flex items-center justify-center"
                        aria-label={`Increase quantity for ${item.name}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-right font-semibold text-sm mt-2">
                      ${((item.qty * item.unitPrice) / 100).toFixed(2)}
                    </div>
                  </div>
                )})}
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
                size="default"
                variant="outline"
                disabled={!loyaltyNumber || isLoyaltyLoading}
                className="h-12 min-w-12"
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
                        className="h-11 min-w-11 rounded-md inline-flex items-center justify-center text-red-600 hover:text-red-800 hover:bg-background"
                        aria-label={`Remove discount ${discount.reason}`}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDiscountModalOpen(true)}
                disabled={cart.length === 0 || isProcessing}
                className="h-12"
              >
                Discount
              </Button>
              <Button
                variant="outline"
                onClick={() => setCart([])}
                disabled={cart.length === 0 || isProcessing}
                className="h-12"
              >
                Clear
              </Button>
              <Button
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={cart.length === 0 || isProcessing}
                className="gap-2 h-12"
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
                size="default"
                className="w-full text-red-600 h-12"
              >
                Void Last Sale
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

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
