import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'
import {
  calculateDiscount,
  calculateBulkDiscount,
  calculateLoyaltyDiscount,
  validateDiscoundApplication,
  distributeDiscountToItems,
  calculateSegmentDiscount,
  DiscountInput,
} from '../utils/discountEngine'
import {
  validatePayment,
  validateSplitPayment,
  PaymentInput,
} from '../utils/paymentEngine'

export default async function salesRoutes(fastify: FastifyInstance) {
  // ============ POST /sales - Create Sale ============
  fastify.post('/api/sales', async (req, reply) => {
    const body = req.body as any

    try {
      let actorUserId: string | undefined = body.userId

      // Prefer authenticated user when token is provided.
      try {
        await (req as any).jwtVerify()
        const authUser = (req as any).user as any
        if (authUser?.id) {
          actorUserId = authUser.id
        }
      } catch {
        // Non-authenticated/internal flows may still pass explicit body.userId.
      }

      if (!actorUserId) {
        const fallbackUser = await prisma.user.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        })
        actorUserId = fallbackUser?.id
      }

      if (!actorUserId) {
        return reply.status(400).send({
          error: 'No valid user context for sale creation',
          code: 'USER_CONTEXT_REQUIRED',
          statusCode: 400,
        })
      }

      const result = await prisma.$transaction(async (tx) => {
        // Validate all products exist and have stock
        const itemsToCreate = body.items || []
        const products = await Promise.all(
          itemsToCreate.map(async (item: any) => {
            const product = await tx.product.findUnique({ where: { id: item.productId } })
            if (!product) throw new Error(`Product ${item.productId} not found`)
            return product
          })
        )

        // Get default warehouse
        let warehouse = await tx.warehouse.findFirst()
        if (!warehouse) {
          warehouse = await tx.warehouse.create({
            data: { name: 'Default Warehouse', location: 'Default' },
          })
        }

        // Calculate subtotal
        let subtotalCents = itemsToCreate.reduce(
          (sum: number, item: any) => sum + (item.qty * item.unitPrice),
          0
        )

        // Apply discounts
        const discountsToApply: Array<any> = []
        let totalDiscountCents = 0

        // Apply segment-based discount if customer provided
        if (body.customerId) {
          const customer = await tx.customer.findUnique({ where: { id: body.customerId } })
          if (customer?.segment) {
            const segmentDiscount = calculateSegmentDiscount(customer.segment, subtotalCents)
            if (segmentDiscount) {
              discountsToApply.push({
                reason: 'LOYALTY',
                type: 'PERCENTAGE',
                amountCents: segmentDiscount.amountCents,
                percentage: segmentDiscount.percentage,
                description: segmentDiscount.description,
              })
              totalDiscountCents += segmentDiscount.amountCents
            }
          }
        }

        // Apply manual discounts if provided
        if (body.discounts && Array.isArray(body.discounts)) {
          for (const discountInput of body.discounts) {
            const discount = calculateDiscount(
              subtotalCents - totalDiscountCents,
              discountInput
            )
            discountsToApply.push(discount)
            totalDiscountCents += discount.amountCents
          }
        }

        // Apply bulk discount if applicable
        const totalQty = itemsToCreate.reduce((sum: number, item: any) => sum + item.qty, 0)
        const bulkDiscount = calculateBulkDiscount(totalQty, subtotalCents - totalDiscountCents, [
          { minQty: 10, discountPercent: 5 },
          { minQty: 25, discountPercent: 10 },
          { minQty: 50, discountPercent: 15 },
        ])
        if (bulkDiscount && !body.discounts?.some((d: any) => d.reason === 'BULK')) {
          discountsToApply.push(bulkDiscount)
          totalDiscountCents += bulkDiscount.amountCents
        }

        // Validate discount total
        if (!validateDiscoundApplication(subtotalCents, discountsToApply)) {
          throw new Error('Discounts exceed 50% of subtotal')
        }

        // Calculate tax (10% for now - would be configurable)
        const taxableCents = subtotalCents - totalDiscountCents
        const taxCents = Math.floor((taxableCents * 10) / 100)
        const totalCents = taxableCents + taxCents

        // Validate payment
        let payments: any[] = []
        if (body.payments && Array.isArray(body.payments)) {
          const paymentValidation = validateSplitPayment(body.payments, totalCents)
          if (!paymentValidation.isValid) {
            throw new Error(paymentValidation.error)
          }
          payments = body.payments
        } else {
          // Single payment method
          const singlePayment = validatePayment(
            { method: body.paymentMethod || 'CASH', amountCents: totalCents },
            totalCents
          )
          if (!singlePayment.isValid) {
            throw new Error(singlePayment.error)
          }
          payments = [{ method: body.paymentMethod || 'CASH', amountCents: totalCents }]
        }

        // Create sale
        const sale = await tx.sale.create({
          data: {
            userId: actorUserId,
            customerId: body.customerId,
            subtotalCents,
            totalCents,
            discountCents: totalDiscountCents,
            taxCents,
            paymentMethod: body.paymentMethod || 'CASH',
            status: 'completed',
            notes: body.notes,
          },
        })

        // Distribute discounts to line items
        const lineDiscounts = distributeDiscountToItems(
          itemsToCreate.map((item: any, idx: number) => ({
            id: `item-${idx}`,
            qty: item.qty,
            unitPrice: item.unitPrice,
          })),
          totalDiscountCents
        )

        // Create sale items
        for (let idx = 0; idx < itemsToCreate.length; idx++) {
          const item = itemsToCreate[idx]
          const lineDiscount = lineDiscounts[idx]?.discountCents || 0

          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              productId: item.productId,
              qty: item.qty,
              unitPrice: item.unitPrice,
              discountCents: lineDiscount,
            },
          })

          // Create inventory transaction
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              warehouseId: warehouse.id,
              qtyDelta: -item.qty,
              type: 'SALE',
              reason: 'SALE',
              createdBy: actorUserId,
              reference: sale.id,
            },
          })

          // Phase 3 FEFO support: if lot data exists, consume oldest-expiring batches first.
          const lotBatches = await (tx as any).lotBatch?.findMany?.({
            where: {
              productId: item.productId,
              warehouseId: warehouse.id,
              qtyAvailable: { gt: 0 },
            },
            orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
          })

          if (Array.isArray(lotBatches) && lotBatches.length > 0) {
            let remaining = item.qty
            for (const lot of lotBatches) {
              if (remaining <= 0) {
                break
              }
              const consume = Math.min(remaining, lot.qtyAvailable)
              if (consume > 0) {
                await (tx as any).lotBatch.update({
                  where: { id: lot.id },
                  data: { qtyAvailable: { decrement: consume } },
                })
                remaining -= consume
              }
            }
          }
        }

        // Create discount records
        for (const discount of discountsToApply) {
          await tx.saleDiscount.create({
            data: {
              saleId: sale.id,
              reason: discount.reason,
              type: discount.type,
              amountCents: discount.amountCents,
              percentage: discount.percentage || 0,
              description: discount.description,
            },
          })
        }

        // Create payment records
        for (const payment of payments) {
          await tx.salePayment.create({
            data: {
              saleId: sale.id,
              method: payment.method,
              amountCents: payment.amountCents,
              reference: payment.reference,
              notes: payment.notes,
            },
          })
        }

        // Update customer loyalty points if applicable
        if (body.customerId) {
          const pointsEarned = Math.floor(subtotalCents / 100) // 1 point per $1
          await tx.customer.update({
            where: { id: body.customerId },
            data: { loyaltyPoints: { increment: pointsEarned } },
          })
        }

        return {
          id: sale.id,
          totalCents,
          discountCents: totalDiscountCents,
          taxCents,
          itemCount: itemsToCreate.length,
          paymentMethods: payments.map(p => p.method),
        }
      })

      // Audit log
      try {
        if ((fastify as any).createAudit) {
          await (fastify as any).createAudit('sale_created', { saleId: result.id }, actorUserId)
        }
      } catch (ae: any) {
        fastify.log.warn('Failed to write audit', ae)
      }

      return reply.code(201).send(result)
    } catch (e: any) {
      fastify.log.error('Sale creation error:', e)
      
      // Differentiate error types for better debugging
      if (e.message.includes('not found')) {
        return reply.status(404).send({ 
          error: e.message, 
          code: 'PRODUCT_NOT_FOUND',
          statusCode: 404
        })
      }
      if (e.message.includes('Discounts exceed')) {
        return reply.status(422).send({ 
          error: e.message, 
          code: 'INVALID_DISCOUNT',
          statusCode: 422
        })
      }
      if (e.message.includes('Payment')) {
        return reply.status(422).send({ 
          error: e.message, 
          code: 'PAYMENT_MISMATCH',
          statusCode: 422
        })
      }
      if (e.message.includes('Foreign key constraint')) {
        return reply.status(400).send({
          error: 'Invalid user reference for sale',
          code: 'INVALID_USER_REFERENCE',
          statusCode: 400,
        })
      }
      
      // Generic validation error
      return reply.status(400).send({ 
        error: e.message || 'Failed to create sale',
        code: 'VALIDATION_ERROR',
        statusCode: 400
      })
    }
  })

  // ============ GET /sales - List Sales ============
  fastify.get(
    '/api/sales',
    async (req, reply) => {
      const query = req.query as any

      interface WhereClause {
        status?: string
        paymentMethod?: string
        customerId?: string
        createdAt?: any
      }

      const where: WhereClause = {}

      if (query.status) where.status = query.status
      if (query.paymentMethod) where.paymentMethod = query.paymentMethod
      if (query.customerId) where.customerId = query.customerId

      // Date range filtering
      if (query.startDate || query.endDate) {
        where.createdAt = {}
        if (query.startDate) {
          where.createdAt.gte = new Date(query.startDate)
        }
        if (query.endDate) {
          where.createdAt.lte = new Date(query.endDate)
        }
      }

      const limit = Math.min(parseInt(query.limit) || 50, 100)
      const offset = Math.max(parseInt(query.offset) || 0, 0)

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          include: {
            items: { include: { product: true } },
            payments: true,
            discounts: true,
            customer: true,
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.sale.count({ where }),
      ])

      return {
        data: sales,
        pagination: { limit, offset, total, hasMore: offset + limit < total },
      }
    }
  )

  // ============ GET /sales/:id - Get Sale Details ============
  fastify.get(
    '/api/sales/:id',
    async (req, reply) => {
      const { id } = req.params as any

      const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
              returns: true,
            },
          },
          payments: true,
          discounts: true,
          returns: {
            include: {
              item: { include: { product: true } },
            },
          },
          customer: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      })

      if (!sale) {
        return reply.status(404).send({ error: 'Sale not found' })
      }

      return sale
    }
  )

  // ============ POST /sales/:id/refund - Process Refund ============
  fastify.post(
    '/api/sales/:id/refund',
    async (req, reply) => {
      const { id } = req.params as any
      const body = req.body as any

      try {
        const sale = await prisma.sale.findUnique({
          where: { id },
          include: { items: true, customer: true },
        })

        if (!sale) {
          return reply.status(404).send({ error: 'Sale not found' })
        }

        let refundAmountCents = 0

        if (body.type === 'full') {
          // Full refund
          refundAmountCents = sale.totalCents
        } else if (body.type === 'partial' && body.items && Array.isArray(body.items)) {
          // Partial refund with specific items
          for (const refundItem of body.items) {
            const saleItem = sale.items.find(si => si.id === refundItem.itemId)
            if (!saleItem) {
              return reply.status(400).send({ error: `Item ${refundItem.itemId} not in sale` })
            }
            const itemTotal = (saleItem.unitPrice * refundItem.qty)
            refundAmountCents += itemTotal
          }
        } else {
          return reply.status(400).send({ error: 'Invalid refund type or items' })
        }

        // Process refund
        const refund = await prisma.$transaction(async (tx) => {
          // Update customer credit if needed
          if (sale.customerId) {
            await tx.customer.update({
              where: { id: sale.customerId },
              data: { creditBalance: { increment: refundAmountCents } },
            })
          }

          // Create return records
          const returnRecords = []
          if (body.type === 'full') {
            for (const saleItem of sale.items) {
              const returnRecord = await tx.saleReturn.create({
                data: {
                  saleId: id,
                  itemId: saleItem.id,
                  qty: saleItem.qty,
                  reason: body.reason || 'CUSTOMER_REQUEST',
                  notes: body.notes,
                  refundAmountCents: saleItem.unitPrice * saleItem.qty,
                },
              })
              returnRecords.push(returnRecord)
            }
          } else if (body.items) {
            for (const refundItem of body.items) {
              const saleItem = sale.items.find(si => si.id === refundItem.itemId)
              if (saleItem) {
                const returnRecord = await tx.saleReturn.create({
                  data: {
                    saleId: id,
                    itemId: refundItem.itemId,
                    qty: refundItem.qty,
                    reason: body.reason || 'CUSTOMER_REQUEST',
                    notes: body.notes,
                    refundAmountCents: saleItem.unitPrice * refundItem.qty,
                  },
                })
                returnRecords.push(returnRecord)
              }
            }
          }

          return {
            saleId: id,
            refundAmountCents,
            type: body.type,
            reason: body.reason,
            returnCount: returnRecords.length,
          }
        })

        // Audit
        if ((fastify as any).createAudit) {
          await (fastify as any).createAudit('sale_refunded', refund, (req as any).userId)
        }

        return reply.code(201).send(refund)
      } catch (e: any) {
        fastify.log.error(e)
        return reply.status(400).send({ error: e.message || 'Failed to process refund' })
      }
    }
  )

  // ============ POST /sales/:id/return - Process Return ============
  fastify.post(
    '/api/sales/:id/return',
    async (req, reply) => {
      const { id } = req.params as any
      const body = req.body as any

      try {
        const saleReturn = await prisma.saleReturn.create({
          data: {
            saleId: id,
            itemId: body.itemId,
            qty: body.qty,
            reason: body.reason || 'CHANGE_MIND',
            notes: body.notes,
            refundAmountCents: body.refundAmountCents || 0,
          },
        })

        // Update inventory if needed
        if (body.restockQty && body.restockQty > 0) {
          const item = await prisma.saleItem.findUnique({
            where: { id: body.itemId },
            include: { product: true },
          })

          if (item) {
            const warehouse = await prisma.warehouse.findFirst()
            if (warehouse) {
              await prisma.inventoryTransaction.create({
                data: {
                  productId: item.productId,
                  warehouseId: warehouse.id,
                  qtyDelta: body.restockQty,
                  type: 'RETURN',
                  reason: body.reason,
                  reference: saleReturn.id,
                  createdBy: (req as any).userId || 'system',
                },
              })
            }
          }
        }

        return reply.code(201).send(saleReturn)
      } catch (e: any) {
        fastify.log.error(e)
        return reply.status(400).send({ error: e.message || 'Failed to process return' })
      }
    }
  )

  // ============ POST /sales/:id/void - Void Sale ============
  fastify.post(
    '/api/sales/:id/void',
    async (req, reply) => {
      const { id } = req.params as any
      const body = req.body as any

      try {
        const sale = await prisma.sale.findUnique({
          where: { id },
          include: { items: true },
        })

        if (!sale) {
          return reply.status(404).send({ error: 'Sale not found' })
        }

        if (sale.status === 'voided') {
          return reply.status(400).send({ error: 'Sale already voided' })
        }

        await prisma.$transaction(async (tx) => {
          // Update sale status
          await tx.sale.update({
            where: { id },
            data: { status: 'voided', notes: body.reason || 'Void requested' },
          })

          // Restore inventory
          const warehouse = await tx.warehouse.findFirst()
          if (warehouse && sale.items.length > 0) {
            for (const item of sale.items) {
              await tx.inventoryTransaction.create({
                data: {
                  productId: item.productId,
                  warehouseId: warehouse.id,
                  qtyDelta: item.qty,
                  type: 'RETURN',
                  reason: 'VOID',
                  reference: id,
                  createdBy: (req as any).userId || 'system',
                },
              })
            }
          }
        })

        // Audit
        if ((fastify as any).createAudit) {
          await (fastify as any).createAudit('sale_voided', { saleId: id }, (req as any).userId)
        }

        return {
          saleId: id,
          status: 'voided',
          itemsRestored: sale.items.length,
        }
      } catch (e: any) {
        fastify.log.error(e)
        return reply.status(400).send({ error: e.message || 'Failed to void sale' })
      }
    }
  )

  // ============ GET /sales/analytics/summary - Sales Analytics ============
  fastify.get(
    '/api/sales/analytics/summary',
    async (req, reply) => {
      const query = req.query as any
      const period = query.period || 'daily' // daily, weekly, monthly

      const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const endDate = query.endDate ? new Date(query.endDate) : new Date()

      const sales = await prisma.sale.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          status: 'completed',
        },
        include: { items: true, discounts: true },
      })

      // Group by period
      const grouped: Record<string, any> = {}

      for (const sale of sales) {
        let key: string

        if (period === 'daily') {
          key = sale.createdAt.toISOString().split('T')[0]
        } else if (period === 'weekly') {
          const date = new Date(sale.createdAt)
          const weekStart = new Date(date.setDate(date.getDate() - date.getDay()))
          key = weekStart.toISOString().split('T')[0]
        } else {
          key = sale.createdAt.toISOString().substring(0, 7)
        }

        if (!grouped[key]) {
          grouped[key] = {
            date: key,
            salesCount: 0,
            totalRevenue: 0,
            totalDiscount: 0,
            totalTax: 0,
            totalItems: 0,
            avgSaleValue: 0,
          }
        }

        grouped[key].salesCount += 1
        grouped[key].totalRevenue += sale.totalCents
        grouped[key].totalDiscount += sale.discountCents
        grouped[key].totalTax += sale.taxCents
        grouped[key].totalItems += sale.items.length
      }

      // Calculate averages
      const summary = Object.values(grouped).map((g: any) => ({
        ...g,
        avgSaleValue: g.salesCount > 0 ? Math.floor(g.totalRevenue / g.salesCount) : 0,
        totalRevenue: g.totalRevenue,
        totalDiscount: g.totalDiscount,
        totalTax: g.totalTax,
      }))

      return {
        period,
        startDate,
        endDate,
        totalSalesCount: sales.length,
        totalRevenue: sales.reduce((sum, s) => sum + s.totalCents, 0),
        totalDiscount: sales.reduce((sum, s) => sum + s.discountCents, 0),
        totalTax: sales.reduce((sum, s) => sum + s.taxCents, 0),
        summary: summary.sort((a, b) => a.date.localeCompare(b.date)),
      }
    }
  )
}
