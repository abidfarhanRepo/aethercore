import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

// Test database state tracking
const createdRecords: {
  users?: string[]
  products?: string[]
  sales?: string[]
  warehouses?: string[]
  inventoryLocations?: string[]
} = {
  users: [],
  products: [],
  sales: [],
  warehouses: [],
  inventoryLocations: []
}

/**
 * Setup test database - run before all tests
 */
export async function setupTestDatabase() {
  // Ensure test database is clean
  // In a real setup, you'd use a separate test DB
  await cleanupDatabase()
}

/**
 * Cleanup database - run after all tests
 */
export async function cleanupDatabase() {
  try {
    // Delete in dependency order
    const userIds = createdRecords.users || []
    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } }
      })
    }

    const productIds = createdRecords.products || []
    if (productIds.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: productIds } }
      })
    }

    const saleIds = createdRecords.sales || []
    if (saleIds.length > 0) {
      await prisma.sale.deleteMany({
        where: { id: { in: saleIds } }
      })
    }

    const locIds = createdRecords.inventoryLocations || []
    if (locIds.length > 0) {
      await prisma.inventoryLocation.deleteMany({
        where: { id: { in: locIds } }
      })
    }

    const whIds = createdRecords.warehouses || []
    if (whIds.length > 0) {
      await prisma.warehouse.deleteMany({
        where: { id: { in: whIds } }
      })
    }

    // Reset tracking
    createdRecords.users = []
    createdRecords.products = []
    createdRecords.sales = []
    createdRecords.warehouses = []
    createdRecords.inventoryLocations = []
  } catch (error) {
    console.error('Cleanup error:', error)
  }
}

/**
 * Track created records for cleanup
 */
function trackRecord(type: keyof typeof createdRecords, id: string) {
  if (!createdRecords[type]) {
    createdRecords[type] = []
  }
  createdRecords[type]!.push(id)
}

/**
 * Disconnect Prisma
 */
export async function disconnectDatabase() {
  await prisma.$disconnect()
}

export { prisma, trackRecord }
