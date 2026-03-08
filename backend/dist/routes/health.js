"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = healthRoutes;
const ioredis_1 = __importDefault(require("ioredis"));
const db_1 = require("../utils/db");
const securityCompliance_1 = require("../lib/securityCompliance");
async function checkDatabase() {
    const startedAt = Date.now();
    try {
        await db_1.prisma.$queryRaw `SELECT 1`;
        return {
            ok: true,
            latencyMs: Date.now() - startedAt,
        };
    }
    catch (error) {
        return {
            ok: false,
            latencyMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : 'Database check failed',
        };
    }
}
async function checkRedis() {
    const startedAt = Date.now();
    const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
        lazyConnect: true,
        connectTimeout: 1500,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
    });
    try {
        await redis.connect();
        const pong = await redis.ping();
        return {
            ok: pong === 'PONG',
            latencyMs: Date.now() - startedAt,
            pong,
        };
    }
    catch (error) {
        return {
            ok: false,
            latencyMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : 'Redis check failed',
        };
    }
    finally {
        await redis.quit().catch(() => undefined);
    }
}
async function healthRoutes(fastify) {
    fastify.get('/api/v1/health', async (req, reply) => {
        const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
        let securitySummary;
        try {
            const status = await (0, securityCompliance_1.collectAndPersistSecurityStatus)(req);
            securitySummary = {
                status: status.status,
                httpsEnforced: status.https.enforced,
                tlsConfigured: status.tls.keyPath.configured && status.tls.certPath.configured,
                checkedAt: status.checkedAt.toISOString(),
                notes: status.notes,
            };
        }
        catch (error) {
            securitySummary = {
                status: 'error',
                httpsEnforced: false,
                tlsConfigured: false,
                checkedAt: new Date().toISOString(),
                notes: [error instanceof Error ? error.message : 'Failed to compute security summary'],
            };
        }
        const statusCode = database.ok ? 200 : 503;
        return reply.code(statusCode).send({
            status: database.ok && redis.ok ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            checks: {
                database,
                redis,
                security: securitySummary,
            },
        });
    });
}
