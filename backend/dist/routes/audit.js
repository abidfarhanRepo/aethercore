"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = auditRoutes;
const db_1 = require("../utils/db");
async function auditRoutes(fastify) {
    fastify.get('/audits', async () => {
        const audits = await db_1.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
        return audits;
    });
    // internal helper to create audit entries (not exposed as public endpoint)
    fastify.decorate('createAudit', async (action, details, actorId) => {
        return db_1.prisma.auditLog.create({ data: { action, details: JSON.stringify(details), actorId: actorId || 'system' } });
    });
}
