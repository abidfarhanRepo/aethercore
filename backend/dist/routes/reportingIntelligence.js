"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = reportingIntelligenceRoutes;
const authMiddleware_1 = require("../plugins/authMiddleware");
const reportingIntelligence_1 = require("../lib/reportingIntelligence");
function parseRole(input) {
    if (typeof input !== 'string') {
        return null;
    }
    if (input === 'ADMIN' || input === 'MANAGER' || input === 'SUPERVISOR' || input === 'CASHIER' || input === 'STOCK_CLERK') {
        return input;
    }
    return null;
}
async function reportingIntelligenceRoutes(fastify) {
    fastify.get('/api/v1/reports/sales/visible', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requirePermission)('sales.read')] }, async (req, reply) => {
        const user = req.user;
        const role = parseRole(user?.role);
        if (!user?.id || !role) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        if (!(0, reportingIntelligence_1.canViewSalesDetails)(role)) {
            return reply.code(403).send({ error: 'forbidden' });
        }
        const query = req.query;
        const sales = await (0, reportingIntelligence_1.getVisibleSales)(role, user.id, query.dateFrom, query.dateTo);
        return {
            scope: role === 'CASHIER' ? 'OWN_SALES_ONLY' : 'COMBINED_SALES',
            count: sales.length,
            items: sales,
        };
    });
    fastify.get('/api/v1/reports/sales/:id/visible', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requirePermission)('sales.read')] }, async (req, reply) => {
        const user = req.user;
        const role = parseRole(user?.role);
        if (!user?.id || !role) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        if (!(0, reportingIntelligence_1.canViewSalesDetails)(role)) {
            return reply.code(403).send({ error: 'forbidden' });
        }
        const params = req.params;
        const sale = await (0, reportingIntelligence_1.getVisibleSaleById)(role, user.id, params.id);
        if (!sale) {
            return reply.code(404).send({ error: 'not found or not visible' });
        }
        return {
            scope: role === 'CASHIER' ? 'OWN_SALE_ONLY' : 'COMBINED_SALE',
            sale,
        };
    });
    fastify.get('/api/v1/reports/purchases/visible', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requirePermission)('purchases.read')] }, async (req, reply) => {
        const user = req.user;
        const role = parseRole(user?.role);
        if (!user?.id || !role) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        if (!(0, reportingIntelligence_1.canViewPurchases)(role)) {
            return reply.code(403).send({ error: 'forbidden' });
        }
        const query = req.query;
        const purchases = await (0, reportingIntelligence_1.getVisiblePurchases)(role, user.id, query.dateFrom, query.dateTo);
        return {
            scope: role === 'STOCK_CLERK' ? 'OWN_PURCHASES_ONLY' : 'COMBINED_PURCHASES',
            count: purchases.length,
            items: purchases,
        };
    });
    fastify.get('/api/v1/reports/purchases/:id/visible', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requirePermission)('purchases.read')] }, async (req, reply) => {
        const user = req.user;
        const role = parseRole(user?.role);
        if (!user?.id || !role) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        if (!(0, reportingIntelligence_1.canViewPurchases)(role)) {
            return reply.code(403).send({ error: 'forbidden' });
        }
        const params = req.params;
        const purchase = await (0, reportingIntelligence_1.getVisiblePurchaseById)(role, user.id, params.id);
        if (!purchase) {
            return reply.code(404).send({ error: 'not found or not visible' });
        }
        return {
            scope: role === 'STOCK_CLERK' ? 'OWN_PURCHASE_ONLY' : 'COMBINED_PURCHASE',
            purchase,
        };
    });
    fastify.get('/api/v1/reports/intelligence/purchase-recommendations', { preHandler: [authMiddleware_1.requireAuth] }, async (req, reply) => {
        const user = req.user;
        const role = parseRole(user?.role);
        if (!user?.id || !role) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        if (!(0, reportingIntelligence_1.canViewPurchaseIntelligence)(role)) {
            return reply.code(403).send({ error: 'forbidden' });
        }
        const query = req.query;
        const windowDays = query.windowDays ? Number(query.windowDays) : undefined;
        const leadTimeDays = query.leadTimeDays ? Number(query.leadTimeDays) : undefined;
        const serviceLevelDays = query.serviceLevelDays ? Number(query.serviceLevelDays) : undefined;
        const maxItems = query.maxItems ? Number(query.maxItems) : undefined;
        const result = await (0, reportingIntelligence_1.generatePurchaseRecommendations)(role, {
            windowDays: Number.isFinite(windowDays) && windowDays > 0 ? windowDays : undefined,
            leadTimeDays: Number.isFinite(leadTimeDays) && leadTimeDays > 0 ? leadTimeDays : undefined,
            serviceLevelDays: Number.isFinite(serviceLevelDays) && serviceLevelDays > 0 ? serviceLevelDays : undefined,
            maxItems: Number.isFinite(maxItems) && maxItems > 0 ? Math.floor(maxItems) : undefined,
        });
        return {
            scope: role,
            ...result,
        };
    });
    fastify.get('/api/v1/reports/intelligence/kpis', { preHandler: [authMiddleware_1.requireAuth] }, async (req, reply) => {
        const user = req.user;
        const role = parseRole(user?.role);
        if (!user?.id || !role) {
            return reply.code(401).send({ error: 'unauthenticated' });
        }
        const query = req.query;
        const verticalInput = (query.vertical || 'general').toLowerCase();
        const vertical = verticalInput === 'supermarket' || verticalInput === 'restaurant' || verticalInput === 'pharmacy'
            ? verticalInput
            : 'general';
        return (0, reportingIntelligence_1.getRoleScopedKpis)(role, user.id, vertical, query.dateFrom, query.dateTo);
    });
}
