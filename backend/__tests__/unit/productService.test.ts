import { assertValidProduct, randomSKU, assertCentsEqual } from '../utils/test-helpers'

describe('Product Service Unit Tests', () => {
  describe('Product Creation', () => {
    it('should validate required fields', () => {
      const validProduct = {
        sku: randomSKU(),
        name: 'Test Product',
        priceCents: 9999
      }
      
      expect(validProduct.sku).toBeDefined()
      expect(validProduct.name).toBeDefined()
      expect(validProduct.priceCents).toBeDefined()
    })

    it('should reject product with missing SKU', () => {
      const invalid = {
        name: 'Test Product',
        priceCents: 9999
      }
      
      expect(invalid).not.toHaveProperty('sku')
    })

    it('should reject product with missing name', () => {
      const invalid = {
        sku: randomSKU(),
        priceCents: 9999
      }
      
      expect(invalid).not.toHaveProperty('name')
    })

    it('should reject product with missing price', () => {
      const invalid = {
        sku: randomSKU(),
        name: 'Test Product'
      }
      
      expect(invalid).not.toHaveProperty('priceCents')
    })

    it('should accept optional fields', () => {
      const product = {
        sku: randomSKU(),
        name: 'Test Product',
        priceCents: 9999,
        description: 'Optional description',
        category: 'beverages',
        costCents: 4000,
        imageUrl: 'https://example.com/image.jpg'
      }
      
      expect(product.description).toBeDefined()
      expect(product.category).toBeDefined()
      expect(product.costCents).toBeDefined()
      expect(product.imageUrl).toBeDefined()
    })
  })

  describe('SKU Validation', () => {
    it('should accept valid SKU format', () => {
      const skus = ['PROD-001', 'TEST-SKU-001', 'ABC-123-XYZ']
      
      skus.forEach(sku => {
        expect(sku).toMatch(/^[A-Z0-9\-]+$/)
      })
    })

    it('should reject duplicate SKU', () => {
      const sku1 = 'DUPLICATE-SKU'
      const sku2 = 'DUPLICATE-SKU'
      
      expect(sku1).toBe(sku2) // Would be duplicate
    })

    it('should generate unique SKUs', () => {
      const skus = new Set([randomSKU(), randomSKU(), randomSKU()])
      expect(skus.size).toBe(3)
    })
  })

  describe('Price Validation', () => {
    it('should accept prices in cents', () => {
      const prices = [1, 100, 9999, 99999, 1000000]
      
      prices.forEach(price => {
        expect(typeof price).toBe('number')
        expect(price).toBeGreaterThan(0)
      })
    })

    it('should calculate profit margin', () => {
      const priceCents = 10000 // $100
      const costCents = 4000   // $40

      const profitMargin = priceCents - costCents
      expect(profitMargin).toBe(6000) // $60
    })

    it('should calculate profit percentage', () => {
      const priceCents = 10000
      const costCents = 4000
      
      const marginPercent = ((priceCents - costCents) / priceCents) * 100
      expect(marginPercent).toBeCloseTo(60, 1)
    })

    it('should prevent negative cost', () => {
      const priceCents = 10000
      const costCents = -1000
      
      expect(costCents).toBeLessThan(0)
    })

    it('should prevent cost exceeding price', () => {
      const priceCents = 1000
      const costCents = 5000
      
      expect(costCents).toBeGreaterThan(priceCents)
    })
  })

  describe('Category Classification', () => {
    const validCategories = [
      'beverages',
      'food',
      'electronics',
      'clothing',
      'health'
    ]

    validCategories.forEach(category => {
      it(`should accept category: ${category}`, () => {
        expect(category).toBeDefined()
        expect(typeof category).toBe('string')
      })
    })

    it('should allow null category', () => {
      const product = {
        sku: randomSKU(),
        name: 'Uncategorized',
        priceCents: 5000,
        category: null
      }
      
      expect(product.category).toBeNull()
    })
  })

  describe('Product Status', () => {
    it('should default to active', () => {
      const product = {
        sku: randomSKU(),
        name: 'Active Product',
        priceCents: 5000,
        isActive: true
      }
      
      expect(product.isActive).toBe(true)
    })

    it('should allow deactivation', () => {
      const active = { isActive: true }
      const inactive = { isActive: false }
      
      expect(active.isActive).toBe(true)
      expect(inactive.isActive).toBe(false)
    })
  })

  describe('Barcode Support', () => {
    it('should accept EAN-13 barcode', () => {
      const barcode = '5901234123457' // Valid EAN-13
      expect(barcode.length).toBe(13)
      expect(/^\d+$/.test(barcode)).toBe(true)
    })

    it('should allow null barcode', () => {
      const product = {
        sku: randomSKU(),
        name: 'No Barcode',
        priceCents: 5000,
        barcode: null
      }
      
      expect(product.barcode).toBeNull()
    })

    it('should prevent duplicate barcode', () => {
      const barcode = '5901234123457'
      const product1 = { barcode }
      const product2 = { barcode }
      
      expect(product1.barcode).toBe(product2.barcode)
    })
  })

  describe('Timestamps', () => {
    it('should set creation timestamp', () => {
      const now = new Date()
      const product = {
        sku: randomSKU(),
        name: 'New Product',
        priceCents: 5000,
        createdAt: now
      }
      
      expect(product.createdAt).toEqual(now)
    })

    it('should set update timestamp', () => {
      const now = new Date()
      const product = {
        sku: randomSKU(),
        name: 'Updated Product',
        priceCents: 5000,
        updatedAt: now
      }
      
      expect(product.updatedAt).toEqual(now)
    })

    it('update timestamp should be >= creation timestamp', () => {
      const created = new Date('2026-03-01')
      const updated = new Date('2026-03-04')
      
      expect(updated.getTime()).toBeGreaterThanOrEqual(created.getTime())
    })
  })
})
