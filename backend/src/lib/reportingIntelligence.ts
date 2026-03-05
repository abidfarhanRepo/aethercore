import { Prisma } from '@prisma/client'
import { prisma } from '../utils/db'

export type ReportingRole = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'CASHIER' | 'STOCK_CLERK'

export type Vertical = 'general' | 'supermarket' | 'restaurant' | 'pharmacy'

const COMBINED_REPORTING_ROLES = new Set<ReportingRole>(['ADMIN', 'MANAGER', 'SUPERVISOR'])

export interface RecommendationConfig {
  windowDays: number
  leadTimeDays: number
  serviceLevelDays: number
  maxItems: number
}

export const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  windowDays: 30,
  leadTimeDays: 7,
  serviceLevelDays: 3,
  maxItems: 50,
}

function normalizeDateRange(from?: string, to?: string) {
  const end = to ? new Date(to) : new Date()
  const start = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return { start, end }
}

export function canViewCombinedReporting(role: ReportingRole) {
  return COMBINED_REPORTING_ROLES.has(role)
}

export function canViewPurchaseIntelligence(role: ReportingRole) {
  return canViewCombinedReporting(role) || role === 'STOCK_CLERK'
}

export function canViewPurchases(role: ReportingRole) {
  return canViewCombinedReporting(role) || role === 'STOCK_CLERK'
}

export function canViewSalesDetails(role: ReportingRole) {
  return canViewCombinedReporting(role) || role === 'CASHIER'
}

export function buildVisibleSalesWhere(role: ReportingRole, userId: string, from?: string, to?: string): Prisma.SaleWhereInput {
  const { start, end } = normalizeDateRange(from, to)
  const base: Prisma.SaleWhereInput = {
    createdAt: { gte: start, lte: end },
    status: 'completed',
  }

  if (role === 'CASHIER') {
    return {
      ...base,
      userId,
    }
  }

  return base
}

export async function getVisibleSales(role: ReportingRole, userId: string, from?: string, to?: string) {
  const where = buildVisibleSalesWhere(role, userId, from, to)
  return prisma.sale.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, role: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, category: true } },
        },
      },
      payments: { select: { method: true, amountCents: true } },
    },
  })
}

export async function getVisibleSaleById(role: ReportingRole, userId: string, saleId: string) {
  const where = buildVisibleSalesWhere(role, userId)
  return prisma.sale.findFirst({
    where: {
      ...where,
      id: saleId,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, role: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, category: true, costCents: true } },
        },
      },
      discounts: true,
      payments: true,
    },
  })
}

export async function getVisiblePurchases(role: ReportingRole, userId: string, from?: string, to?: string) {
  const { start, end } = normalizeDateRange(from, to)

  const where: Prisma.PurchaseOrderWhereInput = {
    createdAt: { gte: start, lte: end },
    ...(role === 'STOCK_CLERK' ? { userId } : {}),
  }

  return prisma.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      supplier: { select: { id: true, name: true, email: true } },
      user: { select: { id: true, firstName: true, lastName: true, role: true } },
      items: {
        include: {
          product: { select: { id: true, sku: true, name: true, category: true } },
        },
      },
    },
  })
}

export async function getVisiblePurchaseById(role: ReportingRole, userId: string, purchaseOrderId: string) {
  const purchase = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      supplier: { select: { id: true, name: true, email: true, phone: true } },
      user: { select: { id: true, firstName: true, lastName: true, role: true } },
      items: {
        include: {
          product: { select: { id: true, sku: true, name: true, category: true } },
        },
      },
      receivingSessions: {
        include: {
          discrepancies: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!purchase) {
    return null
  }

  // STOCK_CLERK visibility is scoped to purchase orders created by the user.
  if (role === 'STOCK_CLERK' && purchase.userId !== userId) {
    return null
  }

  return purchase
}

function clampConfidence(score: number) {
  if (score < 0.1) return 0.1
  if (score > 0.95) return 0.95
  return Math.round(score * 100) / 100
}

export async function generatePurchaseRecommendations(role: ReportingRole, configInput?: Partial<RecommendationConfig>) {
  const config = { ...DEFAULT_RECOMMENDATION_CONFIG, ...(configInput || {}) }
  const salesWindowStart = new Date(Date.now() - config.windowDays * 24 * 60 * 60 * 1000)

  const inventoryRows = await prisma.inventoryLocation.findMany({
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
          costCents: true,
          priceCents: true,
        },
      },
    },
  })

  const inventoryByProduct = new Map<string, {
    product: {
      id: string
      name: string
      sku: string
      category: string | null
      costCents: number | null
      priceCents: number
    }
    onHandQty: number
    reorderPoint: number
    minThreshold: number
  }>()

  for (const row of inventoryRows) {
    const existing = inventoryByProduct.get(row.productId)
    if (!existing) {
      inventoryByProduct.set(row.productId, {
        product: row.product,
        onHandQty: row.qty,
        reorderPoint: row.reorderPoint,
        minThreshold: row.minThreshold,
      })
      continue
    }

    existing.onHandQty += row.qty
    existing.reorderPoint = Math.max(existing.reorderPoint, row.reorderPoint)
    existing.minThreshold = Math.max(existing.minThreshold, row.minThreshold)
  }

  const soldByProduct = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        createdAt: { gte: salesWindowStart },
        status: 'completed',
      },
    },
    _sum: { qty: true },
    _count: true,
  })

  const soldLookup = new Map<string, { units: number; transactions: number }>()
  for (const row of soldByProduct) {
    soldLookup.set(row.productId, {
      units: row._sum.qty || 0,
      transactions: row._count,
    })
  }

  const purchasesByProduct = await prisma.purchaseOrderItem.groupBy({
    by: ['productId'],
    _sum: { qtyReceived: true },
  })

  const receivedLookup = new Map<string, number>()
  for (const row of purchasesByProduct) {
    receivedLookup.set(row.productId, row._sum.qtyReceived || 0)
  }

  const recommendations = Array.from(inventoryByProduct.values())
    .map((row) => {
      const sales = soldLookup.get(row.product.id)
      const unitsSold = sales?.units || 0
      const dailyDemand = unitsSold / config.windowDays
      const leadTimeDemand = Math.ceil(dailyDemand * config.leadTimeDays)
      const safetyStock = Math.max(
        Math.ceil(dailyDemand * config.serviceLevelDays),
        Math.max(row.reorderPoint - row.onHandQty, 0),
        row.minThreshold
      )
      const targetStock = leadTimeDemand + safetyStock
      const recommendedQty = Math.max(targetStock - row.onHandQty, 0)
      const receivedRecently = receivedLookup.get(row.product.id) || 0

      let confidence = 0.25
      const confidenceReasons: string[] = []

      if (unitsSold >= 20) {
        confidence += 0.35
        confidenceReasons.push('30-day sales window has >= 20 units sold')
      } else if (unitsSold >= 8) {
        confidence += 0.2
        confidenceReasons.push('30-day sales window has moderate demand signal')
      } else {
        confidenceReasons.push('low sales history in the selected demand window')
      }

      if (row.onHandQty <= row.reorderPoint) {
        confidence += 0.2
        confidenceReasons.push('on-hand quantity is at or below reorder point')
      }

      if (receivedRecently > 0) {
        confidence += 0.15
        confidenceReasons.push('recent receiving history exists for this product')
      } else {
        confidenceReasons.push('no recent receiving history found')
      }

      if (dailyDemand > 0) {
        confidence += 0.1
        confidenceReasons.push('non-zero daily demand estimate')
      }

      const confidenceScore = clampConfidence(confidence)

      return {
        productId: row.product.id,
        sku: row.product.sku,
        productName: row.product.name,
        category: row.product.category || 'Uncategorized',
        onHandQty: row.onHandQty,
        recommendedQty,
        targetStock,
        priorityScore: recommendedQty + Math.max(row.reorderPoint - row.onHandQty, 0),
        estimatedUnitCostCents: row.product.costCents || 0,
        estimatedOrderCostCents: recommendedQty * (row.product.costCents || 0),
        explainability: {
          model: 'deterministic-reorder-v1',
          roleScope: role,
          inputs: {
            windowDays: config.windowDays,
            leadTimeDays: config.leadTimeDays,
            serviceLevelDays: config.serviceLevelDays,
            unitsSoldWindow: unitsSold,
            dailyDemand,
            onHandQty: row.onHandQty,
            reorderPoint: row.reorderPoint,
            minThreshold: row.minThreshold,
            receivedQtyWindow: receivedRecently,
          },
          formula: 'recommendedQty = max(ceil((unitsSoldWindow/windowDays)*leadTimeDays) + max(ceil((unitsSoldWindow/windowDays)*serviceLevelDays), reorderPoint-onHandQty, minThreshold) - onHandQty, 0)',
          confidenceScore,
          confidenceReasons,
        },
      }
    })
    .filter((row) => row.recommendedQty > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, config.maxItems)

  return {
    generatedAt: new Date().toISOString(),
    config,
    recommendations,
  }
}

export async function getRoleScopedKpis(role: ReportingRole, userId: string, vertical: Vertical = 'general', from?: string, to?: string) {
  const { start, end } = normalizeDateRange(from, to)

  const salesWhere: Prisma.SaleWhereInput = {
    createdAt: { gte: start, lte: end },
    status: 'completed',
    ...(role === 'CASHIER' ? { userId } : {}),
  }

  const saleAgg = await prisma.sale.aggregate({
    where: salesWhere,
    _sum: { totalCents: true },
    _count: true,
  })

  const salesCount = saleAgg._count
  const totalRevenueCents = saleAgg._sum.totalCents || 0
  const avgTicketCents = salesCount > 0 ? Math.floor(totalRevenueCents / salesCount) : 0

  const saleItems = await prisma.saleItem.findMany({
    where: { sale: salesWhere },
    include: { product: { select: { costCents: true, category: true } } },
  })

  const unitsSold = saleItems.reduce((acc, row) => acc + row.qty, 0)
  const estimatedCostCents = saleItems.reduce((acc, row) => acc + row.qty * (row.product.costCents || 0), 0)
  const grossMarginCents = totalRevenueCents - estimatedCostCents
  const grossMarginPct = totalRevenueCents > 0 ? Math.round((grossMarginCents / totalRevenueCents) * 100) : 0

  const purchaseAgg = await prisma.purchaseOrder.aggregate({
    where: {
      createdAt: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    },
    _sum: { totalCents: true },
    _count: true,
  })

  const purchaseSpendCents = purchaseAgg._sum.totalCents || 0

  const inventoryAgg = await prisma.inventoryLocation.aggregate({
    _sum: { qty: true },
  })

  const lowStockCount = await prisma.inventoryLocation.count({
    where: {
      qty: { lte: prisma.inventoryLocation.fields.minThreshold },
    },
  })

  const baseMeta = {
    scope: role,
    vertical,
    from: start.toISOString(),
    to: end.toISOString(),
    unit: 'cents',
  }

  if (role === 'CASHIER') {
    return {
      meta: baseMeta,
      permissions: {
        canViewSalesDetail: true,
        canViewPurchaseIntelligence: false,
      },
      kpis: [
        {
          key: 'cashier.sales.total_revenue_cents',
          label: 'My Revenue',
          value: totalRevenueCents,
          formula: 'sum(sale.totalCents for completed sales where sale.userId = currentUser)',
        },
        {
          key: 'cashier.sales.transaction_count',
          label: 'My Transactions',
          value: salesCount,
          formula: 'count(completed sales where sale.userId = currentUser)',
        },
        {
          key: 'cashier.sales.avg_ticket_cents',
          label: 'My Average Ticket',
          value: avgTicketCents,
          formula: 'My Revenue / max(My Transactions, 1)',
        },
      ],
    }
  }

  if (role === 'STOCK_CLERK') {
    const onHandQty = inventoryAgg._sum.qty || 0
    const turnover = onHandQty > 0 ? Math.round((unitsSold / onHandQty) * 100) / 100 : 0

    return {
      meta: baseMeta,
      permissions: {
        canViewSalesDetail: false,
        canViewPurchaseIntelligence: true,
      },
      kpis: [
        {
          key: 'stock.low_stock_count',
          label: 'Low Stock SKUs',
          value: lowStockCount,
          formula: 'count(inventoryLocation where qty <= minThreshold)',
        },
        {
          key: 'stock.on_hand_units',
          label: 'Total On-Hand Units',
          value: onHandQty,
          formula: 'sum(inventoryLocation.qty)',
        },
        {
          key: 'stock.purchase_spend_cents',
          label: 'Purchase Spend',
          value: purchaseSpendCents,
          formula: 'sum(purchaseOrder.totalCents where status != CANCELLED)',
        },
        {
          key: 'stock.turnover_ratio',
          label: 'Stock Turnover',
          value: turnover,
          formula: 'unitsSoldInWindow / max(totalOnHandUnits, 1)',
        },
      ],
    }
  }

  const combinedKpis: Array<{ key: string; label: string; value: number; formula: string }> = [
    {
      key: 'ops.sales.total_revenue_cents',
      label: 'Revenue',
      value: totalRevenueCents,
      formula: 'sum(sale.totalCents for completed sales)',
    },
    {
      key: 'ops.sales.transaction_count',
      label: 'Transactions',
      value: salesCount,
      formula: 'count(completed sales)',
    },
    {
      key: 'ops.sales.avg_ticket_cents',
      label: 'Average Ticket',
      value: avgTicketCents,
      formula: 'Revenue / max(Transactions, 1)',
    },
    {
      key: 'ops.margin.gross_margin_pct',
      label: 'Gross Margin %',
      value: grossMarginPct,
      formula: '((Revenue - EstimatedCOGS) / max(Revenue, 1)) * 100',
    },
    {
      key: 'ops.purchases.spend_cents',
      label: 'Purchase Spend',
      value: purchaseSpendCents,
      formula: 'sum(purchaseOrder.totalCents where status != CANCELLED)',
    },
    {
      key: 'ops.stock.low_stock_count',
      label: 'Low Stock SKUs',
      value: lowStockCount,
      formula: 'count(inventoryLocation where qty <= minThreshold)',
    },
  ]

  if (vertical === 'supermarket') {
    const basketSize = salesCount > 0 ? Math.round((unitsSold / salesCount) * 100) / 100 : 0
    combinedKpis.push({
      key: 'supermarket.sales.basket_size',
      label: 'Basket Size',
      value: basketSize,
      formula: 'sum(saleItem.qty) / max(count(completed sales), 1)',
    })
  }

  if (vertical === 'restaurant') {
    const paymentMixCard = await prisma.salePayment.aggregate({
      where: {
        sale: salesWhere,
        method: { in: ['CARD', 'CREDIT_CARD', 'DEBIT_CARD'] },
      },
      _sum: { amountCents: true },
    })

    const cardSharePct = totalRevenueCents > 0
      ? Math.round(((paymentMixCard._sum.amountCents || 0) / totalRevenueCents) * 100)
      : 0

    combinedKpis.push({
      key: 'restaurant.payments.card_share_pct',
      label: 'Card Payment Share %',
      value: cardSharePct,
      formula: '(sum(card payment amount) / max(total revenue, 1)) * 100',
    })
  }

  if (vertical === 'pharmacy') {
    const pharmacyUnits = saleItems
      .filter((item) => (item.product.category || '').toLowerCase().includes('pharma'))
      .reduce((sum, item) => sum + item.qty, 0)

    const pharmacyMixPct = unitsSold > 0 ? Math.round((pharmacyUnits / unitsSold) * 100) : 0

    combinedKpis.push({
      key: 'pharmacy.sales.category_mix_pct',
      label: 'Pharmacy Category Unit Mix %',
      value: pharmacyMixPct,
      formula: '(sum(units where category contains "pharma") / max(total units sold, 1)) * 100',
    })
  }

  return {
    meta: baseMeta,
    permissions: {
      canViewSalesDetail: true,
      canViewPurchaseIntelligence: true,
    },
    kpis: combinedKpis,
  }
}
