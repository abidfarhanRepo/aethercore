import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'
import { requireAuth, requireRole } from '../plugins/authMiddleware'
import { logger } from '../utils/logger'
import {
  cashSessionIdParamsSchema,
  CashSessionIdParams,
  closeCashSessionBodySchema,
  CloseCashSessionBody,
  listCashSessionsQuerySchema,
  ListCashSessionsQuery,
  openCashSessionBodySchema,
  OpenCashSessionBody,
} from '../schemas/cashSessions'

function resolveTenantId(req: any): string {
  const tenantId = String(req.user?.tenantId || 'global').trim()
  return tenantId || 'global'
}

const CASH_SESSION_STATUS_OPEN = 'OPEN'
const CASH_SESSION_STATUS_CLOSED = 'CLOSED'

export default async function cashSessionRoutes(fastify: FastifyInstance) {
  const requireManager = requireRole('ADMIN', 'MANAGER')

  fastify.post<{ Body: OpenCashSessionBody }>(
    '/api/v1/cash-sessions/open',
    {
      preHandler: [requireAuth, requireManager],
      config: { zod: { body: openCashSessionBodySchema } },
    },
    async (req, reply) => {
      const authUser = req.user
      if (!authUser) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const tenantId = resolveTenantId(req)
      const terminalId = req.body.terminalId?.trim() || null
      const cashSessionModel = (prisma as any).cashSession

      const existingOpenSession = await cashSessionModel.findFirst({
        where: {
          tenantId,
          terminalId,
          status: CASH_SESSION_STATUS_OPEN,
        },
      })

      if (existingOpenSession) {
        return reply.code(409).send({
          error: 'An open cash session already exists for this terminal',
          sessionId: existingOpenSession.id,
        })
      }

      const opened = await cashSessionModel.create({
        data: {
          tenantId,
          terminalId,
          openingFloatCents: req.body.openingFloatCents,
          openedBy: authUser.id,
          status: CASH_SESSION_STATUS_OPEN,
        },
      })

      await prisma.auditLog.create({
        data: {
          actorId: authUser.id,
          action: 'CASH_SESSION_OPENED',
          resource: 'CASH_SESSION',
          resourceId: opened.id,
          details: JSON.stringify({
            tenantId,
            terminalId,
            openingFloatCents: opened.openingFloatCents,
          }),
          ipAddress: req.ip,
        },
      })

      logger.info(
        {
          cashSessionId: opened.id,
          tenantId,
          terminalId,
          openingFloatCents: opened.openingFloatCents,
          openedBy: authUser.id,
        },
        'cash session opened'
      )

      return reply.code(201).send(opened)
    }
  )

  fastify.post<{ Params: CashSessionIdParams; Body: CloseCashSessionBody }>(
    '/api/v1/cash-sessions/:id/close',
    {
      preHandler: [requireAuth, requireManager],
      config: { zod: { params: cashSessionIdParamsSchema, body: closeCashSessionBodySchema } },
    },
    async (req, reply) => {
      const authUser = req.user
      if (!authUser) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const tenantId = resolveTenantId(req)
      const cashSessionModel = (prisma as any).cashSession

      const session = await cashSessionModel.findFirst({
        where: {
          id: req.params.id,
          tenantId,
        },
      })

      if (!session) {
        return reply.code(404).send({ error: 'Cash session not found' })
      }

      if (session.status === CASH_SESSION_STATUS_CLOSED) {
        return reply.code(400).send({ error: 'Cash session already closed' })
      }

      const now = new Date()
      const tenantUserFilter =
        tenantId === 'global'
          ? undefined
          : {
              user: {
                tenantId,
              },
            }

      const cashPaymentsAggregate = await prisma.salePayment.aggregate({
        _sum: { amountCents: true },
        where: {
          method: 'CASH',
          sale: {
            createdAt: {
              gte: session.openedAt,
              lte: now,
            },
            status: 'completed',
            ...(session.terminalId
              ? {
                  terminalId: session.terminalId,
                }
              : {}),
            ...(tenantUserFilter || {}),
          },
        },
      })

      const cashSalesCents = cashPaymentsAggregate._sum.amountCents || 0
      const systemCashCents = session.openingFloatCents + cashSalesCents
      const varianceCents = req.body.declaredCashCents - systemCashCents

      const closed = await cashSessionModel.update({
        where: { id: session.id },
        data: {
          closedAt: now,
          declaredCashCents: req.body.declaredCashCents,
          systemCashCents,
          varianceCents,
          closedBy: authUser.id,
          status: CASH_SESSION_STATUS_CLOSED,
        },
      })

      await prisma.auditLog.create({
        data: {
          actorId: authUser.id,
          action: 'CASH_SESSION_CLOSED',
          resource: 'CASH_SESSION',
          resourceId: closed.id,
          details: JSON.stringify({
            tenantId,
            terminalId: closed.terminalId,
            declaredCashCents: closed.declaredCashCents,
            systemCashCents,
            varianceCents,
          }),
          ipAddress: req.ip,
        },
      })

      logger.info(
        {
          cashSessionId: closed.id,
          tenantId,
          terminalId: closed.terminalId,
          declaredCashCents: closed.declaredCashCents,
          systemCashCents,
          varianceCents,
          closedBy: authUser.id,
        },
        'cash session closed'
      )

      return reply.send(closed)
    }
  )

  fastify.get<{ Querystring: ListCashSessionsQuery }>(
    '/api/v1/cash-sessions',
    {
      preHandler: [requireAuth, requireManager],
      config: { zod: { query: listCashSessionsQuerySchema } },
    },
    async (req) => {
      const tenantId = resolveTenantId(req)
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null

      const where = {
        tenantId,
        ...(req.query.terminalId ? { terminalId: req.query.terminalId } : {}),
        ...(dateFrom || dateTo
          ? {
              openedAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      }

      const [items, total] = await Promise.all([
        (prisma as any).cashSession.findMany({
          where,
          orderBy: { openedAt: 'desc' },
          take: req.query.limit,
          skip: req.query.offset,
        }),
        (prisma as any).cashSession.count({ where }),
      ])

      return {
        items,
        total,
        limit: req.query.limit,
        offset: req.query.offset,
      }
    }
  )
}
