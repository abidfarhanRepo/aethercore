import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../utils/db'

const HOLD_TTL_MINUTES = 15

export class InventoryHoldConflictError extends Error {
  readonly code = 'HOLD_EXHAUSTED'

  constructor(message = 'Insufficient inventory available for hold') {
    super(message)
    this.name = 'InventoryHoldConflictError'
  }
}

type HoldReservationInput = {
  productId: string
  warehouseId: string
  quantity: number
  sessionId: string
  tenantId?: string
}

type HoldReservationResult = {
  holdId: string
  availableBefore: number
}

function resolveCommittedSales(sumQtyDelta: number | null | undefined): number {
  const normalized = sumQtyDelta ?? 0
  return normalized < 0 ? Math.abs(normalized) : 0
}

export async function reserveInventoryHold(
  tx: Prisma.TransactionClient,
  input: HoldReservationInput
): Promise<HoldReservationResult> {
  const tenantId = input.tenantId || 'global'
  const now = new Date()

  // Serialize concurrent reservations for the same location.
  await tx.$queryRaw`
    SELECT 1
    FROM "InventoryLocation"
    WHERE "productId" = ${input.productId}
      AND "warehouseId" = ${input.warehouseId}
    FOR UPDATE
  `

  const location = await tx.inventoryLocation.findUnique({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
    select: { qty: true },
  })

  if (!location) {
    throw new InventoryHoldConflictError('Inventory location not found for product')
  }

  const [activeHolds, committedSales] = await Promise.all([
    tx.inventoryHold.aggregate({
      _sum: { quantity: true },
      where: {
        productId: input.productId,
        tenantId,
        expiresAt: { gt: now },
      },
    }),
    tx.inventoryTransaction.aggregate({
      _sum: { qtyDelta: true },
      where: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: 'SALE',
        qtyDelta: { lt: 0 },
      },
    }),
  ])

  const availableBefore =
    location.qty -
    (activeHolds._sum.quantity ?? 0) -
    resolveCommittedSales(committedSales._sum.qtyDelta)

  if (availableBefore < input.quantity) {
    throw new InventoryHoldConflictError('Insufficient reserved inventory')
  }

  const hold = await tx.inventoryHold.create({
    data: {
      productId: input.productId,
      tenantId,
      quantity: input.quantity,
      expiresAt: new Date(now.getTime() + HOLD_TTL_MINUTES * 60 * 1000),
      sessionId: input.sessionId,
    },
    select: { id: true },
  })

  return {
    holdId: hold.id,
    availableBefore,
  }
}

export async function releaseInventoryHolds(
  tx: Prisma.TransactionClient,
  holdIds: string[]
): Promise<number> {
  if (holdIds.length === 0) {
    return 0
  }

  const released = await tx.inventoryHold.deleteMany({
    where: {
      id: { in: holdIds },
    },
  })

  return released.count
}

export async function cleanupExpiredInventoryHolds(
  db: PrismaClient = prisma
): Promise<number> {
  const result = await db.inventoryHold.deleteMany({
    where: {
      expiresAt: { lte: new Date() },
    },
  })

  return result.count
}
