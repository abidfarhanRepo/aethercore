"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = settingsRoutes;
const db_1 = require("../utils/db");
const authMiddleware_1 = require("../plugins/authMiddleware");
const client_1 = require("@prisma/client");
const securityCompliance_1 = require("../lib/securityCompliance");
const logger_1 = require("../utils/logger");
async function settingsRoutes(fastify) {
    const requireManagerRole = (0, authMiddleware_1.requireRole)('ADMIN', 'MANAGER');
    // GET all settings grouped by category
    fastify.get('/api/settings', { preHandler: [authMiddleware_1.requireAuth, requireManagerRole] }, async (request, reply) => {
        const settings = await db_1.prisma.settings.findMany({
            orderBy: [{ category: 'asc' }, { key: 'asc' }],
        });
        // Filter out encrypted values from response (don't send encrypted data to frontend)
        const filtered = settings.map((s) => ({
            ...s,
            value: s.isEncrypted ? '***ENCRYPTED***' : s.value,
        }));
        // Group by category
        const grouped = filtered.reduce((acc, setting) => {
            if (!acc[setting.category]) {
                acc[setting.category] = [];
            }
            acc[setting.category].push(setting);
            return acc;
        }, {});
        return grouped;
    });
    // GET specific setting by key
    fastify.get('/api/settings/:key', { preHandler: [authMiddleware_1.requireAuth, requireManagerRole] }, async (request, reply) => {
        const { key } = request.params;
        const setting = await db_1.prisma.settings.findUnique({
            where: { key },
        });
        if (!setting) {
            return reply.code(404).send({ error: 'Setting not found' });
        }
        return {
            ...setting,
            value: setting.isEncrypted ? '***ENCRYPTED***' : setting.value,
        };
    });
    // GET settings by category
    fastify.get('/api/settings/category/:category', { preHandler: [authMiddleware_1.requireAuth, requireManagerRole] }, async (request, reply) => {
        const { category } = request.params;
        const settings = await db_1.prisma.settings.findMany({
            where: { category },
            orderBy: { key: 'asc' },
        });
        // Filter out encrypted values
        return settings.map((s) => ({
            ...s,
            value: s.isEncrypted ? '***ENCRYPTED***' : s.value,
        }));
    });
    // PUT update a specific setting
    fastify.put('/api/settings/:key', {
        preHandler: [authMiddleware_1.requireAuth, requireManagerRole],
        schema: {
            params: {
                type: 'object',
                required: ['key'],
                properties: { key: { type: 'string' } },
            },
            body: {
                type: 'object',
                required: ['value'],
                properties: {
                    value: { anyOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }] },
                    category: { type: 'string' },
                    type: { type: 'string', enum: ['string', 'number', 'boolean', 'json'] },
                    label: { type: 'string' },
                    description: { type: 'string' },
                    isEncrypted: { type: 'boolean' },
                },
            },
        },
    }, async (request, reply) => {
        const { key } = request.params;
        const { value, category, type, label, description, isEncrypted, } = request.body;
        // Check if setting exists
        const existing = await db_1.prisma.settings.findUnique({
            where: { key },
        });
        const inferredType = type ||
            (typeof value === 'boolean'
                ? 'boolean'
                : typeof value === 'number'
                    ? 'number'
                    : 'string');
        // Validate value based on type
        let finalValue = String(value);
        if (inferredType === 'number') {
            const num = Number(value);
            if (isNaN(num)) {
                return reply.code(400).send({ error: `Invalid value for number type: ${value}` });
            }
            finalValue = String(num);
        }
        else if (inferredType === 'boolean') {
            const normalizedBooleanValue = typeof value === 'boolean'
                ? value
                : value === 'true'
                    ? true
                    : value === 'false'
                        ? false
                        : null;
            if (normalizedBooleanValue === null) {
                return reply.code(400).send({ error: 'Invalid value for boolean type' });
            }
            finalValue = String(normalizedBooleanValue);
        }
        const data = {
            value: finalValue,
            category: category || existing?.category || 'system',
            type: existing?.type || inferredType,
            label: label || existing?.label,
            description: description || existing?.description,
            isEncrypted: typeof isEncrypted === 'boolean' ? isEncrypted : existing?.isEncrypted || false,
            updatedBy: request.user?.id,
        };
        const updated = existing
            ? await db_1.prisma.settings.update({
                where: { key },
                data,
            })
            : await db_1.prisma.settings.create({
                data: {
                    key,
                    ...data,
                },
            });
        const sensitiveKeyPattern = /(key|secret|cert|token)/i;
        const changedSensitiveSetting = Boolean(existing) &&
            sensitiveKeyPattern.test(key) &&
            existing?.value !== data.value;
        if (changedSensitiveSetting) {
            await (0, securityCompliance_1.logKeyRotation)({
                component: `settings:${key}`,
                oldKeyVersion: 'previous',
                newKeyVersion: 'updated',
                actorId: request.user?.id,
                details: {
                    category: data.category,
                    updatedBy: request.user?.id,
                },
            }).catch((error) => {
                logger_1.logger.error({ error }, 'Failed to persist key rotation log');
            });
            await (0, securityCompliance_1.logSecurityEventRecord)({
                eventType: client_1.SecurityEventType.KEY_ROTATION,
                severity: client_1.SecuritySeverity.MEDIUM,
                source: 'settings/update',
                message: `Sensitive setting updated: ${key}`,
                details: {
                    key,
                    category: data.category,
                },
                actorId: request.user?.id,
                ipAddress: request.ip,
            }).catch((error) => {
                logger_1.logger.error({ error }, 'Failed to persist key rotation security event');
            });
        }
        return reply.code(existing ? 200 : 201).send({
            ...updated,
            value: updated.isEncrypted ? '***ENCRYPTED***' : updated.value,
        });
    });
    // POST batch update multiple settings
    fastify.post('/api/settings/batch', {
        preHandler: [authMiddleware_1.requireAuth, requireManagerRole],
        schema: {
            body: {
                type: 'object',
                required: ['settings'],
                properties: {
                    settings: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['key', 'value'],
                            properties: {
                                key: { type: 'string' },
                                value: { anyOf: [{ type: 'boolean' }, { type: 'number' }, { type: 'string' }] },
                            },
                        },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { settings: updates } = request.body;
        const results = [];
        for (const update of updates) {
            try {
                const existing = await db_1.prisma.settings.findUnique({
                    where: { key: update.key },
                });
                if (!existing) {
                    results.push({
                        key: update.key,
                        success: false,
                        error: 'Setting not found',
                    });
                    continue;
                }
                let finalValue = String(update.value);
                if (existing.type === 'number') {
                    const num = Number(update.value);
                    if (isNaN(num)) {
                        results.push({
                            key: update.key,
                            success: false,
                            error: `Invalid value for number type`,
                        });
                        continue;
                    }
                    finalValue = String(num);
                }
                else if (existing.type === 'boolean') {
                    const normalizedBooleanValue = typeof update.value === 'boolean'
                        ? update.value
                        : update.value === 'true'
                            ? true
                            : update.value === 'false'
                                ? false
                                : null;
                    if (normalizedBooleanValue === null) {
                        results.push({
                            key: update.key,
                            success: false,
                            error: 'Invalid value for boolean type',
                        });
                        continue;
                    }
                    finalValue = String(normalizedBooleanValue);
                }
                const updated = await db_1.prisma.settings.update({
                    where: { key: update.key },
                    data: {
                        value: finalValue,
                        updatedBy: request.user?.id,
                    },
                });
                results.push({
                    key: update.key,
                    success: true,
                    data: {
                        ...updated,
                        value: updated.isEncrypted ? '***ENCRYPTED***' : updated.value,
                    },
                });
            }
            catch (error) {
                results.push({
                    key: update.key,
                    success: false,
                    error: error.message,
                });
            }
        }
        return { results };
    });
    // POST create a new setting (admin only - seeding)
    fastify.post('/api/settings', {
        preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')],
        schema: {
            body: {
                type: 'object',
                required: ['key', 'value', 'category'],
                properties: {
                    key: { type: 'string' },
                    value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
                    category: { type: 'string' },
                    type: { type: 'string', enum: ['string', 'number', 'boolean', 'json'] },
                    label: { type: 'string' },
                    description: { type: 'string' },
                    isEncrypted: { type: 'boolean' },
                },
            },
        },
    }, async (request, reply) => {
        const user = request.user;
        const { key, value, category, type = 'string', label, description, isEncrypted = false } = request.body;
        const existing = await db_1.prisma.settings.findUnique({
            where: { key },
        });
        if (existing) {
            return reply.code(409).send({ error: 'Setting with this key already exists' });
        }
        const setting = await db_1.prisma.settings.create({
            data: {
                key,
                value: String(value),
                category,
                type,
                label,
                description,
                isEncrypted,
                updatedBy: user.id,
            },
        });
        return {
            ...setting,
            value: setting.isEncrypted ? '***ENCRYPTED***' : setting.value,
        };
    });
    // DELETE a setting (admin only)
    fastify.delete('/api/settings/:key', {
        preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')],
        schema: {
            params: {
                type: 'object',
                required: ['key'],
                properties: { key: { type: 'string' } },
            },
        },
    }, async (request, reply) => {
        const { key } = request.params;
        const deleted = await db_1.prisma.settings.delete({
            where: { key },
        });
        return { success: true, deleted: deleted.key };
    });
    // TAX RATES ENDPOINTS
    // GET all tax rates
    fastify.get('/api/settings/tax-rates', { preHandler: [authMiddleware_1.requireAuth, requireManagerRole] }, async (request, reply) => {
        const rates = await db_1.prisma.taxRate.findMany({
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
        return rates;
    });
    // GET tax rate by id
    fastify.get('/api/settings/tax-rates/:id', { preHandler: [authMiddleware_1.requireAuth, requireManagerRole] }, async (request, reply) => {
        const { id } = request.params;
        const rate = await db_1.prisma.taxRate.findUnique({
            where: { id },
        });
        return rate || { error: 'Tax rate not found' };
    });
    // POST create tax rate
    fastify.post('/api/settings/tax-rates', {
        preHandler: [authMiddleware_1.requireAuth, requireManagerRole],
        schema: {
            body: {
                type: 'object',
                required: ['name', 'rate'],
                properties: {
                    name: { type: 'string' },
                    rate: { type: 'number', minimum: 0, maximum: 100 },
                    location: { type: 'string' },
                    description: { type: 'string' },
                    isActive: { type: 'boolean' },
                    isDefault: { type: 'boolean' },
                },
            },
        },
    }, async (request, reply) => {
        const { name, rate, location, description, isActive = true, isDefault = false } = request.body;
        // If setting as default, unset other defaults
        if (isDefault) {
            await db_1.prisma.taxRate.updateMany({
                where: { isDefault: true },
                data: { isDefault: false },
            });
        }
        const taxRate = await db_1.prisma.taxRate.create({
            data: {
                name,
                rate,
                location,
                description,
                isActive,
                isDefault,
            },
        });
        return taxRate;
    });
    // PUT update tax rate
    fastify.put('/api/settings/tax-rates/:id', {
        preHandler: [authMiddleware_1.requireAuth, requireManagerRole],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } },
            },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    rate: { type: 'number', minimum: 0, maximum: 100 },
                    location: { type: 'string' },
                    description: { type: 'string' },
                    isActive: { type: 'boolean' },
                    isDefault: { type: 'boolean' },
                },
            },
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const { name, rate, location, description, isActive, isDefault } = request.body;
        // If setting as default, unset other defaults
        if (isDefault) {
            await db_1.prisma.taxRate.updateMany({
                where: { id: { not: id } },
                data: { isDefault: false },
            });
        }
        const taxRate = await db_1.prisma.taxRate.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(rate !== undefined && { rate }),
                ...(location !== undefined && { location }),
                ...(description !== undefined && { description }),
                ...(isActive !== undefined && { isActive }),
                ...(isDefault !== undefined && { isDefault }),
            },
        });
        return taxRate;
    });
    // DELETE tax rate
    fastify.delete('/api/settings/tax-rates/:id', {
        preHandler: [authMiddleware_1.requireAuth, requireManagerRole],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } },
            },
        },
    }, async (request, reply) => {
        const { id } = request.params;
        await db_1.prisma.taxRate.delete({
            where: { id },
        });
        return { success: true };
    });
    // TAX EXEMPTIONS ENDPOINTS
    // GET all tax exemptions
    fastify.get('/api/settings/tax-exemptions', { preHandler: [authMiddleware_1.requireAuth, requireManagerRole] }, async (request, reply) => {
        const exemptions = await db_1.prisma.taxExemption.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        return exemptions;
    });
    // POST create tax exemption
    fastify.post('/api/settings/tax-exemptions', {
        preHandler: [authMiddleware_1.requireAuth, requireManagerRole],
        schema: {
            body: {
                type: 'object',
                required: ['reason'],
                properties: {
                    category: { type: 'string' },
                    productId: { type: 'string' },
                    reason: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        const { category, productId, reason } = request.body;
        const exemption = await db_1.prisma.taxExemption.create({
            data: {
                category,
                productId,
                reason,
                isActive: true,
            },
        });
        return exemption;
    });
    // DELETE tax exemption
    fastify.delete('/api/settings/tax-exemptions/:id', {
        preHandler: [authMiddleware_1.requireAuth, requireManagerRole],
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } },
            },
        },
    }, async (request, reply) => {
        const { id } = request.params;
        await db_1.prisma.taxExemption.update({
            where: { id },
            data: { isActive: false },
        });
        return { success: true };
    });
}
