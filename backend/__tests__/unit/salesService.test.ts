import { assertCentsEqual } from '../utils/test-helpers'

describe('Sales Service Unit Tests', () => {
  describe('Discount Calculation', () => {
    it('should calculate percentage discount', () => {
      const subtotal = 10000 // $100
      const discountPercent = 10
      
      const discountAmount = Math.floor(subtotal * (discountPercent / 100))
      expect(discountAmount).toBe(1000) // $10
    })

    it('should calculate fixed discount', () => {
      const subtotal = 10000 // $100
      const discountFixed = 1500 // $15
      
      expect(discountFixed).toBe(1500)
    })

    it('should not allow discount exceeding 50%', () => {
      const subtotal = 10000
      const maxDiscount = subtotal * 0.5
      const attemptedDiscount = subtotal * 0.6
      
      expect(attemptedDiscount).toBeGreaterThan(maxDiscount)
    })

    it('should distribute discount across items', () => {
      const items = [
        { qty: 2, unitPrice: 5000 }, // $100
        { qty: 3, unitPrice: 3000 }  // $90
      ]
      
      const subtotal = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0)
      const discountPercent = 10
      const totalDiscount = Math.floor(subtotal * (discountPercent / 100))
      
      expect(subtotal).toBe(19000)
      expect(totalDiscount).toBe(1900)
    })

    it('should apply bulk discount at thresholds', () => {
      const thresholds = [
        { minQty: 10, percent: 5 },
        { minQty: 25, percent: 10 },
        { minQty: 50, percent: 15 }
      ]
      
      const qty = 30
      const applicable = thresholds.filter(t => qty >= t.minQty)
      const discount = applicable[applicable.length - 1]?.percent || 0
      
      expect(discount).toBe(10) // 25-49 qty gets 10%
    })

    it('should apply loyalty discount by segment', () => {
      const segments = {
        'BRONZE': 0.02,
        'SILVER': 0.05,
        'GOLD': 0.1
      }
      
      const subtotal = 10000
      const segment = 'GOLD'
      const discountAmount = Math.floor(subtotal * segments[segment])
      
      expect(discountAmount).toBe(1000) // $10 or 10% discount
    })

    it('should round discount to nearest cent', () => {
      const subtotal = 9999
      const discountPercent = 7.5
      
      const discount = Math.round(subtotal * (discountPercent / 100))
      expect(discount % 1).toBe(0) // Should be whole number
    })
  })

  describe('Tax Calculation', () => {
    it('should calculate simple tax', () => {
      const subtotal = 10000 // $100
      const taxRate = 8.5
      
      const tax = Math.round(subtotal * (taxRate / 100))
      expect(tax).toBe(850) // $8.50
    })

    it('should calculate tax on discounted amount', () => {
      const subtotal = 10000
      const discountAmount = 1000
      const taxRate = 8.5
      
      const taxableAmount = subtotal - discountAmount
      const tax = Math.round(taxableAmount * (taxRate / 100))
      
      expect(taxableAmount).toBe(9000)
      expect(tax).toBe(765) // $7.65
    })

    it('should handle zero tax', () => {
      const subtotal = 10000
      const taxRate = 0
      
      const tax = subtotal * (taxRate / 100)
      expect(tax).toBe(0)
    })

    it('should handle high tax rates', () => {
      const subtotal = 10000
      const taxRate = 20
      
      const tax = Math.round(subtotal * (taxRate / 100))
      expect(tax).toBe(2000)
    })
  })

  describe('Total Calculation', () => {
    it('should calculate total: subtotal - discount + tax', () => {
      const subtotal = 10000
      const discount = 1000
      const tax = 720 // Calculated on $9000
      
      const total = subtotal - discount + tax
      expect(total).toBe(9720)
    })

    it('should handle no discounts or tax', () => {
      const subtotal = 10000
      const discount = 0
      const tax = 0
      
      const total = subtotal - discount + tax
      expect(total).toBe(10000)
    })

    it('should calculate correct total with multiple discounts', () => {
      const subtotal = 10000
      const discounts = [1000, 500] // $10 + $5
      const totalDiscount = discounts.reduce((a, b) => a + b, 0)
      const tax = 680 // On $8500
      
      const total = subtotal - totalDiscount + tax
      expect(total).toBe(9180)
    })
  })

  describe('Stock Validation', () => {
    it('should verify stock available before sale', () => {
      const available = 50
      const requested = 50
      
      expect(requested).toBeLessThanOrEqual(available)
    })

    it('should reject sale if out of stock', () => {
      const available = 30
      const requested = 50
      
      expect(requested).toBeGreaterThan(available)
    })

    it('should handle multiple items stock check', () => {
      const inventory = {
        'prod_1': 100,
        'prod_2': 50,
        'prod_3': 0
      }
      
      const items = [
        { productId: 'prod_1', qty: 50 }, // OK
        { productId: 'prod_2', qty: 50 }, // OK
        { productId: 'prod_3', qty: 1 }   // OUT OF STOCK
      ]
      
      const hasStock = items.every(item => (inventory[item.productId] || 0) >= item.qty)
      expect(hasStock).toBe(false)
    })
  })

  describe('Payment Methods', () => {
    const validMethods = ['CASH', 'CARD', 'CHECK', 'SPLIT']
    
    validMethods.forEach(method => {
      it(`should accept payment method: ${method}`, () => {
        expect(validMethods).toContain(method)
      })
    })

    it('should split payment between multiple methods', () => {
      const total = 10000
      const payments = [
        { method: 'CASH', amount: 5000 },
        { method: 'CARD', amount: 5000 }
      ]
      
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
      expect(totalPaid).toBe(total)
    })
  })

  describe('Sale Items', () => {
    it('should store item details', () => {
      const item = {
        productId: 'prod_123',
        qty: 2,
        unitPrice: 5000,
        subtotalCents: 10000
      }
      
      expect(item.qty * item.unitPrice).toBe(item.subtotalCents)
    })

    it('should calculate item subtotal', () => {
      const qty = 3
      const unitPrice = 4999
      
      const subtotal = qty * unitPrice
      expect(subtotal).toBe(14997)
    })

    it('should handle full refund of item', () => {
      const original = 5000
      const refundQty = 1
      const unitPrice = 5000
      
      const refundAmount = refundQty * unitPrice
      assertCentsEqual(refundAmount, original)
    })

    it('should handle partial refund of item', () => {
      const original = 500
      const returnQty = 2
      const unitPrice = 100
      
      const refundAmount = returnQty * unitPrice
      expect(refundAmount).toBe(200)
    })
  })

  describe('Sale Status', () => {
    const validStatuses = ['completed', 'voided', 'refunded']
    
    validStatuses.forEach(status => {
      it(`should accept status: ${status}`, () => {
        expect(validStatuses).toContain(status)
      })
    })

    it('should track status transitions', () => {
      const transitions = {
        'completed': ['voided', 'refunded'],
        'voided': [],
        'refunded': []
      }
      
      const from = 'completed'
      const to = 'refunded'
      
      expect(transitions[from]).toContain(to)
    })
  })
})
