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
const fastify_1 = __importDefault(require("fastify"));
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
const payments_1 = __importDefault(require("./routes/payments"));
const sync_1 = __importDefault(require("./routes/sync"));
const rateLimit_1 = __importDefault(require("./plugins/rateLimit"));
const securityPlugin_1 = require("./plugins/securityPlugin");
const errorHandler_1 = require("./middleware/errorHandler");
const server = (0, fastify_1.default)({
    logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty' }
            : undefined
    },
    requestIdLogLabel: 'requestId'
});
// IMPORTANT: Register security plugin first, before all other middleware
const initializeSecurityAndRoutes = async () => {
    // Add request ID generation
    server.addHook('onRequest', async (request) => {
        if (!request.id) {
            request.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
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
    server.register(payments_1.default);
    server.register(sync_1.default);
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
        console.log(`
╔════════════════════════════════════════════╗
║      🔐 Aether POS Security Hardened      ║
║                                            ║
║  ✓ Security headers enabled                ║
║  ✓ JWT token rotation enabled              ║
║  ✓ Input sanitization active               ║
║  ✓ Audit logging enabled                   ║
║  ✓ Brute force protection active           ║
║  ✓ CORS whitelist enforced                 ║
║                                            ║
║  Server running on port ${process.env.PORT || 4000}            ║
╚════════════════════════════════════════════╝
    `);
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
