import { FastifyInstance } from 'fastify'
import { requireAuth, requirePermission } from '../plugins/authMiddleware'
import {
  canViewPurchases,
  canViewPurchaseIntelligence,
  canViewSalesDetails,
  generatePurchaseRecommendations,
  getRoleScopedKpis,
  getVisiblePurchaseById,
  getVisiblePurchases,
  getVisibleSaleById,
  getVisibleSales,
  ReportingRole,
  Vertical,
} from '../lib/reportingIntelligence'

function parseRole(input: unknown): ReportingRole | null {
  if (typeof input !== 'string') {
    return null
  }

  if (input === 'ADMIN' || input === 'MANAGER' || input === 'SUPERVISOR' || input === 'CASHIER' || input === 'STOCK_CLERK') {
    return input
  }

  return null
}

export default async function reportingIntelligenceRoutes(fastify: FastifyInstance) {
  fastify.get('/api/reports/sales/visible', { preHandler: [requireAuth, requirePermission('sales.read')] }, async (req, reply) => {
    const user = (req as any).user
    const role = parseRole(user?.role)

    if (!user?.id || !role) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    if (!canViewSalesDetails(role)) {
      return reply.code(403).send({ error: 'forbidden' })
    }

    const query = req.query as Record<string, string | undefined>
    const sales = await getVisibleSales(role, user.id, query.dateFrom, query.dateTo)

    return {
      scope: role === 'CASHIER' ? 'OWN_SALES_ONLY' : 'COMBINED_SALES',
      count: sales.length,
      items: sales,
    }
  })

  fastify.get('/api/reports/sales/:id/visible', { preHandler: [requireAuth, requirePermission('sales.read')] }, async (req, reply) => {
    const user = (req as any).user
    const role = parseRole(user?.role)

    if (!user?.id || !role) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    if (!canViewSalesDetails(role)) {
      return reply.code(403).send({ error: 'forbidden' })
    }

    const params = req.params as { id: string }
    const sale = await getVisibleSaleById(role, user.id, params.id)

    if (!sale) {
      return reply.code(404).send({ error: 'not found or not visible' })
    }

    return {
      scope: role === 'CASHIER' ? 'OWN_SALE_ONLY' : 'COMBINED_SALE',
      sale,
    }
  })

  fastify.get('/api/reports/purchases/visible', { preHandler: [requireAuth, requirePermission('purchases.read')] }, async (req, reply) => {
    const user = (req as any).user
    const role = parseRole(user?.role)

    if (!user?.id || !role) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    if (!canViewPurchases(role)) {
      return reply.code(403).send({ error: 'forbidden' })
    }

    const query = req.query as Record<string, string | undefined>
    const purchases = await getVisiblePurchases(role, user.id, query.dateFrom, query.dateTo)

    return {
      scope: role === 'STOCK_CLERK' ? 'OWN_PURCHASES_ONLY' : 'COMBINED_PURCHASES',
      count: purchases.length,
      items: purchases,
    }
  })

  fastify.get('/api/reports/purchases/:id/visible', { preHandler: [requireAuth, requirePermission('purchases.read')] }, async (req, reply) => {
    const user = (req as any).user
    const role = parseRole(user?.role)

    if (!user?.id || !role) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    if (!canViewPurchases(role)) {
      return reply.code(403).send({ error: 'forbidden' })
    }

    const params = req.params as { id: string }
    const purchase = await getVisiblePurchaseById(role, user.id, params.id)

    if (!purchase) {
      return reply.code(404).send({ error: 'not found or not visible' })
    }

    return {
      scope: role === 'STOCK_CLERK' ? 'OWN_PURCHASE_ONLY' : 'COMBINED_PURCHASE',
      purchase,
    }
  })

  fastify.get('/api/reports/intelligence/purchase-recommendations', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = (req as any).user
    const role = parseRole(user?.role)

    if (!user?.id || !role) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    if (!canViewPurchaseIntelligence(role)) {
      return reply.code(403).send({ error: 'forbidden' })
    }

    const query = req.query as Record<string, string | undefined>

    const windowDays = query.windowDays ? Number(query.windowDays) : undefined
    const leadTimeDays = query.leadTimeDays ? Number(query.leadTimeDays) : undefined
    const serviceLevelDays = query.serviceLevelDays ? Number(query.serviceLevelDays) : undefined
    const maxItems = query.maxItems ? Number(query.maxItems) : undefined

    const result = await generatePurchaseRecommendations(role, {
      windowDays: Number.isFinite(windowDays) && (windowDays as number) > 0 ? (windowDays as number) : undefined,
      leadTimeDays: Number.isFinite(leadTimeDays) && (leadTimeDays as number) > 0 ? (leadTimeDays as number) : undefined,
      serviceLevelDays: Number.isFinite(serviceLevelDays) && (serviceLevelDays as number) > 0 ? (serviceLevelDays as number) : undefined,
      maxItems: Number.isFinite(maxItems) && (maxItems as number) > 0 ? Math.floor(maxItems as number) : undefined,
    })

    return {
      scope: role,
      ...result,
    }
  })

  fastify.get('/api/reports/intelligence/kpis', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = (req as any).user
    const role = parseRole(user?.role)

    if (!user?.id || !role) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    const query = req.query as Record<string, string | undefined>
    const verticalInput = (query.vertical || 'general').toLowerCase()
    const vertical: Vertical = verticalInput === 'supermarket' || verticalInput === 'restaurant' || verticalInput === 'pharmacy'
      ? verticalInput
      : 'general'

    return getRoleScopedKpis(role, user.id, vertical, query.dateFrom, query.dateTo)
  })
}
