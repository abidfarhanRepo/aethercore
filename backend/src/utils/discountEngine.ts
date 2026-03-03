// Discount calculation engine for POS system

export interface DiscountInput {
  reason: string // COUPON, LOYALTY, BULK, PERCENTAGE, FIXED, LOYALTY_POINTS, EMPLOYEE
  type: 'FIXED_AMOUNT' | 'PERCENTAGE'
  amountCents?: number
  percentage?: number
  description?: string
}

export interface DiscountResult {
  amountCents: number
  percentage: number
  reason: string
  type: string
  description?: string
}

export interface LineDiscount {
  itemId: string
  discountCents: number
}

/**
 * Calculate discount on a subtotal
 */
export function calculateDiscount(
  subtotalCents: number,
  discount: DiscountInput
): DiscountResult {
  let amountCents = 0
  let percentage = 0

  if (discount.type === 'FIXED_AMOUNT') {
    amountCents = Math.min(discount.amountCents || 0, subtotalCents)
  } else if (discount.type === 'PERCENTAGE') {
    percentage = Math.min(discount.percentage || 0, 100)
    amountCents = Math.floor((subtotalCents * percentage) / 100)
  }

  return {
    amountCents,
    percentage,
    reason: discount.reason,
    type: discount.type,
    description: discount.description,
  }
}

/**
 * Apply bulk discount based on quantity thresholds
 * Example: Buy 10+ items get 5% off
 */
export function calculateBulkDiscount(
  totalQty: number,
  subtotalCents: number,
  tiers: Array<{ minQty: number; discountPercent: number }>
): DiscountResult | null {
  const tier = tiers
    .sort((a, b) => b.minQty - a.minQty)
    .find(t => totalQty >= t.minQty)

  if (!tier) return null

  const amountCents = Math.floor((subtotalCents * tier.discountPercent) / 100)
  return {
    amountCents,
    percentage: tier.discountPercent,
    reason: 'BULK',
    type: 'PERCENTAGE',
    description: `Bulk discount: ${tier.minQty}+ items @ ${tier.discountPercent}% off`,
  }
}

/**
 * Apply loyalty program discount
 */
export function calculateLoyaltyDiscount(
  subtotalCents: number,
  loyaltyPoints: number,
  pointValue: number = 100 // 100 points = $1
): DiscountResult | null {
  if (loyaltyPoints < 100) return null

  const pointsToUse = Math.floor(loyaltyPoints / 100) * 100
  const discountCents = (pointsToUse / 100) * pointValue

  return {
    amountCents: discountCents,
    percentage: Math.floor((discountCents / subtotalCents) * 100),
    reason: 'LOYALTY',
    type: 'FIXED_AMOUNT',
    description: `Loyalty discount: ${pointsToUse} points = $${(discountCents / 100).toFixed(2)}`,
  }
}

/**
 * Validate and apply multiple discounts (prevent stacking beyond reasonable limits)
 */
export function validateDiscoundApplication(
  subtotalCents: number,
  discounts: DiscountResult[]
): boolean {
  const totalDiscount = discounts.reduce((sum, d) => sum + d.amountCents, 0)
  // Prevent discounts exceeding 50% of subtotal
  return totalDiscount <= Math.floor(subtotalCents * 0.5)
}

/**
 * Calculate per-item discount distribution
 */
export function distributeDiscountToItems(
  items: Array<{ id: string; qty: number; unitPrice: number }>,
  totalDiscountCents: number
): LineDiscount[] {
  if (items.length === 0 || totalDiscountCents === 0) {
    return items.map(item => ({ itemId: item.id, discountCents: 0 }))
  }

  const totalValue = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
  if (totalValue === 0) {
    return items.map(item => ({ itemId: item.id, discountCents: 0 }))
  }

  // Distribute discount proportionally based on item value
  return items.map(item => {
    const itemValue = item.qty * item.unitPrice
    const itemDiscount = Math.floor((itemValue / totalValue) * totalDiscountCents)
    return { itemId: item.id, discountCents: itemDiscount }
  })
}

/**
 * Check if coupon code is valid (placeholder for coupon service)
 */
export function validateCouponCode(
  code: string,
  subtotalCents: number
): DiscountResult | null {
  // This would typically validate against a coupon database
  // For now, returning null to indicate invalid
  // In real implementation, query database or external service
  return null
}

/**
 * Calculate customer segment-based discount
 */
export function calculateSegmentDiscount(
  segment: string | null | undefined,
  subtotalCents: number
): DiscountResult | null {
  const discountMap: Record<string, number> = {
    VIP: 10,
    WHOLESALE: 15,
    REGULAR: 0,
  }

  const discountPercent = discountMap[segment || 'REGULAR'] || 0
  if (discountPercent === 0) return null

  const amountCents = Math.floor((subtotalCents * discountPercent) / 100)
  return {
    amountCents,
    percentage: discountPercent,
    reason: 'LOYALTY',
    type: 'PERCENTAGE',
    description: `${segment} customer discount (${discountPercent}%)`,
  }
}
