import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'
import { requireAuth } from '../plugins/authMiddleware'
import { requireAllCapabilities, requireCapability } from '../middleware/capabilityMiddleware'

type LotCreateBody = {
  productId?: string
  warehouseId?: string
  batchNumber?: string
  expiryDate?: string
  qtyAvailable?: number
  costPerUnit?: number
  notes?: string
}

type LotTransferBody = {
  productId?: string
  fromLotBatchId?: string
  toLotBatchId?: string
  qty?: number
  notes?: string
}

type TablePatchBody = {
  status?: string
  notes?: string
}

type TicketPatchBody = {
  status?: string
}

type OverrideBody = {
  prescriptionId?: string
  pharmacistId?: string
  action?: string
  reason?: string
}

type StartReceivingBody = {
  startedBy?: string
}

type ReceivingDiscrepancyBody = {
  sessionId?: string
  purchaseOrderItemId?: string
  qtyExpected?: number
  qtyReceived?: number
  discrepancyReason?: string
  notes?: string
}

type CompleteReceivingBody = {
  sessionId?: string
  completedBy?: string
}

export default async function phase3Routes(fastify: FastifyInstance) {
  fastify.post<{ Body: LotCreateBody }>('/api/v1/inventory/lots', { preHandler: [requireAuth, requireAllCapabilities(['inventory.expiry', 'inventory.lot_tracking'])] }, async (req, reply) => {
    const { productId, warehouseId, batchNumber, expiryDate, qtyAvailable, costPerUnit, notes } = req.body

    if (!productId || !warehouseId || !batchNumber || !expiryDate || qtyAvailable === undefined) {
      return reply.status(400).send({ error: 'productId, warehouseId, batchNumber, expiryDate and qtyAvailable are required' })
    }

    try {
      const lot = await (prisma as any).lotBatch.create({
        data: {
          productId,
          warehouseId,
          batchNumber,
          expiryDate: new Date(expiryDate),
          qtyAvailable,
          costPerUnit,
          notes,
        },
      })

      return reply.status(201).send(lot)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to create lot', detail: err.message })
    }
  })

  fastify.get<{ Params: { productId: string } }>('/api/v1/inventory/lots/:productId', { preHandler: [requireAuth, requireAllCapabilities(['inventory.expiry', 'inventory.lot_tracking'])] }, async (req, reply) => {
    const { productId } = req.params

    try {
      const lots = await (prisma as any).lotBatch.findMany({
        where: { productId },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      })

      return { lots }
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to list lots', detail: err.message })
    }
  })

  fastify.get<{ Querystring: { thresholdDays?: string } }>('/api/v1/inventory/expiry-alerts', { preHandler: [requireAuth, requireCapability('inventory.expiry')] }, async (req, reply) => {
    const thresholdDays = Number(req.query.thresholdDays || '30')
    const now = new Date()
    const thresholdDate = new Date(now)
    thresholdDate.setDate(thresholdDate.getDate() + thresholdDays)

    try {
      const lots = await (prisma as any).lotBatch.findMany({
        where: {
          expiryDate: { lte: thresholdDate, gte: now },
          qtyAvailable: { gt: 0 },
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { expiryDate: 'asc' },
      })

      const alerts = lots.map((lot: any) => {
        const daysLeft = Math.ceil((new Date(lot.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return {
          lotId: lot.id,
          productId: lot.productId,
          productName: lot.product?.name,
          warehouseId: lot.warehouseId,
          warehouseName: lot.warehouse?.name,
          batchNumber: lot.batchNumber,
          expiryDate: lot.expiryDate,
          nearExpiryQty: lot.qtyAvailable,
          daysLeft,
        }
      })

      return { alerts, thresholdDays }
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch expiry alerts', detail: err.message })
    }
  })

  fastify.post<{ Body: LotTransferBody }>('/api/v1/inventory/transfer-lot', { preHandler: [requireAuth, requireAllCapabilities(['inventory.expiry', 'inventory.lot_tracking'])] }, async (req, reply) => {
    const { productId, fromLotBatchId, toLotBatchId, qty, notes } = req.body

    if (!productId || !fromLotBatchId || !qty || qty <= 0) {
      return reply.status(400).send({ error: 'productId, fromLotBatchId and positive qty are required' })
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const fromLot = await (tx as any).lotBatch.findUnique({ where: { id: fromLotBatchId } })
        if (!fromLot) {
          throw new Error('Source lot not found')
        }
        if (fromLot.productId !== productId) {
          throw new Error('Lot does not belong to productId')
        }
        if (fromLot.qtyAvailable < qty) {
          throw new Error('Insufficient lot quantity')
        }

        await (tx as any).lotBatch.update({
          where: { id: fromLotBatchId },
          data: { qtyAvailable: { decrement: qty } },
        })

        let targetLotId = toLotBatchId

        if (toLotBatchId) {
          await (tx as any).lotBatch.update({
            where: { id: toLotBatchId },
            data: { qtyAvailable: { increment: qty } },
          })
        } else {
          const created = await (tx as any).lotBatch.create({
            data: {
              productId: fromLot.productId,
              warehouseId: fromLot.warehouseId,
              batchNumber: `${fromLot.batchNumber}-XFER-${Date.now()}`,
              expiryDate: fromLot.expiryDate,
              qtyAvailable: qty,
              costPerUnit: fromLot.costPerUnit,
              notes: notes || 'Auto-created transfer lot',
            },
          })
          targetLotId = created.id
        }

        return { fromLotBatchId, toLotBatchId: targetLotId, qty }
      })

      return result
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to transfer lot', detail: err.message })
    }
  })

  fastify.get('/api/v1/restaurant/tables', { preHandler: [requireAuth, requireCapability('restaurant.table_service')] }, async (_req, reply) => {
    try {
      const tables = await (prisma as any).restaurantTable.findMany({ orderBy: [{ tableNumber: 'asc' }] })
      return { tables }
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch tables', detail: err.message })
    }
  })

  fastify.patch<{ Params: { id: string }; Body: TablePatchBody }>('/api/v1/restaurant/tables/:id', { preHandler: [requireAuth, requireCapability('restaurant.table_service')] }, async (req, reply) => {
    const { id } = req.params
    const { status, notes } = req.body

    try {
      const table = await (prisma as any).restaurantTable.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      })
      return table
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to update table', detail: err.message })
    }
  })

  fastify.get('/api/v1/kitchen/tickets', { preHandler: [requireAuth, requireCapability('restaurant.kds')] }, async (_req, reply) => {
    try {
      const tickets = await (prisma as any).kitchenTicket.findMany({
        include: {
          table: { select: { id: true, tableNumber: true, status: true } },
          sale: { select: { id: true, status: true, createdAt: true } },
        },
        orderBy: [{ createdAt: 'asc' }],
      })
      return { tickets }
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch tickets', detail: err.message })
    }
  })

  fastify.patch<{ Params: { id: string }; Body: TicketPatchBody }>('/api/v1/kitchen/tickets/:id/status', { preHandler: [requireAuth, requireCapability('restaurant.kds')] }, async (req, reply) => {
    const { id } = req.params
    const { status } = req.body

    if (!status) {
      return reply.status(400).send({ error: 'status is required' })
    }

    try {
      const ticket = await (prisma as any).kitchenTicket.update({
        where: { id },
        data: {
          status,
          ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        },
      })
      return ticket
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to update ticket status', detail: err.message })
    }
  })

  fastify.get<{ Params: { rxNumber: string } }>('/api/v1/pharmacy/prescriptions/:rxNumber', { preHandler: [requireAuth, requireCapability('pharmacy.prescription_validation')] }, async (req, reply) => {
    const { rxNumber } = req.params

    try {
      const prescription = await (prisma as any).prescription.findUnique({
        where: { rxNumber },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          prescriber: { select: { id: true, name: true, npiNumber: true } },
          product: { select: { id: true, name: true, sku: true } },
          items: true,
        },
      })

      if (!prescription) {
        return reply.status(404).send({ error: 'Prescription not found' })
      }

      return prescription
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch prescription', detail: err.message })
    }
  })

  fastify.get('/api/v1/pharmacy/interactions', { preHandler: [requireAuth, requireCapability('pharmacy.drug_interactions')] }, async (_req, reply) => {
    try {
      const interactions = await (prisma as any).drugInteraction.findMany({
        where: { isActive: true },
        include: {
          product1: { select: { id: true, name: true, sku: true } },
          product2: { select: { id: true, name: true, sku: true } },
        },
      })

      return { interactions }
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to fetch interactions', detail: err.message })
    }
  })

  fastify.post<{ Params: { id: string } }>('/api/v1/pharmacy/prescriptions/:id/fill', { preHandler: [requireAuth, requireCapability('pharmacy.prescription_validation')] }, async (req, reply) => {
    const { id } = req.params

    try {
      const result = await prisma.$transaction(async (tx) => {
        const prescription = await (tx as any).prescription.findUnique({ where: { id } })
        if (!prescription) {
          throw new Error('Prescription not found')
        }

        const now = new Date()
        if (new Date(prescription.expiryDate) < now) {
          throw new Error('Prescription expired')
        }

        if (prescription.refillsUsed >= prescription.refillsAllowed) {
          throw new Error('No refills remaining')
        }

        const updated = await (tx as any).prescription.update({
          where: { id },
          data: {
            refillsUsed: { increment: 1 },
            status: 'FILLED',
          },
        })

        return updated
      })

      return result
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(400).send({ error: 'Failed to fill prescription', detail: err.message })
    }
  })

  fastify.post<{ Body: OverrideBody }>('/api/v1/pharmacy/overrides', { preHandler: [requireAuth, requireCapability('pharmacy.controlled_substances')] }, async (req, reply) => {
    const { prescriptionId, pharmacistId, action, reason } = req.body

    if (!prescriptionId || !pharmacistId || !action || !reason) {
      return reply.status(400).send({ error: 'prescriptionId, pharmacistId, action and reason are required' })
    }

    try {
      const override = await (prisma as any).pharmacistOverride.create({
        data: {
          prescriptionId,
          pharmacistId,
          action,
          reason,
        },
      })

      return reply.status(201).send(override)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to create override', detail: err.message })
    }
  })

  fastify.post<{ Params: { id: string }; Body: StartReceivingBody }>('/api/v1/purchases/:id/start-receiving', { preHandler: [requireAuth, requireCapability('procurement.receiving')] }, async (req, reply) => {
    const { id } = req.params
    const { startedBy } = req.body

    try {
      const session = await (prisma as any).receivingSession.create({
        data: {
          purchaseOrderId: id,
          status: 'OPEN',
          startedBy,
        },
      })

      return reply.status(201).send(session)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to start receiving session', detail: err.message })
    }
  })

  fastify.post<{ Params: { id: string }; Body: ReceivingDiscrepancyBody }>('/api/v1/purchases/:id/receiving/discrepancy', { preHandler: [requireAuth, requireCapability('procurement.receiving')] }, async (req, reply) => {
    const { id } = req.params
    const { sessionId, purchaseOrderItemId, qtyExpected, qtyReceived, discrepancyReason, notes } = req.body

    if (!sessionId || !purchaseOrderItemId || qtyExpected === undefined || qtyReceived === undefined || !discrepancyReason) {
      return reply.status(400).send({ error: 'sessionId, purchaseOrderItemId, qtyExpected, qtyReceived and discrepancyReason are required' })
    }

    try {
      const discrepancy = await (prisma as any).receivingDiscrepancy.create({
        data: {
          receivingSessionId: sessionId,
          purchaseOrderItemId,
          qtyExpected,
          qtyReceived,
          discrepancyReason,
          notes: notes || `PO ${id} discrepancy`,
        },
      })

      return reply.status(201).send(discrepancy)
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to log discrepancy', detail: err.message })
    }
  })

  fastify.post<{ Params: { id: string }; Body: CompleteReceivingBody }>('/api/v1/purchases/:id/receiving/complete', { preHandler: [requireAuth, requireCapability('procurement.receiving')] }, async (req, reply) => {
    const { id } = req.params
    const { sessionId, completedBy } = req.body

    if (!sessionId) {
      return reply.status(400).send({ error: 'sessionId is required' })
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const session = await (tx as any).receivingSession.update({
          where: { id: sessionId },
          data: {
            status: 'CLOSED',
            completedAt: new Date(),
            completedBy,
          },
        })

        await (tx as any).purchaseOrder.update({
          where: { id },
          data: { status: 'RECEIVED' },
        })

        return session
      })

      return result
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to complete receiving session', detail: err.message })
    }
  })

  fastify.get('/api/v1/purchases/discrepancies', { preHandler: [requireAuth, requireCapability('procurement.receiving')] }, async (_req, reply) => {
    try {
      const discrepancies = await (prisma as any).receivingDiscrepancy.findMany({
        include: {
          receivingSession: { select: { id: true, purchaseOrderId: true, status: true } },
          purchaseOrderItem: { select: { id: true, productId: true, qty: true, qtyReceived: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return { discrepancies }
    } catch (err: any) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Failed to list discrepancies', detail: err.message })
    }
  })
}
