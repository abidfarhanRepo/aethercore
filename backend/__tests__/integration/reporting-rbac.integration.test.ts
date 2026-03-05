import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import reportsRoutes from '../../src/routes/reports'
import reportingIntelligenceRoutes from '../../src/routes/reportingIntelligence'
import { prisma } from '../../src/utils/db'

type Role = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'CASHIER' | 'STOCK_CLERK'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_access_secret_key_for_testing_only'

function issueAccessToken(user: { id: string; email: string; role: Role }) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  )
}

describe('Reporting RBAC and intelligence integration', () => {
  const suffix = `${Date.now()}`
  const skuPrefix = `RPT-P7-${suffix}`
  const warehouseName = `RPT-P7-WH-${suffix}`
  const supplierEmail = `rpt-p7-supplier-${suffix}@test.local`

  let app: ReturnType<typeof Fastify>

  let adminUser: any
  let managerUser: any
  let supervisorUser: any
  let cashierUser: any
  let stockClerkUser: any
  let warehouse: any
  let supplier: any
  let productA: any
  let productB: any
  let cashierSaleId = ''
  let managerSaleId = ''
  let purchaseOrderId = ''
  let managerPurchaseOrderId = ''

  beforeAll(async () => {
    app = Fastify()
    await app.register(reportsRoutes)
    await app.register(reportingIntelligenceRoutes)
    await app.ready()

    const createUser = (role: Role, emailPrefix: string) =>
      prisma.user.create({
        data: {
          email: `${emailPrefix}-${suffix}@test.local`,
          password: 'test-password-hash',
          firstName: role,
          lastName: 'Phase7',
          role,
          isActive: true,
        },
      })

    ;[adminUser, managerUser, supervisorUser, cashierUser, stockClerkUser] = await Promise.all([
      createUser('ADMIN', 'admin'),
      createUser('MANAGER', 'manager'),
      createUser('SUPERVISOR', 'supervisor'),
      createUser('CASHIER', 'cashier'),
      createUser('STOCK_CLERK', 'stock'),
    ])

    warehouse = await prisma.warehouse.create({
      data: {
        name: warehouseName,
        location: 'Phase7 Test',
      },
    })

    supplier = await prisma.supplier.create({
      data: {
        name: `RPT-P7-Supplier-${suffix}`,
        email: supplierEmail,
      },
    })

    productA = await prisma.product.create({
      data: {
        sku: `${skuPrefix}-001`,
        name: 'Phase7 Product A',
        category: 'pharma-core',
        priceCents: 1500,
        costCents: 900,
        profitMarginCents: 600,
        isActive: true,
      },
    })

    productB = await prisma.product.create({
      data: {
        sku: `${skuPrefix}-002`,
        name: 'Phase7 Product B',
        category: 'grocery',
        priceCents: 2500,
        costCents: 1300,
        profitMarginCents: 1200,
        isActive: true,
      },
    })

    await prisma.inventoryLocation.createMany({
      data: [
        {
          productId: productA.id,
          warehouseId: warehouse.id,
          qty: 6,
          minThreshold: 8,
          maxThreshold: 200,
          reorderPoint: 12,
        },
        {
          productId: productB.id,
          warehouseId: warehouse.id,
          qty: 30,
          minThreshold: 5,
          maxThreshold: 200,
          reorderPoint: 15,
        },
      ],
    })

    const cashierSale = await prisma.sale.create({
      data: {
        userId: cashierUser.id,
        subtotalCents: 3000,
        totalCents: 3300,
        taxCents: 300,
        discountCents: 0,
        paymentMethod: 'CASH',
        status: 'completed',
      },
    })

    cashierSaleId = cashierSale.id

    const managerSale = await prisma.sale.create({
      data: {
        userId: managerUser.id,
        subtotalCents: 5000,
        totalCents: 5500,
        taxCents: 500,
        discountCents: 0,
        paymentMethod: 'CARD',
        status: 'completed',
      },
    })

    managerSaleId = managerSale.id

    await prisma.saleItem.createMany({
      data: [
        {
          saleId: cashierSale.id,
          productId: productA.id,
          qty: 2,
          unitPrice: 1500,
          discountCents: 0,
        },
        {
          saleId: managerSale.id,
          productId: productB.id,
          qty: 2,
          unitPrice: 2500,
          discountCents: 0,
        },
      ],
    })

    await prisma.salePayment.createMany({
      data: [
        {
          saleId: cashierSale.id,
          method: 'CASH',
          amountCents: 3300,
        },
        {
          saleId: managerSale.id,
          method: 'CARD',
          amountCents: 5500,
        },
      ],
    })

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: `RPT-P7-PO-${suffix}`,
        userId: stockClerkUser.id,
        supplierId: supplier.id,
        totalCents: 24000,
        status: 'RECEIVED',
      },
    })

    purchaseOrderId = po.id

    const managerPo = await prisma.purchaseOrder.create({
      data: {
        poNumber: `RPT-P7-PO-MGR-${suffix}`,
        userId: managerUser.id,
        supplierId: supplier.id,
        totalCents: 11000,
        status: 'CONFIRMED',
      },
    })

    managerPurchaseOrderId = managerPo.id

    await prisma.purchaseOrderItem.create({
      data: {
        purchaseOrderId: po.id,
        productId: productA.id,
        qty: 20,
        qtyReceived: 20,
        unitPrice: 1200,
      },
    })
  })

  afterAll(async () => {
    try {
      if (app) {
        await app.close()
      }

      const userIds = [adminUser, managerUser, supervisorUser, cashierUser, stockClerkUser]
        .filter(Boolean)
        .map((user) => user.id)

      if (userIds.length > 0) {
        await prisma.permissionLog.deleteMany({
          where: {
            userId: { in: userIds },
          },
        })
      }

      await prisma.salePayment.deleteMany({
        where: {
          saleId: { in: [cashierSaleId, managerSaleId] },
        },
      })

      await prisma.saleItem.deleteMany({
        where: {
          saleId: { in: [cashierSaleId, managerSaleId] },
        },
      })

      await prisma.sale.deleteMany({
        where: {
          id: { in: [cashierSaleId, managerSaleId] },
        },
      })

      await prisma.purchaseOrderItem.deleteMany({
        where: {
          product: {
            sku: {
              startsWith: skuPrefix,
            },
          },
        },
      })

      await prisma.purchaseOrder.deleteMany({
        where: {
          poNumber: {
            in: [`RPT-P7-PO-${suffix}`, `RPT-P7-PO-MGR-${suffix}`],
          },
        },
      })

      await prisma.inventoryLocation.deleteMany({
        where: {
          product: {
            sku: {
              startsWith: skuPrefix,
            },
          },
        },
      })

      await prisma.product.deleteMany({
        where: {
          sku: {
            startsWith: skuPrefix,
          },
        },
      })

      await prisma.supplier.deleteMany({
        where: {
          email: supplierEmail,
        },
      })

      await prisma.warehouse.deleteMany({
        where: {
          name: warehouseName,
        },
      })

      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: {
            id: { in: userIds },
          },
        })
      }
    } catch {
      // Cleanup should not mask primary test failures in disconnected DB environments.
    } finally {
      await prisma.$disconnect()
    }
  })

  it('allows cashier to view only own sales in scoped visible endpoint', async () => {
    const token = issueAccessToken(cashierUser)
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/sales/visible',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.scope).toBe('OWN_SALES_ONLY')
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBeGreaterThanOrEqual(1)
    expect(body.items.every((sale: any) => sale.userId === cashierUser.id)).toBe(true)
    expect(body.items.some((sale: any) => sale.id === cashierSaleId)).toBe(true)
    expect(body.items.some((sale: any) => sale.id === managerSaleId)).toBe(false)
  })

  it('allows manager to view a visible sales detail by id', async () => {
    const token = issueAccessToken(managerUser)
    const response = await app.inject({
      method: 'GET',
      url: `/api/reports/sales/${cashierSaleId}/visible`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.scope).toBe('COMBINED_SALE')
    expect(body.sale.id).toBe(cashierSaleId)
  })

  it('denies stock clerk from sales detail endpoint', async () => {
    const token = issueAccessToken(stockClerkUser)
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/sales/visible',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(403)
  })

  it('denies cashier access to purchase recommendations intelligence', async () => {
    const token = issueAccessToken(cashierUser)
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/intelligence/purchase-recommendations',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(403)
  })

  it('denies cashier access to purchases visibility endpoint', async () => {
    const token = issueAccessToken(cashierUser)
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/purchases/visible',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(403)
  })

  it('allows manager to view combined purchases and specific purchase', async () => {
    const token = issueAccessToken(managerUser)
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/reports/purchases/visible',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(listResponse.statusCode).toBe(200)
    const listBody = listResponse.json()
    expect(listBody.scope).toBe('COMBINED_PURCHASES')
    expect(Array.isArray(listBody.items)).toBe(true)
    expect(listBody.items.some((po: any) => po.id === purchaseOrderId)).toBe(true)

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/reports/purchases/${purchaseOrderId}/visible`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(detailResponse.statusCode).toBe(200)
    const detailBody = detailResponse.json()
    expect(detailBody.scope).toBe('COMBINED_PURCHASE')
    expect(detailBody.purchase.id).toBe(purchaseOrderId)
  })

  it('restricts stock clerk to own purchase details', async () => {
    const token = issueAccessToken(stockClerkUser)
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/reports/purchases/visible',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(listResponse.statusCode).toBe(200)
    const listBody = listResponse.json()
    expect(listBody.scope).toBe('OWN_PURCHASES_ONLY')
    expect(Array.isArray(listBody.items)).toBe(true)
    expect(listBody.items.every((po: any) => po.userId === stockClerkUser.id)).toBe(true)

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/reports/purchases/${managerPurchaseOrderId}/visible`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(detailResponse.statusCode).toBe(404)
  })

  it('allows stock clerk purchase recommendations with explainability metadata', async () => {
    const token = issueAccessToken(stockClerkUser)
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/intelligence/purchase-recommendations?windowDays=30&leadTimeDays=7&serviceLevelDays=3&maxItems=10',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.scope).toBe('STOCK_CLERK')
    expect(Array.isArray(body.recommendations)).toBe(true)

    if (body.recommendations.length > 0) {
      const first = body.recommendations[0]
      expect(first.explainability).toBeDefined()
      expect(first.explainability.inputs).toBeDefined()
      expect(first.explainability.formula).toContain('recommendedQty')
      expect(typeof first.explainability.confidenceScore).toBe('number')
      expect(Array.isArray(first.explainability.confidenceReasons)).toBe(true)
    }
  })

  it('returns stock-clerk scoped KPI pack and blocks purchase export without reports.export', async () => {
    const stockToken = issueAccessToken(stockClerkUser)
    const kpiResponse = await app.inject({
      method: 'GET',
      url: '/api/reports/intelligence/kpis?vertical=pharmacy',
      headers: {
        authorization: `Bearer ${stockToken}`,
      },
    })

    expect(kpiResponse.statusCode).toBe(200)
    const kpis = kpiResponse.json()

    expect(kpis.meta.scope).toBe('STOCK_CLERK')
    expect(kpis.permissions.canViewSalesDetail).toBe(false)
    expect(kpis.permissions.canViewPurchaseIntelligence).toBe(true)
    expect(Array.isArray(kpis.kpis)).toBe(true)
    expect(kpis.kpis.every((k: any) => typeof k.formula === 'string' && k.formula.length > 0)).toBe(true)

    const supervisorToken = issueAccessToken(supervisorUser)
    const exportResponse = await app.inject({
      method: 'GET',
      url: '/api/reports/export/csv?type=sales-summary',
      headers: {
        authorization: `Bearer ${supervisorToken}`,
      },
    })

    expect(exportResponse.statusCode).toBe(403)
  })

  it('allows manager export path with reports.export permission', async () => {
    const token = issueAccessToken(managerUser)
    const response = await app.inject({
      method: 'GET',
      url: '/api/reports/export/csv?type=sales-summary',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/csv')
  })
})
