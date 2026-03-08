"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = pluginRoutes;
const db_1 = require("../utils/db");
const authMiddleware_1 = require("../plugins/authMiddleware");
const pluginService_1 = require("../lib/pluginService");
function parseProfile(value) {
    if (!value)
        return 'GENERAL';
    const normalized = value.toUpperCase();
    if (normalized === 'SUPERMARKET' || normalized === 'RESTAURANT' || normalized === 'PHARMACY' || normalized === 'GENERAL') {
        return normalized;
    }
    return 'GENERAL';
}
async function pluginRoutes(fastify) {
    const managerGuard = [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN', 'MANAGER')];
    fastify.get('/api/v1/plugins', { preHandler: managerGuard }, async () => {
        const plugins = await db_1.prisma.plugin.findMany({
            include: {
                capabilities: {
                    select: { key: true, name: true, description: true, isDefault: true },
                    orderBy: { key: 'asc' },
                },
                dependencies: {
                    include: {
                        dependsOnPlugin: { select: { key: true, version: true } },
                    },
                },
            },
            orderBy: [{ isCore: 'desc' }, { key: 'asc' }],
        });
        return { plugins };
    });
    fastify.get('/api/v1/plugins/tenants', { preHandler: managerGuard }, async () => {
        const tenants = await db_1.prisma.tenant.findMany({
            include: {
                _count: { select: { users: true, featureFlags: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        return { tenants };
    });
    fastify.post('/api/v1/plugins/tenants', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')] }, async (req, reply) => {
        const body = (req.body || {});
        if (!body.name || !body.code) {
            return reply.code(400).send({ error: 'name and code are required' });
        }
        const tenant = await db_1.prisma.tenant.create({
            data: {
                name: body.name,
                code: body.code.toUpperCase(),
                profile: parseProfile(body.profile),
            },
        });
        return reply.code(201).send(tenant);
    });
    fastify.get('/api/v1/plugins/tenants/:tenantId/feature-flags', { preHandler: managerGuard }, async (req, reply) => {
        const { tenantId } = req.params;
        const tenant = await db_1.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: {
                featureFlags: {
                    orderBy: { capabilityKey: 'asc' },
                },
            },
        });
        if (!tenant) {
            return reply.code(404).send({ error: 'Tenant not found' });
        }
        return {
            tenant: {
                id: tenant.id,
                name: tenant.name,
                code: tenant.code,
                profile: tenant.profile,
            },
            defaults: pluginService_1.PROFILE_CAPABILITY_DEFAULTS[tenant.profile],
            flags: tenant.featureFlags,
        };
    });
    fastify.put('/api/v1/plugins/tenants/:tenantId/feature-flags/:capabilityKey', { preHandler: managerGuard }, async (req, reply) => {
        const { tenantId, capabilityKey } = req.params;
        const body = (req.body || {});
        if (typeof body.enabled !== 'boolean') {
            return reply.code(400).send({ error: 'enabled must be a boolean' });
        }
        const tenant = await db_1.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
        if (!tenant) {
            return reply.code(404).send({ error: 'Tenant not found' });
        }
        const upserted = await (0, pluginService_1.ensureTenantCapabilityFlag)({
            tenantId,
            capabilityKey,
            enabled: body.enabled,
            updatedBy: req.user?.id,
            config: body.config,
        });
        return upserted;
    });
    fastify.post('/api/v1/plugins/:pluginKey/enable', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')] }, async (req, reply) => {
        const { pluginKey } = req.params;
        const { tenantId } = (req.body || {});
        const plugin = await db_1.prisma.plugin.findUnique({
            where: { key: pluginKey },
            include: { capabilities: { select: { key: true } } },
        });
        if (!plugin) {
            return reply.code(404).send({ error: 'Plugin not found' });
        }
        await db_1.prisma.plugin.update({ where: { id: plugin.id }, data: { isEnabled: true } });
        if (tenantId) {
            for (const capability of plugin.capabilities) {
                await (0, pluginService_1.ensureTenantCapabilityFlag)({
                    tenantId,
                    capabilityKey: capability.key,
                    enabled: true,
                    updatedBy: req.user?.id,
                    sourcePluginId: plugin.id,
                });
            }
        }
        return { ok: true, pluginKey, isEnabled: true };
    });
    fastify.post('/api/v1/plugins/:pluginKey/disable', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')] }, async (req, reply) => {
        const { pluginKey } = req.params;
        const { tenantId } = (req.body || {});
        const plugin = await db_1.prisma.plugin.findUnique({
            where: { key: pluginKey },
            include: {
                dependencies: {
                    include: {
                        dependsOnPlugin: { select: { key: true } },
                    },
                },
                capabilities: { select: { key: true } },
            },
        });
        if (!plugin) {
            return reply.code(404).send({ error: 'Plugin not found' });
        }
        const dependents = await db_1.prisma.pluginDependency.findMany({
            where: {
                dependsOnPluginId: plugin.id,
                plugin: { isEnabled: true },
            },
            include: {
                plugin: { select: { key: true } },
            },
        });
        if (dependents.length > 0) {
            return reply.code(409).send({
                error: 'Dependency conflict',
                details: dependents.map((item) => item.plugin.key),
            });
        }
        await db_1.prisma.plugin.update({ where: { id: plugin.id }, data: { isEnabled: false } });
        if (tenantId) {
            for (const capability of plugin.capabilities) {
                await (0, pluginService_1.ensureTenantCapabilityFlag)({
                    tenantId,
                    capabilityKey: capability.key,
                    enabled: false,
                    updatedBy: req.user?.id,
                    sourcePluginId: plugin.id,
                });
            }
        }
        return { ok: true, pluginKey, isEnabled: false };
    });
}
