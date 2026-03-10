"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = securityRoutes;
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../plugins/authMiddleware");
const securityCompliance_1 = require("../lib/securityCompliance");
const alertService_1 = require("../lib/alertService");
const notificationService_1 = require("../lib/notificationService");
const db_1 = require("../utils/db");
const ALLOWED_ROTATION_COMPONENTS = new Set(['jwt_access', 'jwt_refresh', 'encryption', 'tls', 'settings']);
async function securityRoutes(fastify) {
    fastify.get('/api/v1/security/status', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN', 'MANAGER')] }, async (req, reply) => {
        try {
            const status = await (0, securityCompliance_1.collectAndPersistSecurityStatus)(req);
            return status;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const actorId = req.user?.id;
            await (0, securityCompliance_1.logSecurityEventRecord)({
                eventType: client_1.SecurityEventType.SECURITY_STATUS_CHECK_FAILED,
                severity: client_1.SecuritySeverity.HIGH,
                source: 'api/security/status',
                message: 'Security status check failed',
                details: { error: message },
                actorId,
                ipAddress: req.ip,
            }).catch((eventError) => {
                req.log.error({ err: eventError }, 'Failed to persist security status failure event');
            });
            await (0, notificationService_1.createSecurityStatusFailureNotification)(message, actorId).catch((notificationError) => {
                req.log.error({ err: notificationError }, 'Failed to persist security status failure notification');
            });
            return reply.code(500).send({
                error: 'Failed to collect security status',
                details: message,
            });
        }
    });
    fastify.get('/api/v1/security/events', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN', 'MANAGER')] }, async (req, reply) => {
        const query = (req.query || {});
        const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200);
        try {
            const events = await db_1.prisma.securityEvent.findMany({
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
            return {
                items: events,
                meta: { limit, count: events.length },
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return reply.code(500).send({ error: 'Failed to fetch security events', details: message });
        }
    });
    fastify.post('/api/v1/security/events', { preHandler: [authMiddleware_1.requireAuth] }, async (req, reply) => {
        const body = (req.body || {});
        if (!body.type || !body.severity || !body.timestamp || typeof body.context !== 'object') {
            return reply.code(400).send({
                error: 'Invalid payload. Required fields: type, severity, context, timestamp',
            });
        }
        const severityMap = {
            low: client_1.SecuritySeverity.LOW,
            medium: client_1.SecuritySeverity.MEDIUM,
            high: client_1.SecuritySeverity.HIGH,
        };
        if (!severityMap[body.severity]) {
            return reply.code(400).send({ error: 'severity must be low, medium, or high' });
        }
        const eventTypeMap = {
            'auth.login_failed': client_1.SecurityEventType.FAILED_LOGIN,
            'auth.mfa_failed': client_1.SecurityEventType.MFA_FAILED,
            'authz.capability_denied': client_1.SecurityEventType.CAPABILITY_DENIED,
            'session.idle_lock': client_1.SecurityEventType.IDLE_LOCK,
        };
        const eventType = eventTypeMap[body.type] || client_1.SecurityEventType.UNKNOWN;
        try {
            const event = await (0, securityCompliance_1.logSecurityEventRecord)({
                eventType,
                severity: severityMap[body.severity],
                source: `frontend/${body.type}`,
                message: `Client security event: ${body.type}`,
                details: {
                    type: body.type,
                    context: body.context,
                    timestamp: body.timestamp,
                },
                actorId: req.user?.id,
                ipAddress: req.ip,
            });
            return reply.code(201).send({ id: event.id, createdAt: event.createdAt });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return reply.code(500).send({ error: 'Failed to persist security event', details: message });
        }
    });
    fastify.get('/api/v1/security/key-rotations', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN', 'MANAGER')] }, async (req, reply) => {
        const query = (req.query || {});
        const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200);
        try {
            const rotations = await db_1.prisma.keyRotationLog.findMany({
                orderBy: { rotatedAt: 'desc' },
                take: limit,
            });
            return {
                items: rotations,
                meta: { limit, count: rotations.length },
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return reply.code(500).send({ error: 'Failed to fetch key rotation logs', details: message });
        }
    });
    fastify.post('/api/v1/security/rotate-keys', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')] }, async (req, reply) => {
        const body = (req.body || {});
        const actorId = req.user?.id;
        if (!body.component || !ALLOWED_ROTATION_COMPONENTS.has(body.component)) {
            return reply.code(400).send({
                error: 'Invalid component',
                allowedComponents: Array.from(ALLOWED_ROTATION_COMPONENTS),
            });
        }
        if (!body.newVersion?.trim()) {
            return reply.code(400).send({ error: 'newVersion is required' });
        }
        try {
            const latestForComponent = await db_1.prisma.keyRotationLog.findFirst({
                where: { component: body.component },
                orderBy: { rotatedAt: 'desc' },
            });
            const rotation = await (0, securityCompliance_1.logKeyRotation)({
                component: body.component,
                oldKeyVersion: latestForComponent?.newKeyVersion || undefined,
                newKeyVersion: body.newVersion,
                status: 'success',
                details: {
                    notes: body.notes || null,
                    requiresManualEnvUpdate: true,
                    requiresRedeploy: true,
                },
                actorId,
            });
            await (0, securityCompliance_1.logSecurityEventRecord)({
                eventType: client_1.SecurityEventType.KEY_ROTATION,
                severity: client_1.SecuritySeverity.MEDIUM,
                source: 'api/security/rotate-keys',
                message: `Key rotation logged for ${body.component}`,
                details: {
                    component: body.component,
                    oldKeyVersion: latestForComponent?.newKeyVersion || null,
                    newVersion: body.newVersion,
                    notes: body.notes || null,
                    requiresManualEnvUpdate: true,
                    requiresRedeploy: true,
                },
                actorId,
                ipAddress: req.ip,
            });
            await (0, notificationService_1.createKeyRotationNotification)({
                component: body.component,
                status: 'success',
                actorId,
                details: {
                    oldKeyVersion: latestForComponent?.newKeyVersion || null,
                    newVersion: body.newVersion,
                    notes: body.notes || null,
                },
            });
            return reply.code(201).send({
                message: 'Rotation has been logged. Apply the new secret/certificate in your secret provider, then redeploy affected services to activate it.',
                actionRequired: [
                    'Update secret provider value (K8s Secret / vault / CI secret).',
                    'Roll backend/frontend deployments that consume this secret.',
                    'Verify /api/v1/security/status and /api/v1/health after rollout.',
                ],
                rotation,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            await (0, securityCompliance_1.logSecurityEventRecord)({
                eventType: client_1.SecurityEventType.KEY_ROTATION,
                severity: client_1.SecuritySeverity.HIGH,
                source: 'api/security/rotate-keys',
                message: 'Key rotation attempt failed',
                details: {
                    component: body.component,
                    error: message,
                },
                actorId,
                ipAddress: req.ip,
            }).catch(() => { });
            await (0, notificationService_1.createKeyRotationNotification)({
                component: body.component || 'unknown',
                status: 'failed',
                actorId,
                details: { error: message },
            }).catch(() => { });
            return reply.code(500).send({
                error: 'Failed to rotate keys',
                details: message,
            });
        }
    });
    fastify.get('/api/v1/security/backup-drills', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN', 'MANAGER')] }, async (req, reply) => {
        const query = (req.query || {});
        const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200);
        try {
            const rawEvents = await db_1.prisma.securityEvent.findMany({
                where: {
                    OR: [
                        { source: 'api/security/backup-drills' },
                        { source: 'cli/security/backup-drills' },
                    ],
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
            const items = rawEvents.filter((event) => {
                const details = (event.details || {});
                const drillType = typeof details.drillType === 'string' ? details.drillType : undefined;
                const status = typeof details.status === 'string' ? details.status : undefined;
                if (query.drillType && drillType !== query.drillType) {
                    return false;
                }
                if (query.status && status !== query.status) {
                    return false;
                }
                return true;
            });
            return {
                items,
                meta: { limit, count: items.length },
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return reply.code(500).send({
                error: 'Failed to fetch backup drill history',
                details: message,
            });
        }
    });
    fastify.post('/api/v1/security/backup-drills/simulate-restore', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')] }, async (req, reply) => {
        const actorId = req.user?.id;
        const body = (req.body || {});
        if (process.env.NODE_ENV === 'production') {
            return reply.code(403).send({
                error: 'Restore simulation is blocked in production environments',
            });
        }
        const drillId = `restore-sim-${Date.now()}`;
        const snapshotId = body.snapshotId || 'latest-backup';
        const startedAt = Date.now();
        try {
            await (0, securityCompliance_1.logBackupDrillEvent)({
                drillId,
                drillType: 'weekly_restore_simulation',
                eventKind: 'RESTORE_SIMULATION_INITIATED',
                status: 'in_progress',
                summary: `Restore simulation initiated from snapshot ${snapshotId}`,
                details: {
                    snapshotId,
                    environment: process.env.NODE_ENV || 'development',
                },
                actorId,
                ipAddress: req.ip,
            });
            await db_1.prisma.$queryRaw `SELECT 1`;
            const [saleCount, productCount, userCount] = await Promise.all([
                db_1.prisma.sale.count(),
                db_1.prisma.product.count(),
                db_1.prisma.user.count(),
            ]);
            const totalRecords = saleCount + productCount + userCount;
            if (typeof body.expectedMinRecords === 'number' && totalRecords < body.expectedMinRecords) {
                throw new Error(`Record validation failed. total=${totalRecords}, expectedMin=${body.expectedMinRecords}`);
            }
            if (body.simulateFailure === true) {
                throw new Error('Forced failure requested by simulateFailure=true');
            }
            const durationMs = Date.now() - startedAt;
            await (0, securityCompliance_1.logBackupDrillEvent)({
                drillId,
                drillType: 'weekly_restore_simulation',
                eventKind: 'RESTORE_SIMULATION_COMPLETED',
                status: 'completed',
                summary: 'Restore simulation completed successfully',
                details: {
                    snapshotId,
                    durationMs,
                    counts: {
                        sales: saleCount,
                        products: productCount,
                        users: userCount,
                    },
                    dataValidated: true,
                },
                actorId,
                ipAddress: req.ip,
            });
            return reply.send({
                drillId,
                status: 'completed',
                snapshotId,
                durationMs,
                counts: {
                    sales: saleCount,
                    products: productCount,
                    users: userCount,
                },
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            await (0, securityCompliance_1.logBackupDrillEvent)({
                drillId,
                drillType: 'weekly_restore_simulation',
                eventKind: 'RESTORE_SIMULATION_FAILED',
                status: 'failed',
                summary: `Restore simulation failed: ${message}`,
                details: {
                    snapshotId,
                    error: message,
                },
                actorId,
                ipAddress: req.ip,
            }).catch(() => { });
            return reply.code(500).send({
                error: 'Restore simulation failed',
                details: message,
                drillId,
            });
        }
    });
    fastify.get('/api/v1/security/alert-rules', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN', 'MANAGER')] }, async (_req, reply) => {
        try {
            const config = await (0, alertService_1.getAlertRulesConfig)();
            return { config };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return reply.code(500).send({ error: 'Failed to fetch alert rules', details: message });
        }
    });
    fastify.put('/api/v1/security/alert-rules', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN')] }, async (req, reply) => {
        const body = (req.body || {});
        try {
            const config = await (0, alertService_1.saveAlertRulesConfig)(body, req.user?.id);
            return { config };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return reply.code(500).send({ error: 'Failed to update alert rules', details: message });
        }
    });
    fastify.post('/api/v1/security/alert-rules/evaluate', { preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN', 'MANAGER')] }, async (req, reply) => {
        try {
            const evaluation = await (0, alertService_1.evaluateAlertRules)(req.user?.id, req.ip);
            return { evaluation };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return reply.code(500).send({ error: 'Failed to evaluate alert rules', details: message });
        }
    });
}
