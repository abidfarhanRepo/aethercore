import Fastify from 'fastify'
import salesRoutes from '../../src/routes/sales'
import { prisma } from '../../src/utils/db'

const TEST_SKU = 'HOLD-TEST-001'
const TEST_WAREHOUSE_NAME = 'Hold Test Warehouse'
const TEST_USER_EMAIL = 'hold-test-cashier@aether.local'

async function cleanupHoldTestData() {
  await prisma.inventoryHold.deleteMany({
    where: {
      product: {
        sku: TEST_SKU,
      },
    },
  })

  await prisma.inventoryTransaction.deleteMany({
    where: {
      product: {
        sku: TEST_SKU,
      },
    },
  })

  await prisma.sale.deleteMany({
    where: {
      receiptPublicId: {
        startsWith: 'HOLD-RACE-',
      },
    },
  })

  await prisma.inventoryLocation.deleteMany({
    where: {
      product: {
        sku: TEST_SKU,
      },
    },
  })

  await prisma.product.deleteMany({
    where: {
      sku: TEST_SKU,
    },
  })

  await prisma.warehouse.deleteMany({
    where: {
      name: TEST_WAREHOUSE_NAME,
    },
  })

  await prisma.user.deleteMany({
    where: {
      email: TEST_USER_EMAIL,
    },
  })
}

describe('Inventory hold reservation integration', () => {
  let app: ReturnType<typeof Fastify>
  let productId: string

  beforeAll(async () => {
    await cleanupHoldTestData()

    const user = await prisma.user.create({
      data: {
        email: TEST_USER_EMAIL,
        password: 'not-used-in-test',
        role: 'CASHIER',
      },
    })

    const warehouse = await prisma.warehouse.create({
      data: {
        name: TEST_WAREHOUSE_NAME,
        location: 'Test Location',
      },
    })

    const product = await prisma.product.create({
      data: {
        sku: TEST_SKU,
        name: 'Hold Test Product',
        category: 'test',
        priceCents: 1000,
      },
    })

    await prisma.inventoryLocation.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        qty: 1,
      },
    })

    productId = product.id

    app = Fastify()
    await app.register(salesRoutes)
    await app.ready()

    expect(user.id).toBeDefined()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    await cleanupHoldTestData()
    await prisma.$disconnect()
  })

  it('allows only one of two concurrent sale requests for the last unit', async () => {
    const payload = {
      items: [
        {
          productId,
          qty: 1,
          unitPrice: 1000,
        },
      ],
      paymentMethod: 'CASH',
    }

    const [first, second] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/sales',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'hold-race-1',
        },
        payload: {
          ...payload,
          receiptPublicId: 'HOLD-RACE-1',
          sessionId: 'hold-session-race',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/sales',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'hold-race-2',
        },
        payload: {
          ...payload,
          receiptPublicId: 'HOLD-RACE-2',
          sessionId: 'hold-session-race',
        },
      }),
    ])

    const statuses = [first.statusCode, second.statusCode].sort((a, b) => a - b)
    expect(statuses).toEqual([201, 409])

    const saleTransactions = await prisma.inventoryTransaction.count({
      where: {
        productId,
        type: 'SALE',
      },
    })

    expect(saleTransactions).toBe(1)

    const activeHolds = await prisma.inventoryHold.count({
      where: {
        productId,
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    expect(activeHolds).toBe(0)
  })
})
