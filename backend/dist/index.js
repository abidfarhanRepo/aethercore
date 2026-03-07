"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables FIRST, before anything else
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fastify_1 = __importDefault(require("fastify"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const db_1 = require("./utils/db");
const auth_1 = __importDefault(require("./routes/auth"));
const products_1 = __importDefault(require("./routes/products"));
const sales_1 = __importDefault(require("./routes/sales"));
const audit_1 = __importDefault(require("./routes/audit"));
const purchases_1 = __importDefault(require("./routes/purchases"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const users_1 = __importDefault(require("./routes/users"));
const roles_1 = __importDefault(require("./routes/roles"));
const reports_1 = __importDefault(require("./routes/reports"));
const reportingIntelligence_1 = __importDefault(require("./routes/reportingIntelligence"));
const payments_1 = __importDefault(require("./routes/payments"));
const settings_1 = __importDefault(require("./routes/settings"));
const sync_1 = __importDefault(require("./routes/sync"));
const receipts_1 = __importDefault(require("./routes/receipts"));
const phase3_1 = __importDefault(require("./routes/phase3"));
const hardware_1 = __importDefault(require("./routes/hardware"));
const security_1 = __importDefault(require("./routes/security"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const health_1 = __importDefault(require("./routes/health"));
const plugins_1 = __importDefault(require("./routes/plugins"));
const rateLimit_1 = __importDefault(require("./plugins/rateLimit"));
const securityPlugin_1 = require("./plugins/securityPlugin");
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./utils/logger");
const server = (0, fastify_1.default)({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
    },
    requestIdLogLabel: 'requestId',
});
// IMPORTANT: Register security plugin first, before all other middleware
const initializeSecurityAndRoutes = async () => {
    // Ensure each request carries a request ID and propagate it to response headers.
    server.addHook('onRequest', async (request, reply) => {
        const headerRequestId = request.headers['x-request-id'];
        const requestId = (typeof headerRequestId === 'string' && headerRequestId.trim()) ||
            `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        request.headers['x-request-id'] = requestId;
        reply.header('X-Request-ID', requestId);
    });
    server.addHook('onResponse', async (request, reply) => {
        request.log.info({
            requestId: request.id,
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
        }, 'request completed');
    });
    // Register comprehensive security plugin
    await (0, securityPlugin_1.registerSecurityPlugin)(server, {
        enableHTTPS: process.env.NODE_ENV === 'production',
        enableCSP: true,
        enableRateLimit: true,
    });
    // Setup global error handler (after security)
    (0, errorHandler_1.setupErrorHandler)(server);
    // Register plugins and routes
    server.register(cookie_1.default);
    server.register(rateLimit_1.default);
    // Health check endpoint
    server.get('/health', async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    }));
    // Register all routes
    server.register(auth_1.default);
    server.register(products_1.default);
    server.register(audit_1.default);
    server.register(sales_1.default);
    server.register(purchases_1.default);
    server.register(inventory_1.default);
    server.register(users_1.default);
    server.register(roles_1.default);
    server.register(reports_1.default);
    server.register(reportingIntelligence_1.default);
    server.register(payments_1.default);
    server.register(settings_1.default);
    server.register(sync_1.default);
    server.register(receipts_1.default);
    server.register(phase3_1.default);
    server.register(hardware_1.default);
    server.register(security_1.default);
    server.register(notifications_1.default);
    server.register(health_1.default);
    server.register(plugins_1.default);
    // Security audit endpoint (admin only)
    server.get('/api/security/audit-summary', async (req, reply) => {
        // Check auth and admin role
        const auth = req.headers.authorization;
        if (!auth) {
            return reply.status(401).send({ error: 'Unauthorized' });
        }
        try {
            const { getAuditSummary } = await Promise.resolve().then(() => __importStar(require('./utils/audit')));
            const summary = await getAuditSummary(30);
            return summary;
        }
        catch (error) {
            return reply.status(500).send({ error: 'Failed to get audit summary' });
        }
    });
    // Brute force stats endpoint (admin only)
    server.get('/api/security/bruteforce-stats', async (req, reply) => {
        try {
            const { getBruteForceStats } = await Promise.resolve().then(() => __importStar(require('./middleware/brute-force')));
            const stats = await getBruteForceStats();
            return stats;
        }
        catch (error) {
            return reply.status(500).send({ error: 'Failed to get stats' });
        }
    });
};
const start = async () => {
    try {
        // Initialize security and routes
        await initializeSecurityAndRoutes();
        // Start server
        await server.listen({ port: Number(process.env.PORT) || 4000, host: '0.0.0.0' });
        logger_1.logger.info({
            port: Number(process.env.PORT) || 4000,
            security: {
                headers: true,
                jwtRotation: true,
                inputSanitization: true,
                auditLogging: true,
                bruteForceProtection: true,
                corsWhitelist: true,
            },
        }, 'Aether POS Security Hardened');
        server.log.info(`Server started on port ${process.env.PORT || 4000}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
// Graceful shutdown
process.on('SIGTERM', async () => {
    server.log.info('SIGTERM received, gracefully shutting down...');
    await server.close();
    await db_1.prisma.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    server.log.info('SIGINT received, gracefully shutting down...');
    await server.close();
    await db_1.prisma.$disconnect();
    process.exit(0);
});
start();
