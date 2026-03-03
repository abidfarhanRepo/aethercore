"use strict";
/**
 * CORS configuration with origin whitelist
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCORS = registerCORS;
exports.validateCORSHeaders = validateCORSHeaders;
exports.handlePreflight = handlePreflight;
exports.getCORSConfig = getCORSConfig;
const cors_1 = __importDefault(require("@fastify/cors"));
/**
 * Parse allowed origins from environment variable
 */
function getAllowedOrigins() {
    const originsEnv = process.env.ALLOWED_ORIGINS || '';
    // Default origins for development
    const defaultOrigins = process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000'];
    if (!originsEnv) {
        return defaultOrigins;
    }
    return originsEnv
        .split(',')
        .map(origin => origin.trim())
        .filter(origin => origin.length > 0);
}
/**
 * Register CORS middleware with secure defaults
 */
async function registerCORS(fastify) {
    const allowedOrigins = getAllowedOrigins();
    if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
        console.warn('⚠️ No ALLOWED_ORIGINS configured for production. CORS will be restricted.');
    }
    await fastify.register(cors_1.default, {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps, curl requests)
            if (!origin) {
                callback(null, true);
                return;
            }
            // In production, strictly validate origin
            if (process.env.NODE_ENV === 'production') {
                if (allowedOrigins.includes(origin)) {
                    callback(null, true);
                }
                else {
                    callback(new Error('Not allowed by CORS'), false);
                }
            }
            else {
                // In development, allow all origins
                callback(null, true);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-CSRF-Token',
            'Accept',
            'Origin',
            'X-API-Key',
            'X-Request-Signature',
        ],
        exposedHeaders: [
            'Content-Type',
            'X-Request-ID',
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset',
            'X-Security-Token',
        ],
        maxAge: 7200, // 2 hours
        preflightContinue: false,
    });
}
/**
 * Validate CORS headers on each request
 */
async function validateCORSHeaders(request, reply) {
    const origin = request.headers.origin;
    if (!origin) {
        return; // No origin header, might be same-origin or mobile
    }
    const allowedOrigins = getAllowedOrigins();
    // Additional validation for sensitive endpoints
    if (request.url.includes('/auth') || request.url.includes('/payments')) {
        if (process.env.NODE_ENV === 'production' && !allowedOrigins.includes(origin)) {
            reply.code(403).send({
                error: 'CORS policy violation',
                message: 'Origin not allowed to access this resource',
            });
        }
    }
}
/**
 * Preflight request handler
 */
async function handlePreflight(request, reply) {
    if (request.method === 'OPTIONS') {
        reply.header('Access-Control-Allow-Origin', request.headers.origin || '*');
        reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        reply.header('Access-Control-Allow-Headers', request.headers['access-control-request-headers'] || 'Content-Type,Authorization');
        reply.header('Access-Control-Max-Age', '7200');
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.code(200).send();
    }
}
/**
 * Get CORS configuration for documentation
 */
function getCORSConfig() {
    return {
        allowedOrigins: getAllowedOrigins(),
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-CSRF-Token',
        ],
        credentials: true,
        maxAge: 7200,
    };
}
