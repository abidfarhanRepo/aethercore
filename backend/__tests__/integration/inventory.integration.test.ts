import Fastify from 'fastify'
import inventoryRoutes from '../../src/routes/inventory'
import { prisma } from '../../src/utils/db'

async function cleanupInventoryTestData() {
  await prisma.inventoryAdjustmentSession.deleteMany({
    where: {
      sessionName: {
        startsWith: 'INV-TEST-',
      },
    },
  })
  await prisma.inventoryTransaction.deleteMany({
    where: {
      product: {
        sku: {
          startsWith: 'INV-TEST-',
        },
      },
    },
  })
  await prisma.inventoryLocation.deleteMany({
    where: {
      product: {
        sku: {
          startsWith: 'INV-TEST-',
        },
      },
    },
  })
  await prisma.product.deleteMany({
    where: {
      sku: {
        startsWith: 'INV-TEST-',
      },
    },
  })
  await prisma.warehouse.deleteMany({
    where: {
      name: {
        startsWith: 'Inv Test',
      },
    },
  })
}

async function seedInventoryTestData() {
  const warehouse = await prisma.warehouse.create({
    data: {
      name: 'Inv Test Warehouse',
      location: 'Test Location',
      address: '123 Test St',
      isActive: true,
    },
  })

  const product1 = await prisma.product.create({
    data: {
      sku: 'INV-TEST-001',
      name: 'Inventory Test Product 1',
      description: 'Inventory test product',
      category: 'test',
      priceCents: 1000,
      costCents: 500,
      profitMarginCents: 500,
      isActive: true,
    },
  })

  const product2 = await prisma.product.create({
    data: {
      sku: 'INV-TEST-002',
      name: 'Inventory Test Product 2',
      description: 'Inventory test product',
      category: 'test',
      priceCents: 1500,
      costCents: 700,
      profitMarginCents: 800,
      isActive: true,
    },
  })

  const product3 = await prisma.product.create({
    data: {
      sku: 'INV-TEST-003',
      name: 'Inventory Test Product 3',
      description: 'Inventory test product',
      category: 'test',
      priceCents: 2500,
      costCents: 1000,
      profitMarginCents: 1500,
      isActive: true,
    },
  })

  const inv1 = await prisma.inventoryLocation.create({
    data: {
      productId: product1.id,
      warehouseId: warehouse.id,
      qty: 100,
      minThreshold: 10,
      maxThreshold: 1000,
      reorderPoint: 50,
    },
  })

  const inv2 = await prisma.inventoryLocation.create({
    data: {
      productId: product2.id,
      warehouseId: warehouse.id,
      qty: 50,
      minThreshold: 10,
      maxThreshold: 1000,
      reorderPoint: 50,
    },
  })

  const inv3 = await prisma.inventoryLocation.create({
    data: {
      productId: product3.id,
      warehouseId: warehouse.id,
      qty: 200,
      minThreshold: 10,
      maxThreshold: 1000,
      reorderPoint: 50,
    },
  })

  return {
    warehouse,
    products: { product1, product2, product3 },
    inventoryLocations: { inv1, inv2, inv3 },
  }
}

describe('Inventory Integration Tests', () => {
  let app: ReturnType<typeof Fastify>
  let fixtures: any

  beforeAll(async () => {
    await cleanupInventoryTestData()
    fixtures = await seedInventoryTestData()

    app = Fastify()
    await app.register(inventoryRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await cleanupInventoryTestData()
    await prisma.$disconnect()
  })

  it('lists inventory locations with summary', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/inventory',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(Array.isArray(body.locations)).toBe(true)
    expect(body.count).toBe(3)
    expect(body.summary.totalLocations).toBe(3)
    expect(body.summary.lowStockCount).toBe(0)
    expect(body.summary.averageQty).toBe(117)
  })

  it('gets inventory by product id', async () => {
    const productId = fixtures.products.product1.id

    const response = await app.inject({
      method: 'GET',
      url: `/api/inventory/${productId}`,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.product.id).toBe(productId)
    expect(body.totalQty).toBe(100)
    expect(body.locations.length).toBe(1)
  })

  it('returns 404 for unknown product', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/inventory/does-not-exist',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('Product not found')
  })

  it('adjusts inventory and records transaction', async () => {
    const productId = fixtures.products.product1.id
    const warehouseId = fixtures.warehouse.id

    const response = await app.inject({
      method: 'POST',
      url: '/api/inventory/adjust',
      payload: {
        productId,
        warehouseId,
        qtyDelta: -20,
        reason: 'DAMAGE',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.qtyBefore).toBe(100)
    expect(body.qtyAfter).toBe(80)

    const location = await prisma.inventoryLocation.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
    })

    expect(location?.qty).toBe(80)

    const tx = await prisma.inventoryTransaction.findFirst({
      where: {
        productId,
        warehouseId,
        type: 'ADJUSTMENT',
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(tx).toBeTruthy()
    expect(tx?.qtyBefore).toBe(100)
    expect(tx?.qtyAfter).toBe(80)
  })

  it('rejects invalid adjustment payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/inventory/adjust',
      payload: {
        qtyDelta: 10,
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('transfers stock between warehouses', async () => {
    const destination = await prisma.warehouse.create({
      data: {
        name: 'Overflow Warehouse',
        location: 'Backroom',
      },
    })

    const productId = fixtures.products.product2.id
    const fromWarehouseId = fixtures.warehouse.id
    const toWarehouseId = destination.id

    const response = await app.inject({
      method: 'POST',
      url: '/api/inventory/transfer',
      payload: {
        productId,
        fromWarehouseId,
        toWarehouseId,
        qty: 15,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.qtyTransferred).toBe(15)
    expect(body.from.qtyAfter).toBe(35)
    expect(body.to.qtyAfter).toBe(15)

    const sourceLocation = await prisma.inventoryLocation.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId: fromWarehouseId,
        },
      },
    })

    const destinationLocation = await prisma.inventoryLocation.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId: toWarehouseId,
        },
      },
    })

    expect(sourceLocation?.qty).toBe(35)
    expect(destinationLocation?.qty).toBe(15)

    const transferLogs = await prisma.inventoryTransaction.findMany({
      where: {
        type: 'TRANSFER',
        reference: body.reference,
      },
    })

    expect(transferLogs.length).toBe(2)
  })

  it('returns low stock items after large deduction', async () => {
    const productId = fixtures.products.product3.id
    const warehouseId = fixtures.warehouse.id

    await app.inject({
      method: 'POST',
      url: '/api/inventory/adjust',
      payload: {
        productId,
        warehouseId,
        qtyDelta: -195,
        reason: 'SHRINKAGE',
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/inventory/low-stock',
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.count).toBeGreaterThanOrEqual(1)
    expect(body.items.some((item: any) => item.productId === productId)).toBe(true)
  })

  it('completes recount and updates counted quantity', async () => {
    const productId = fixtures.products.product1.id
    const warehouseId = fixtures.warehouse.id

    const response = await app.inject({
      method: 'POST',
      url: '/api/inventory/recount',
      payload: {
        warehouseId,
        sessionName: 'INV-TEST-cycle-count-1',
        items: [
          {
            productId,
            countedQty: 77,
          },
        ],
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()

    expect(body.sessionId).toBeDefined()
    expect(body.totalVariance).toBe(-3)

    const location = await prisma.inventoryLocation.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
    })

    expect(location?.qty).toBe(77)
    expect(location?.lastCountedAt).toBeTruthy()

    const recountTx = await prisma.inventoryTransaction.findFirst({
      where: {
        type: 'RECOUNT',
        reference: body.sessionId,
      },
    })

    expect(recountTx).toBeTruthy()
  })

  it('initializes and lists warehouses', async () => {
    const initResponse = await app.inject({
      method: 'POST',
      url: '/api/inventory/warehouse/init',
      payload: {},
    })

    expect([200, 201]).toContain(initResponse.statusCode)

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/inventory/warehouses',
    })

    expect(listResponse.statusCode).toBe(200)
    const body = listResponse.json()
    expect(Array.isArray(body.warehouses)).toBe(true)
    expect(body.count).toBeGreaterThanOrEqual(1)
  })
})
