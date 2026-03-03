import request from 'supertest'
import { PrismaClient } from '@prisma/client'

const BASE_URL = 'http://localhost:4000'
const prisma = new PrismaClient()

// Helper to create test data
async function seedTestData() {
  // Create warehouse
  await prisma.warehouse.create({
    data: {
      name: 'Test Warehouse',
      location: 'Test Location',
    },
  })

  // Create user
  await prisma.user.create({
    data: {
      email: 'cashier@test.com',
      password: 'hashed',
      firstName: 'Test',
      lastName: 'Cashier',
      role: 'CASHIER',
    },
  })

  // Create customer
  await prisma.customer.create({
    data: {
      name: 'Test Customer',
      email: 'customer@test.com',
      phone: '555-1234',
      segment: 'VIP',
    },
  })

  // Create products
  const products = await prisma.product.createMany({
    data: [
      {
        sku: 'TEST-001',
        name: 'Test Product 1',
        priceCents: 1000, // $10.00
        costCents: 500,
      },
      {
        sku: 'TEST-002',
        name: 'Test Product 2',
        priceCents: 2000, // $20.00
        costCents: 1000,
      },
      {
        sku: 'TEST-003',
        name: 'Test Product 3',
        priceCents: 500, // $5.00
        costCents: 250,
      },
    ],
  })

  return products
}

async function cleanupTestData() {
  await prisma.saleReturn.deleteMany({})
  await prisma.saleDiscount.deleteMany({})
  await prisma.salePayment.deleteMany({})
  await prisma.saleItem.deleteMany({})
  await prisma.sale.deleteMany({})
  await prisma.product.deleteMany({})
  await prisma.customer.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.warehouse.deleteMany({})
}

describe('Sales - Full Workflow Tests', () => {
  beforeAll(async () => {
    await cleanupTestData()
    await seedTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  // ============ CREATE SALE TESTS ============
  describe('POST /sales - Create Sale', () => {
    test('should create a simple sale with single item and correct calculations', async () => {
      const products = await prisma.product.findMany()
      const res = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 1,
            unitPrice: 1000, // $10.00
          },
        ],
        paymentMethod: 'CASH',
      })

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.totalCents).toBe(1100) // $10 + 10% tax
      expect(res.body.taxCents).toBe(100)
      expect(res.body.itemCount).toBe(1)
    })

    test('should create a sale with multiple items', async () => {
      const products = await prisma.product.findMany()
      const res = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 2,
            unitPrice: 1000, // $20.00
          },
          {
            productId: products[1].id,
            qty: 1,
            unitPrice: 2000, // $20.00
          },
        ],
        paymentMethod: 'CASH',
      })

      expect(res.status).toBe(201)
      expect(res.body.itemCount).toBe(2)
      // Subtotal: $40, Tax: $4, Total: $44
      expect(res.body.totalCents).toBe(4400)
    })

    test('should apply percentage discount correctly', async () => {
      const products = await prisma.product.findMany()
      const res = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 1,
            unitPrice: 1000, // $10.00
          },
        ],
        discounts: [
          {
            reason: 'PROMOTIONAL',
            type: 'PERCENTAGE',
            percentage: 10,
            description: 'Holiday promo',
          },
        ],
        paymentMethod: 'CASH',
      })

      expect(res.status).toBe(201)
      expect(res.body.discountCents).toBe(100) // 10% of $10
      // Subtotal: $10, Discount: -$1, Taxable: $9, Tax: $0.90, Total: $9.90
      expect(res.body.totalCents).toBe(990)
    })

    test('should apply fixed amount discount correctly', async () => {
      const products = await prisma.product.findMany()
      const res = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 5,
            unitPrice: 1000, // $50.00
          },
        ],
        discounts: [
          {
            reason: 'COUPON',
            type: 'FIXED_AMOUNT',
            amountCents: 500, // $5.00 off
            description: 'Coupon code ABC123',
          },
        ],
        paymentMethod: 'CASH',
      })

      expect(res.status).toBe(201)
      expect(res.body.discountCents).toBe(500)
      // Subtotal: $50, Discount: -$5, Taxable: $45, Tax: $4.50, Total: $49.50
      expect(res.body.totalCents).toBe(4950)
    })

    test('should apply bulk discount (10+ items)', async () => {
      const products = await prisma.product.findMany()
      const res = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 10, // Triggers 5% bulk discount
            unitPrice: 1000,
          },
        ],
        paymentMethod: 'CASH',
      })

      expect(res.status).toBe(201)
      expect(res.body.discountCents).toBeGreaterThan(0) // Should have 5% discount
      // Subtotal: $100, Discount: -$5, Taxable: $95, Tax: $9.50, Total: $104.50
      expect(res.body.totalCents).toBe(10450)
    })

    test('should apply bulk discount (25+ items)', async () => {
      const products = await prisma.product.findMany()
      const res = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 25, // Triggers 10% bulk discount
            unitPrice: 1000,
          },
        ],
        paymentMethod: 'CASH',
      })

      expect(res.status).toBe(201)
      // Subtotal: $250, Discount (10%): -$25, Taxable: $225, Tax: $22.50, Total: $247.50
      expect(res.body.discountCents).toBe(2500)
      expect(res.body.totalCents).toBe(24750)
    })

    test('should apply VIP customer discount', async () => {
      const products = await prisma.product.findMany()
      const customer = await prisma.customer.findFirst({ where: { segment: 'VIP' } })
      
      const res = await request(BASE_URL).post('/api/sales').send({
        customerId: customer?.id,
        items: [
          {
            productId: products[0].id,
            qty: 1,
            unitPrice: 1000,
          },
        ],
        paymentMethod: 'CASH',
      })

      expect(res.status).toBe(201)
      expect(res.body.discountCents).toBe(100) // VIP gets 10% discount
      // Subtotal: $10, VIP Discount (10%): -$1, Taxable: $9, Tax: $0.90, Total: $9.90
      expect(res.body.totalCents).toBe(990)
    })

    test('should handle split payments correctly', async () => {
      const products = await prisma.product.findMany()
      const res = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 2,
            unitPrice: 1000, // $20.00
          },
        ],
        payments: [
          {
            method: 'CARD',
            amountCents: 1100, // $11
            reference: '4242',
          },
          {
            method: 'CASH',
            amountCents: 1320, // $13.20 (remaining + potential change)
          },
        ],
        paymentMethod: 'SPLIT',
      })

      expect(res.status).toBe(201)
      expect(res.body.paymentMethods).toContain('CARD')
      expect(res.body.paymentMethods).toContain('CASH')
    })

    test('should create inventory transactions on sale', async () => {
      const products = await prisma.product.findMany()
      
      const res = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 5,
            unitPrice: 1000,
          },
        ],
        paymentMethod: 'CASH',
      })

      expect(res.status).toBe(201)

      // Verify inventory transaction was created
      const transactions = await prisma.inventoryTransaction.findMany({
        where: { reference: res.body.id },
      })
      expect(transactions.length).toBeGreaterThan(0)
      expect(transactions[0].type).toBe('SALE')
      expect(transactions[0].qtyDelta).toBe(-5)
    })
  })

  // ============ GET SALES TESTS ============
  describe('GET /sales - List Sales', () => {
    test('should list all sales', async () => {
      const res = await request(BASE_URL).get('/api/sales')

      expect(res.status).toBe(200)
      expect(res.body.data).toBeDefined()
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.pagination).toBeDefined()
    })

    test('should filter by payment method', async () => {
      const res = await request(BASE_URL).get('/api/sales?paymentMethod=CASH')

      expect(res.status).toBe(200)
      res.body.data.forEach((sale: any) => {
        expect(['CASH', 'SPLIT']).toContain(sale.paymentMethod)
      })
    })

    test('should support pagination', async () => {
      const res = await request(BASE_URL).get('/api/sales?limit=2&offset=0')

      expect(res.status).toBe(200)
      expect(res.body.pagination.limit).toBe(2)
      expect(res.body.pagination.offset).toBe(0)
      expect(res.body.pagination.total).toBeDefined()
    })
  })

  // ============ GET SALE DETAILS TESTS ============
  describe('GET /sales/:id - Get Sale Details', () => {
    test('should get detailed sale information', async () => {
      const products = await prisma.product.findMany()
      
      // First create a sale
      const createRes = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 2,
            unitPrice: 1000,
          },
        ],
        discounts: [
          {
            reason: 'PROMOTIONAL',
            type: 'PERCENTAGE',
            percentage: 10,
          },
        ],
        paymentMethod: 'CASH',
      })

      const saleId = createRes.body.id

      // Then get the details
      const res = await request(BASE_URL).get(`/api/sales/${saleId}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(saleId)
      expect(res.body.items).toBeDefined()
      expect(res.body.discounts).toBeDefined()
      expect(res.body.payments).toBeDefined()
      expect(Array.isArray(res.body.items)).toBe(true)
    })

    test('should return 404 for non-existent sale', async () => {
      const res = await request(BASE_URL).get('/api/sales/INVALID-ID')

      expect(res.status).toBe(404)
    })
  })

  // ============ REFUND TESTS ============
  describe('POST /sales/:id/refund - Process Refund', () => {
    test('should process full refund', async () => {
      const products = await prisma.product.findMany()
      
      // Create a sale
      const createRes = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 2,
            unitPrice: 1000,
          },
        ],
        paymentMethod: 'CASH',
      })

      const saleId = createRes.body.id

      // Process full refund
      const refundRes = await request(BASE_URL)
        .post(`/api/sales/${saleId}/refund`)
        .send({
          type: 'full',
          reason: 'CHANGE_MIND',
        })

      expect(refundRes.status).toBe(201)
      expect(refundRes.body.type).toBe('full')
      expect(refundRes.body.refundAmountCents).toBeGreaterThan(0)
    })

    test('should process partial refund', async () => {
      const products = await prisma.product.findMany()
      
      const createRes = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 2,
            unitPrice: 1000,
          },
          {
            productId: products[1].id,
            qty: 1,
            unitPrice: 2000,
          },
        ],
        paymentMethod: 'CASH',
      })

      const saleId = createRes.body.id
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      })

      const refundRes = await request(BASE_URL)
        .post(`/api/sales/${saleId}/refund`)
        .send({
          type: 'partial',
          reason: 'DEFECTIVE',
          items: [
            {
              itemId: sale?.items[0].id,
              qty: 1, // Refund only 1 of 2
            },
          ],
        })

      expect(refundRes.status).toBe(201)
      expect(refundRes.body.type).toBe('partial')
    })
  })

  // ============ VOID SALE TESTS ============
  describe('POST /sales/:id/void - Void Sale', () => {
    test('should void a sale and restore inventory', async () => {
      const products = await prisma.product.findMany()
      
      const createRes = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 5,
            unitPrice: 1000,
          },
        ],
        paymentMethod: 'CASH',
      })

      const saleId = createRes.body.id

      const voidRes = await request(BASE_URL)
        .post(`/api/sales/${saleId}/void`)
        .send({
          reason: 'User error',
        })

      expect(voidRes.status).toBe(200)
      expect(voidRes.body.status).toBe('voided')
      expect(voidRes.body.itemsRestored).toBe(1)

      // Verify sale status updated
      const sale = await prisma.sale.findUnique({ where: { id: saleId } })
      expect(sale?.status).toBe('voided')
    })

    test('should prevent voiding already voided sale', async () => {
      const products = await prisma.product.findMany()
      
      const createRes = await request(BASE_URL).post('/api/sales').send({
        items: [
          {
            productId: products[0].id,
            qty: 1,
            unitPrice: 1000,
          },
        ],
        paymentMethod: 'CASH',
      })

      const saleId = createRes.body.id

      // Void once
      await request(BASE_URL).post(`/api/sales/${saleId}/void`).send({
        reason: 'first void',
      })

      // Try to void again
      const secondVoid = await request(BASE_URL)
        .post(`/api/sales/${saleId}/void`)
        .send({
          reason: 'second void',
        })

      expect(secondVoid.status).toBe(400)
    })
  })

  // ============ ANALYTICS TESTS ============
  describe('GET /sales/analytics/summary - Sales Analytics', () => {
    test('should return daily sales summary', async () => {
      const res = await request(BASE_URL).get(
        '/api/sales/analytics/summary?period=daily'
      )

      expect(res.status).toBe(200)
      expect(res.body.period).toBe('daily')
      expect(res.body.summary).toBeDefined()
      expect(Array.isArray(res.body.summary)).toBe(true)
      expect(res.body.totalSalesCount).toBeGreaterThan(0)
      expect(res.body.totalRevenue).toBeGreaterThan(0)
    })

    test('should return weekly sales summary', async () => {
      const res = await request(BASE_URL).get(
        '/api/sales/analytics/summary?period=weekly'
      )

      expect(res.status).toBe(200)
      expect(res.body.period).toBe('weekly')
    })

    test('should return monthly sales summary', async () => {
      const res = await request(BASE_URL).get(
        '/api/sales/analytics/summary?period=monthly'
      )

      expect(res.status).toBe(200)
      expect(res.body.period).toBe('monthly')
    })

    test('should include discount and tax data in summary', async () => {
      const res = await request(BASE_URL).get(
        '/api/sales/analytics/summary?period=daily'
      )

      expect(res.status).toBe(200)
      expect(res.body.totalDiscount).toBeDefined()
      expect(res.body.totalTax).toBeDefined()
    })
  })

  // ============ INTEGRATION TESTS ============
  describe('Integration - Complete Sale Workflow', () => {
    test('should complete full sale workflow: create -> view -> refund', async () => {
      const products = await prisma.product.findMany()
      const customer = await prisma.customer.findFirst()

      // 1. Create sale with discount
      const saleRes = await request(BASE_URL).post('/api/sales').send({
        customerId: customer?.id,
        items: [
          {
            productId: products[0].id,
            qty: 3,
            unitPrice: 1000,
          },
          {
            productId: products[1].id,
            qty: 1,
            unitPrice: 2000,
          },
        ],
        discounts: [
          {
            reason: 'PROMOTIONAL',
            type: 'PERCENTAGE',
            percentage: 5,
          },
        ],
        paymentMethod: 'CASH',
      })

      expect(saleRes.status).toBe(201)
      const saleId = saleRes.body.id

      // 2. Retrieve sale details
      const detailRes = await request(BASE_URL).get(`/api/sales/${saleId}`)

      expect(detailRes.status).toBe(200)
      expect(detailRes.body.items.length).toBe(2)
      expect(detailRes.body.discounts.length).toBeGreaterThan(0)

      // 3. Process refund
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      })

      const refundRes = await request(BASE_URL)
        .post(`/api/sales/${saleId}/refund`)
        .send({
          type: 'partial',
          reason: 'CHANGE_MIND',
          items: [
            {
              itemId: sale?.items[0].id,
              qty: 1,
            },
          ],
        })

      expect(refundRes.status).toBe(201)

      // 4. Verify customer loyalty points were added
      const updatedCustomer = await prisma.customer.findUnique({
        where: { id: customer?.id },
      })

      expect(updatedCustomer?.loyaltyPoints).toBeGreaterThanOrEqual(
        (saleRes.body.totalCents / 100) >> 0
      )
    })
  })
})
