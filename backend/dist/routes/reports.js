"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = reportsRoutes;
const db_1 = require("../utils/db");
const authMiddleware_1 = require("../plugins/authMiddleware");
// Simple in-memory cache with TTL
const cache = new Map();
function setCache(key, data, ttlSeconds = 3600) {
    cache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}
function getCache(key) {
    const item = cache.get(key);
    if (!item)
        return null;
    if (Date.now() > item.expiry) {
        cache.delete(key);
        return null;
    }
    return item.data;
}
async function reportsRoutes(fastify) {
    fastify.addHook('preHandler', authMiddleware_1.requireAuth);
    fastify.addHook('preHandler', (0, authMiddleware_1.requirePermission)('reports.view'));
    // ============ Sales Summary by Day/Week/Month ============
    fastify.get('/api/reports/sales-summary', async (req, reply) => {
        const { dateFrom, dateTo, groupBy } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `sales-summary-${from.toISOString()}-${to.toISOString()}-${groupBy || 'day'}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const sales = await db_1.prisma.sale.findMany({
            where: { createdAt: { gte: from, lte: to }, status: 'completed' },
            select: { createdAt: true, totalCents: true, subtotalCents: true, discountCents: true, taxCents: true },
        });
        const buckets = {};
        for (const s of sales) {
            let key = s.createdAt.toISOString().slice(0, 10);
            if (groupBy === 'week') {
                const date = new Date(s.createdAt);
                const firstDay = new Date(date.setDate(date.getDate() - date.getDay()));
                key = firstDay.toISOString().slice(0, 10);
            }
            else if (groupBy === 'month') {
                key = s.createdAt.toISOString().slice(0, 7);
            }
            if (!buckets[key])
                buckets[key] = { sales: 0, revenue: 0, discount: 0, tax: 0 };
            buckets[key].sales += 1;
            buckets[key].revenue += s.totalCents;
            buckets[key].discount += s.discountCents;
            buckets[key].tax += s.taxCents;
        }
        const result = Object.entries(buckets)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({ date, ...data }));
        setCache(cacheKey, result);
        return result;
    });
    // ============ Sales by Product ============
    fastify.get('/api/reports/sales-by-product', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `sales-by-product-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const result = await db_1.prisma.saleItem.groupBy({
            by: ['productId'],
            where: { sale: { createdAt: { gte: from, lte: to }, status: 'completed' } },
            _sum: { qty: true, unitPrice: true, discountCents: true },
            _count: true,
        });
        const enriched = await Promise.all(result.map(async (item) => {
            const product = await db_1.prisma.product.findUnique({ where: { id: item.productId } });
            const totalRevenue = (item._sum.unitPrice || 0) * (item._sum.qty || 0) - (item._sum.discountCents || 0);
            return {
                productId: item.productId,
                productName: product?.name || 'Unknown',
                sku: product?.sku || '',
                category: product?.category || '',
                qty: item._sum.qty || 0,
                totalRevenue,
                avgUnitPrice: item._sum.qty ? Math.floor((item._sum.unitPrice || 0) / item._sum.qty) : 0,
                itemCount: item._count,
            };
        }));
        const sorted = enriched.sort((a, b) => b.totalRevenue - a.totalRevenue);
        setCache(cacheKey, sorted);
        return sorted;
    });
    // ============ Sales by Category ============
    fastify.get('/api/reports/sales-by-category', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `sales-by-category-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const sales = await db_1.prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: from, lte: to }, status: 'completed' } },
            include: { product: true },
        });
        const buckets = {};
        for (const item of sales) {
            const cat = item.product.category || 'Uncategorized';
            if (!buckets[cat])
                buckets[cat] = { qty: 0, revenue: 0 };
            buckets[cat].qty += item.qty;
            buckets[cat].revenue += item.qty * item.unitPrice - item.discountCents;
        }
        const result = Object.entries(buckets)
            .map(([category, data]) => ({ category, ...data }))
            .sort((a, b) => b.revenue - a.revenue);
        setCache(cacheKey, result);
        return result;
    });
    // ============ Top Products ============
    fastify.get('/api/reports/top-products', async (req, reply) => {
        const { limit, dateFrom, dateTo } = req.query;
        const limitNum = parseInt(limit) || 10;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `top-products-${limitNum}-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const topProducts = await db_1.prisma.saleItem.groupBy({
            by: ['productId'],
            where: { sale: { createdAt: { gte: from, lte: to }, status: 'completed' } },
            _sum: { qty: true },
            _count: true,
            orderBy: { _sum: { qty: 'desc' } },
            take: limitNum,
        });
        const enriched = await Promise.all(topProducts.map(async (item) => {
            const product = await db_1.prisma.product.findUnique({ where: { id: item.productId } });
            return {
                productId: item.productId,
                name: product?.name || '',
                sku: product?.sku || '',
                qty: item._sum.qty || 0,
                sales: item._count,
            };
        }));
        setCache(cacheKey, enriched);
        return enriched;
    });
    // ============ Revenue Analysis ============
    fastify.get('/api/reports/revenue-analysis', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `revenue-analysis-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const salesData = await db_1.prisma.sale.aggregate({
            where: { createdAt: { gte: from, lte: to }, status: 'completed' },
            _sum: { totalCents: true, subtotalCents: true, discountCents: true, taxCents: true },
            _count: true,
        });
        const result = {
            totalSales: salesData._count,
            totalRevenue: salesData._sum.totalCents || 0,
            totalSubtotal: salesData._sum.subtotalCents || 0,
            totalDiscount: salesData._sum.discountCents || 0,
            totalTax: salesData._sum.taxCents || 0,
            avgTransaction: salesData._count > 0 ? Math.floor((salesData._sum.totalCents || 0) / salesData._count) : 0,
        };
        setCache(cacheKey, result);
        return result;
    });
    // ============ Inventory Valuation ============
    fastify.get('/api/reports/inventory-valuation', async (req, reply) => {
        const cacheKey = 'inventory-valuation';
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const products = await db_1.prisma.product.findMany({ select: { id: true, sku: true, name: true, costCents: true, priceCents: true } });
        const out = [];
        for (const p of products) {
            const qty = await db_1.prisma.inventoryLocation.aggregate({
                where: { productId: p.id },
                _sum: { qty: true },
            });
            const qtyVal = qty._sum.qty || 0;
            const costValue = qtyVal * (p.costCents || 0);
            const retailValue = qtyVal * (p.priceCents || 0);
            out.push({
                productId: p.id,
                sku: p.sku,
                name: p.name,
                qty: qtyVal,
                costValue,
                retailValue,
            });
        }
        const totals = out.reduce((acc, item) => ({
            totalQty: acc.totalQty + item.qty,
            totalCostValue: acc.totalCostValue + item.costValue,
            totalRetailValue: acc.totalRetailValue + item.retailValue,
        }), { totalQty: 0, totalCostValue: 0, totalRetailValue: 0 });
        const result = { items: out, totals };
        setCache(cacheKey, result, 1800); // 30 min cache
        return result;
    });
    // ============ Inventory Movement ============
    fastify.get('/api/reports/inventory-movement', async (req, reply) => {
        const cacheKey = 'inventory-movement';
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const lastNinetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const products = await db_1.prisma.product.findMany({ select: { id: true, sku: true, name: true } });
        const result = await Promise.all(products.map(async (p) => {
            const inbound = await db_1.prisma.inventoryTransaction.aggregate({
                where: { productId: p.id, createdAt: { gte: lastNinetyDays }, qtyDelta: { gt: 0 } },
                _sum: { qtyDelta: true },
            });
            const outbound = await db_1.prisma.inventoryTransaction.aggregate({
                where: { productId: p.id, createdAt: { gte: lastNinetyDays }, qtyDelta: { lt: 0 } },
                _sum: { qtyDelta: true },
            });
            const current = await db_1.prisma.inventoryLocation.aggregate({
                where: { productId: p.id },
                _sum: { qty: true },
            });
            const inboundQty = inbound._sum.qtyDelta || 0;
            const outboundQty = Math.abs(outbound._sum.qtyDelta || 0);
            const turnoverRate = outboundQty / (inboundQty + outboundQty + 1);
            return {
                productId: p.id,
                sku: p.sku,
                name: p.name,
                currentQty: current._sum.qty || 0,
                inbound90Days: inboundQty,
                outbound90Days: outboundQty,
                turnoverRate: Math.round(turnoverRate * 100) / 100,
                velocity: 'fast',
            };
        }));
        const sorted = result.sort((a, b) => b.outbound90Days - a.outbound90Days);
        setCache(cacheKey, sorted, 1800);
        return sorted;
    });
    // ============ Low Stock Items ============
    fastify.get('/api/reports/low-stock', async (req, reply) => {
        const cacheKey = 'low-stock';
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const lowStock = await db_1.prisma.inventoryLocation.findMany({
            where: { qty: { lte: db_1.prisma.inventoryLocation.fields.minThreshold } },
            include: { product: true, warehouse: true },
        });
        const result = lowStock.map((item) => ({
            productId: item.product.id,
            sku: item.product.sku,
            productName: item.product.name,
            warehouseName: item.warehouse.name,
            currentQty: item.qty,
            minThreshold: item.minThreshold,
            reorderPoint: item.reorderPoint,
            shortage: item.minThreshold - item.qty,
        }));
        setCache(cacheKey, result, 300); // 5 min cache
        return result;
    });
    // ============ Customer Analytics ============
    fastify.get('/api/reports/customer-analytics', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `customer-analytics-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        // Top customers by revenue
        const topCustomers = await db_1.prisma.sale.groupBy({
            by: ['customerId'],
            where: { createdAt: { gte: from, lte: to }, status: 'completed', customerId: { not: null } },
            _sum: { totalCents: true },
            _count: true,
            orderBy: { _sum: { totalCents: 'desc' } },
            take: 20,
        });
        const enriched = await Promise.all(topCustomers.map(async (item) => {
            const customer = await db_1.prisma.customer.findUnique({ where: { id: item.customerId } });
            return {
                customerId: item.customerId,
                name: customer?.name || 'Unknown',
                totalSpent: item._sum.totalCents || 0,
                transactions: item._count,
                avgTransaction: item._count > 0 ? Math.floor((item._sum.totalCents || 0) / item._count) : 0,
                segment: customer?.segment || 'REGULAR',
            };
        }));
        const result = {
            topCustomers: enriched,
            repeatCustomers: topCustomers.filter((c) => c._count > 1).length,
            totalCustomers: topCustomers.length,
            avgCustomerValue: enriched.length > 0 ? Math.floor(enriched.reduce((s, c) => s + c.totalSpent, 0) / enriched.length) : 0,
        };
        setCache(cacheKey, result);
        return result;
    });
    // ============ Payment Methods ============
    fastify.get('/api/reports/payment-methods', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `payment-methods-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const payments = await db_1.prisma.salePayment.groupBy({
            by: ['method'],
            where: { sale: { createdAt: { gte: from, lte: to }, status: 'completed' } },
            _sum: { amountCents: true },
            _count: true,
        });
        const result = payments.map((p) => ({
            method: p.method,
            amount: p._sum.amountCents || 0,
            count: p._count,
            percentage: 0,
        }));
        const total = result.reduce((s, r) => s + r.amount, 0);
        result.forEach((r) => {
            r.percentage = total > 0 ? Math.round((r.amount / total) * 100) : 0;
        });
        setCache(cacheKey, result);
        return result;
    });
    // ============ Discounts Impact ============
    fastify.get('/api/reports/discounts-impact', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `discounts-impact-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const discounts = await db_1.prisma.saleDiscount.groupBy({
            by: ['reason'],
            where: { sale: { createdAt: { gte: from, lte: to }, status: 'completed' } },
            _sum: { amountCents: true },
            _count: true,
        });
        const totalDiscount = await db_1.prisma.sale.aggregate({
            where: { createdAt: { gte: from, lte: to }, status: 'completed' },
            _sum: { discountCents: true },
        });
        const result = discounts.map((d) => ({
            reason: d.reason,
            amount: d._sum.amountCents || 0,
            count: d._count,
        }));
        const response = {
            byReason: result,
            totalDiscount: totalDiscount._sum.discountCents || 0,
            avgDiscountPerSale: 0,
        };
        setCache(cacheKey, response);
        return response;
    });
    // ============ Employee Performance ============
    fastify.get('/api/reports/employee-performance', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `employee-performance-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const employees = await db_1.prisma.sale.groupBy({
            by: ['userId'],
            where: { createdAt: { gte: from, lte: to }, status: 'completed' },
            _sum: { totalCents: true },
            _count: true,
            orderBy: { _sum: { totalCents: 'desc' } },
        });
        const enriched = await Promise.all(employees.map(async (emp) => {
            const user = await db_1.prisma.user.findUnique({ where: { id: emp.userId } });
            return {
                userId: emp.userId,
                name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
                totalSales: emp._sum.totalCents || 0,
                transactionCount: emp._count,
                avgTransaction: emp._count > 0 ? Math.floor((emp._sum.totalCents || 0) / emp._count) : 0,
            };
        }));
        setCache(cacheKey, enriched);
        return enriched;
    });
    // ============ Profit Margins ============
    fastify.get('/api/reports/profit-margins', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `profit-margins-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const saleItems = await db_1.prisma.saleItem.findMany({
            where: { sale: { createdAt: { gte: from, lte: to }, status: 'completed' } },
            include: { product: true },
        });
        const margins = saleItems.reduce((acc, item) => {
            const key = item.product.id;
            if (!acc[key]) {
                acc[key] = {
                    productId: item.product.id,
                    productName: item.product.name,
                    sku: item.product.sku,
                    cost: item.product.costCents || 0,
                    price: item.unitPrice,
                    costTotal: 0,
                    revenueTotal: 0,
                    units: 0,
                };
            }
            acc[key].costTotal += item.qty * (item.product.costCents || 0);
            acc[key].revenueTotal += item.qty * item.unitPrice;
            acc[key].units += item.qty;
            return acc;
        }, {});
        const result = Object.values(margins).map((m) => ({
            ...m,
            marginAmount: m.revenueTotal - m.costTotal,
            marginPercent: m.revenueTotal > 0 ? Math.round(((m.revenueTotal - m.costTotal) / m.revenueTotal) * 100) : 0,
        }));
        setCache(cacheKey, result);
        return result;
    });
    // ============ Tax Summary ============
    fastify.get('/api/reports/tax-summary', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const cacheKey = `tax-summary-${from.toISOString()}-${to.toISOString()}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const taxData = await db_1.prisma.sale.aggregate({
            where: { createdAt: { gte: from, lte: to }, status: 'completed' },
            _sum: { taxCents: true, subtotalCents: true },
            _count: true,
        });
        const result = {
            totalSales: taxData._count,
            totalTax: taxData._sum.taxCents || 0,
            totalTaxableAmount: taxData._sum.subtotalCents || 0,
            effectiveTaxRate: taxData._sum.subtotalCents ? Math.round(((taxData._sum.taxCents || 0) / taxData._sum.subtotalCents) * 100) : 0,
        };
        setCache(cacheKey, result);
        return result;
    });
    // ============ Hourly Sales ============
    fastify.get('/api/reports/hourly-sales', async (req, reply) => {
        const { date } = req.query;
        const reportDate = date ? new Date(date) : new Date();
        reportDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(reportDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const cacheKey = `hourly-sales-${reportDate.toISOString().slice(0, 10)}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const sales = await db_1.prisma.sale.findMany({
            where: { createdAt: { gte: reportDate, lt: nextDay }, status: 'completed' },
            select: { createdAt: true, totalCents: true },
        });
        const hourlyBuckets = {};
        for (let i = 0; i < 24; i++)
            hourlyBuckets[i] = 0;
        for (const sale of sales) {
            const hour = sale.createdAt.getHours();
            hourlyBuckets[hour] += sale.totalCents;
        }
        const result = Object.entries(hourlyBuckets).map(([hour, revenue]) => ({
            hour: parseInt(hour),
            revenue,
            timeSlot: `${hour.padStart(2, '0')}:00`,
        }));
        setCache(cacheKey, result);
        return result;
    });
    // ============ Inventory Adjustments ============
    fastify.get('/api/reports/inventory-adjustments', async (req, reply) => {
        const { dateFrom, dateTo } = req.query;
        const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const to = dateTo ? new Date(dateTo) : new Date();
        const adjustments = await db_1.prisma.inventoryTransaction.findMany({
            where: {
                createdAt: { gte: from, lte: to },
                type: 'ADJUSTMENT',
            },
            include: { product: true, warehouse: true },
            orderBy: { createdAt: 'desc' },
        });
        const result = adjustments.map((adj) => ({
            id: adj.id,
            productSku: adj.product.sku,
            productName: adj.product.name,
            warehouse: adj.warehouse.name,
            qtyDelta: adj.qtyDelta,
            reason: adj.reason,
            notes: adj.notes,
            createdAt: adj.createdAt,
        }));
        return result;
    });
    // ============ Daily Sales (hourly breakdown for a specific date) ============
    fastify.get('/api/reports/daily-sales', async (req, reply) => {
        const { date } = req.query;
        const reportDate = date ? new Date(date) : new Date();
        reportDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(reportDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const cacheKey = `daily-sales-${reportDate.toISOString().slice(0, 10)}`;
        const cached = getCache(cacheKey);
        if (cached)
            return cached;
        const sales = await db_1.prisma.sale.findMany({
            where: { createdAt: { gte: reportDate, lt: nextDay }, status: 'completed' },
            select: { createdAt: true, totalCents: true, discountCents: true, taxCents: true },
        });
        const hourlyBuckets = {};
        for (let i = 0; i < 24; i++)
            hourlyBuckets[i] = { totalCents: 0, count: 0 };
        for (const sale of sales) {
            const hour = sale.createdAt.getHours();
            hourlyBuckets[hour].totalCents += sale.totalCents;
            hourlyBuckets[hour].count += 1;
        }
        const result = Object.entries(hourlyBuckets).map(([hour, data]) => ({
            hour: parseInt(hour),
            totalCents: data.totalCents,
            date: reportDate.toISOString().split('T')[0],
            transactionCount: data.count,
        }));
        setCache(cacheKey, result);
        return result;
    });
    // ============ CSV Export ============
    fastify.get('/api/reports/export/csv', { preHandler: [(0, authMiddleware_1.requirePermission)('reports.export')] }, async (req, reply) => {
        const { type, dateFrom, dateTo } = req.query;
        if (type === 'sales-summary') {
            const salesData = await db_1.prisma.sale.findMany({
                where: { createdAt: { gte: dateFrom ? new Date(dateFrom) : undefined, lte: dateTo ? new Date(dateTo) : undefined }, status: 'completed' },
            });
            let csv = 'Date,Total Revenue,Discount,Tax,Item Count\n';
            const grouped = {};
            for (const sale of salesData) {
                const date = sale.createdAt.toISOString().slice(0, 10);
                if (!grouped[date])
                    grouped[date] = { revenue: 0, discount: 0, tax: 0, count: 0 };
                grouped[date].revenue += sale.totalCents;
                grouped[date].discount += sale.discountCents;
                grouped[date].tax += sale.taxCents;
                grouped[date].count += 1;
            }
            for (const [date, data] of Object.entries(grouped)) {
                csv += `${date},${data.revenue},${data.discount},${data.tax},${data.count}\n`;
            }
            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', 'attachment; filename="sales-summary.csv"');
            return reply.send(csv);
        }
        return reply.status(400).send({ error: 'Invalid export type' });
    });
}
