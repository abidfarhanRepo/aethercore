/**
 * Batch sync endpoint for offline-first operations
 * Handles multiple concurrent operations with conflict resolution
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/db'
import IdempotencyService from '../utils/idempotency'

interface SyncOperation {
  id: string
  type: 'POST' | 'PUT' | 'DELETE'
  endpoint: string
  data: any
}

interface SyncOperationResult {
  id: string
  success: boolean
  status?: number
  serverId?: string
  error?: string
  data?: any
}

async function syncRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/sync/batch
   * Accept and process batch of offline operations
   */
  fastify.post<{
    Body: {
      operations: SyncOperation[]
    }
  }>('/sync/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const { operations } = request.body as {
      operations: SyncOperation[]
    }

    const results: SyncOperationResult[] = []

    if (!Array.isArray(operations)) {
      return reply.status(400).send({
        error: 'Invalid request: operations must be an array',
      })
    }

    console.log(`[Sync] Processing batch with ${operations.length} operations`)

    // Process operations in sequence for transaction safety
    for (const operation of operations) {
      try {
        const result = await processSyncOperation(operation)
        results.push(result)
      } catch (error) {
        console.error(`[Sync] Failed to process operation ${operation.id}:`, error)
        results.push({
          id: operation.id,
          success: false,
          status: 500,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return reply.status(200).send({
      success: true,
      results,
      completedAt: new Date().toISOString(),
    })
  })

  /**
   * GET /api/sync/status
   * Get sync status and queue information
   */
  fastify.get('/api/sync/status', async (request: FastifyRequest, reply: FastifyReply) => {
    // Return sync status information
    return reply.status(200).send({
      status: 'ready',
      acceptsBatch: true,
      maxBatchSize: 100,
      supportedEndpoints: [
        '/api/sales',
        '/api/inventory/adjust',
        '/api/products',
        '/api/users',
      ],
    })
  })
}

/**
 * Process a single sync operation
 */
async function processSyncOperation(operation: SyncOperation): Promise<SyncOperationResult> {
  const { id, type, endpoint, data } = operation

  console.log(`[Sync] Processing ${type} ${endpoint} (${id})`)

  try {
    let result: any
    let serverId: string | undefined

    if (endpoint === '/sales' && type === 'POST') {
      result = await createSale(data)
      serverId = result.id
    } else if (endpoint === '/inventory/adjust' && type === 'POST') {
      result = await adjustInventory(data)
      serverId = result.id
    } else if (endpoint === '/products' && type === 'POST') {
      result = await createProduct(data)
      serverId = result.id
    } else if (endpoint === '/products' && type === 'PUT') {
      result = await updateProduct(data)
      serverId = result.id
    } else if (endpoint.includes('/sales/') && endpoint.includes('/refund')) {
      result = await refundSale(data)
    } else if (endpoint.includes('/sales/') && endpoint.includes('/return')) {
      result = await returnSale(data)
    } else {
      throw new Error(`Unsupported endpoint: ${endpoint}`)
    }

    return {
      id,
      success: true,
      status: 200,
      serverId,
      data: result,
    }
  } catch (error) {
    return {
      id,
      success: false,
      status: 400,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create a sale from offline data
 */
async function createSale(data: any): Promise<any> {
  const { items, subtotalCents, discountCents, taxCents, totalCents, paymentMethod, paymentStatus, notes, userId } = data

  // Get default warehouse
  let warehouse = await prisma.warehouse.findFirst()
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        name: 'Default Warehouse',
        location: 'Default',
      },
    })
  }

  // Create sale with items in transaction
  const sale = await prisma.sale.create({
    data: {
      userId: userId || '', // Will be set by middleware in real implementation
      warehouseId: warehouse.id,
      subtotalCents,
      discountCents: discountCents || 0,
      taxCents: taxCents || 0,
      totalCents,
      paymentMethod,
      paymentStatus,
      notes,
      items: {
        create: items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: item.priceCents,
          discountCents: item.discountCents || 0,
          taxCents: item.taxCents || 0,
          subtotalCents: item.subtotalCents || 0,
        })),
      },
    },
    include: {
      items: true,
    },
  })

  // Update inventory
  for (const item of items) {
    const location = await prisma.inventoryLocation.findFirst({
      where: {
        warehouseId: warehouse.id,
        productId: item.productId,
      },
    })

    if (location) {
      await prisma.inventoryLocation.update({
        where: { id: location.id },
        data: {
          qty: Math.max(0, location.qty - item.quantity),
        },
      })

      // Create transaction log
      await prisma.inventoryTransaction.create({
        data: {
          productId: item.productId,
          warehouseId: warehouse.id,
          type: 'SALE',
          qtyDelta: -item.quantity,
          reference: sale.id,
          currentQty: Math.max(0, location.qty - item.quantity),
        },
      })
    }
  }

  console.log(`[Sync] Created sale: ${sale.id}`)
  return sale
}

/**
 * Adjust inventory from offline data
 */
async function adjustInventory(data: any): Promise<any> {
  const { productId, warehouseId, quantity, type, reason, reference } = data

  // Get or create warehouse
  let warehouse = await prisma.warehouse.findFirst()
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        name: 'Default Warehouse',
        location: 'Default',
      },
    })
  }

  const targetWarehouseId = warehouseId || warehouse.id

  // Get or create inventory location
  let location = await prisma.inventoryLocation.findFirst({
    where: {
      warehouseId: targetWarehouseId,
      productId,
    },
  })

  if (!location) {
    location = await prisma.inventoryLocation.create({
      data: {
        warehouseId: targetWarehouseId,
        productId,
        qty: 0,
      },
    })
  }

  // Calculate new qty
  const newQty = Math.max(0, location.qty + quantity)

  // Update location
  const updated = await prisma.inventoryLocation.update({
    where: { id: location.id },
    data: { qty: newQty },
  })

  // Log transaction
  const txType = quantity > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'
  await prisma.inventoryTransaction.create({
    data: {
      productId,
      warehouseId: targetWarehouseId,
      type: txType,
      qtyDelta: quantity,
      reference: reference || '',
      currentQty: newQty,
      notes: reason,
    },
  })

  console.log(`[Sync] Adjusted inventory for product ${productId}: ${quantity}`)
  return updated
}

/**
 * Create product from offline data
 */
async function createProduct(data: any): Promise<any> {
  const { sku, barcode, name, description, category, priceCents, costCents } = data

  const product = await prisma.product.create({
    data: {
      sku,
      barcode,
      name,
      description,
      category,
      priceCents,
      costCents,
      profitMarginCents: priceCents - (costCents || 0),
    },
  })

  // Create default warehouse inventory location
  const warehouse = await prisma.warehouse.findFirst()
  if (warehouse) {
    await prisma.inventoryLocation.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        qty: 0,
      },
    })
  }

  console.log(`[Sync] Created product: ${product.id}`)
  return product
}

/**
 * Update product from offline data
 */
async function updateProduct(data: any): Promise<any> {
  const { id, ...updateData } = data

  // Calculate profit margin if prices provided
  if (updateData.priceCents && updateData.costCents) {
    updateData.profitMarginCents = updateData.priceCents - updateData.costCents
  }

  const product = await prisma.product.update({
    where: { id },
    data: updateData,
  })

  console.log(`[Sync] Updated product: ${product.id}`)
  return product
}

/**
 * Process refund from offline data
 */
async function refundSale(data: any): Promise<any> {
  const { saleId, items, reason } = data

  // Get sale
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true },
  })

  if (!sale) {
    throw new Error(`Sale ${saleId} not found`)
  }

  // Create return/refund record
  const refund = await prisma.return.create({
    data: {
      saleId,
      userId: sale.userId,
      items: {
        create: items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          refundReason: reason,
        })),
      },
    },
  })

  // Restore inventory
  for (const item of items) {
    const location = await prisma.inventoryLocation.findFirst({
      where: {
        warehouseId: sale.warehouseId,
        productId: item.productId,
      },
    })

    if (location) {
      await prisma.inventoryLocation.update({
        where: { id: location.id },
        data: {
          qty: location.qty + item.quantity,
        },
      })
    }
  }

  console.log(`[Sync] Created refund for sale: ${saleId}`)
  return refund
}

/**
 * Process return from offline data
 */
async function returnSale(data: any): Promise<any> {
  // Similar to refund
  return refundSale(data)
}

export default syncRoutes
