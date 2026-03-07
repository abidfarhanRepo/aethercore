import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { logger } from '../../src/utils/logger'

const prisma = new PrismaClient()

// Sample test data
export const testUsers = {
  admin: {
    email: 'admin@test.local',
    password: 'AdminTest123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN' as const
  },
  manager: {
    email: 'manager@test.local',
    password: 'ManagerTest123!',
    firstName: 'Manager',
    lastName: 'User',
    role: 'MANAGER' as const
  },
  cashier: {
    email: 'cashier@test.local',
    password: 'CashierTest123!',
    firstName: 'Cashier',
    lastName: 'User',
    role: 'CASHIER' as const
  },
  stockClerk: {
    email: 'stock@test.local',
    password: 'StockTest123!',
    firstName: 'Stock',
    lastName: 'Clerk',
    role: 'STOCK_CLERK' as const
  }
}

export const testProducts = [
  {
    sku: 'TEST-PROD-001',
    name: 'Test Product 1',
    description: 'First test product',
    category: 'beverages',
    priceCents: 9999,
    costCents: 4000
  },
  {
    sku: 'TEST-PROD-002',
    name: 'Test Product 2',
    description: 'Second test product',
    category: 'food',
    priceCents: 14999,
    costCents: 6000
  },
  {
    sku: 'TEST-PROD-003',
    name: 'Test Product 3',
    description: 'Third test product',
    category: 'beverages',
    priceCents: 5999,
    costCents: 2500
  }
]

export const testWarehouse = {
  name: 'Test Warehouse',
  location: 'Test Location',
  address: '123 Test St'
}

export const testCustomer = {
  email: 'customer@test.local',
  firstName: 'Test',
  lastName: 'Customer',
  phone: '555-1234',
  segment: 'STANDARD'
}

/**
 * Create test user in database
 */
export async function createTestUser(userData: {
  email: string
  password: string
  firstName: string
  lastName: string
  role: any
}) {
  const hashedPassword = await bcrypt.hash(userData.password, 10)
  
  return prisma.user.create({
    data: {
      email: userData.email,
      password: hashedPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      isActive: true
    }
  })
}

/**
 * Create test product in database
 */
export async function createTestProduct(productData: any) {
  return prisma.product.create({
    data: {
      sku: productData.sku,
      name: productData.name,
      description: productData.description,
      category: productData.category,
      priceCents: productData.priceCents,
      costCents: productData.costCents,
      profitMarginCents: productData.priceCents - productData.costCents,
      isActive: true
    }
  })
}

/**
 * Create test warehouse in database
 */
export async function createTestWarehouse(warehouseData: any) {
  return prisma.warehouse.create({
    data: {
      name: warehouseData.name,
      location: warehouseData.location,
      address: warehouseData.address,
      isActive: true
    }
  })
}

/**
 * Create test inventory location
 */
export async function createTestInventoryLocation(
  productId: string,
  warehouseId: string,
  qty: number = 100
) {
  return prisma.inventoryLocation.create({
    data: {
      productId,
      warehouseId,
      qty,
      minThreshold: 10,
      maxThreshold: 1000,
      reorderPoint: 50
    }
  })
}

/**
 * Create test customer
 */
export async function createTestCustomer(customerData: any) {
  return prisma.customer.create({
    data: {
      email: customerData.email,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      phone: customerData.phone,
      segment: customerData.segment,
      isActive: true
    }
  })
}

/**
 * Setup common test fixtures
 * Returns objects for use in tests
 */
export async function setupTestFixtures() {
  // Create users
  const admin = await createTestUser(testUsers.admin)
  const manager = await createTestUser(testUsers.manager)
  const cashier = await createTestUser(testUsers.cashier)
  const stockClerk = await createTestUser(testUsers.stockClerk)

  // Create products
  const product1 = await createTestProduct(testProducts[0])
  const product2 = await createTestProduct(testProducts[1])
  const product3 = await createTestProduct(testProducts[2])

  // Create warehouse
  const warehouse = await createTestWarehouse(testWarehouse)

  // Create inventory locations
  const inv1 = await createTestInventoryLocation(product1.id, warehouse.id, 100)
  const inv2 = await createTestInventoryLocation(product2.id, warehouse.id, 50)
  const inv3 = await createTestInventoryLocation(product3.id, warehouse.id, 200)

  // Create customer
  const customer = await createTestCustomer(testCustomer)

  return {
    users: { admin, manager, cashier, stockClerk },
    products: { product1, product2, product3 },
    warehouse,
    inventoryLocations: { inv1, inv2, inv3 },
    customer
  }
}

/**
 * Cleanup test fixtures
 */
export async function cleanupTestFixtures() {
  try {
    // Delete in dependency order
    await prisma.sale.deleteMany({})
    await prisma.customer.deleteMany({})
    await prisma.inventoryLocation.deleteMany({})
    await prisma.inventoryTransaction.deleteMany({})
    await prisma.product.deleteMany({})
    await prisma.warehouse.deleteMany({})
    await prisma.user.deleteMany({})
  } catch (error) {
    logger.error({ error }, 'Cleanup error')
  }
}
