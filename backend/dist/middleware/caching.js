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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheHeadersMiddleware = cacheHeadersMiddleware;
exports.setCacheHeaders = setCacheHeaders;
exports.cacheListResponse = cacheListResponse;
exports.setStaleWhileRevalidateHeaders = setStaleWhileRevalidateHeaders;
exports.cacheDecorator = cacheDecorator;
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
async function cacheHeadersMiddleware(fastify) {
    fastify.addHook('onSend', async (request, reply, payload) => {
        try {
            // Don't cache if already has cache headers
            if (reply.getHeader('cache-control')) {
                return payload;
            }
            // Generate ETag from payload
            const etagValue = generateETag(payload);
            reply.header('etag', etagValue);
            // Set default cache headers based on response type
            const contentType = reply.getHeader('content-type');
            const method = request.method;
            const path = request.url;
            if (method === 'GET') {
                if (contentType?.includes('application/json')) {
                    // API responses: cache privately for 5 minutes
                    reply.header('cache-control', 'private, max-age=300');
                }
                else if (contentType?.includes('text/html')) {
                    // HTML: cache for 1 hour
                    reply.header('cache-control', 'public, max-age=3600');
                }
                else if (contentType?.includes('javascript') || contentType?.includes('css')) {
                    // Static assets: cache for 1 year (with content hash)
                    reply.header('cache-control', 'public, max-age=31536000, immutable');
                }
                else if (contentType?.includes('image/')) {
                    // Images: cache for 1 week
                    reply.header('cache-control', 'public, max-age=604800');
                }
                else {
                    // Default: cache for 1 hour
                    reply.header('cache-control', 'public, max-age=3600');
                }
            }
            else {
                // POST, PUT, DELETE: don't cache
                reply.header('cache-control', 'no-cache, no-store, must-revalidate');
            }
            // Check If-None-Match (ETag)
            const ifNoneMatch = request.headers['if-none-match'];
            if (ifNoneMatch === etagValue) {
                reply.code(304);
                return;
            }
            return payload;
        }
        catch (error) {
            logger_1.logger.error('Cache headers middleware error:', error);
            return payload;
        }
    });
}
/**
 * Generate ETag from payload
 */
function generateETag(payload) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return `"${crypto.createHash('md5').update(data).digest('hex')}"`;
}
/**
 * Set cache headers for a specific response
 */
function setCacheHeaders(reply, options) {
    const parts = [];
    if (options.isPrivate) {
        parts.push('private');
    }
    else {
        parts.push('public');
    }
    if (options.noStore) {
        parts.push('no-store');
    }
    else if (options.noCache) {
        parts.push('no-cache');
    }
    if (options.maxAge !== undefined) {
        parts.push(`max-age=${options.maxAge}`);
    }
    if (options.sMaxAge !== undefined) {
        parts.push(`s-maxage=${options.sMaxAge}`);
    }
    if (options.mustRevalidate) {
        parts.push('must-revalidate');
    }
    if (options.isImmutable) {
        parts.push('immutable');
    }
    reply.header('cache-control', parts.join(', '));
}
/**
 * Cache list responses with ETags
 * Returns true if response was sent (304), false otherwise
 */
async function cacheListResponse(request, reply, data, maxAge = 300) {
    const etagValue = generateETag(data);
    // Check If-None-Match
    const ifNoneMatch = request.headers['if-none-match'];
    if (ifNoneMatch === etagValue) {
        reply.code(304);
        return true;
    }
    reply.header('etag', etagValue);
    setCacheHeaders(reply, {
        isPrivate: false,
        maxAge,
        sMaxAge: Math.floor(maxAge / 2), // CDN cache half as long
    });
    return false;
}
/**
 * Stale-while-revalidate pattern
 * Returns cached data while fetching fresh data in background
 */
function setStaleWhileRevalidateHeaders(reply, maxAge = 300, staleTime = 86400) {
    setCacheHeaders(reply, {
        isPrivate: false,
        maxAge,
    });
    reply.header('cache-control', `public, max-age=${maxAge}, stale-while-revalidate=${staleTime}`);
}
/**
 * Conditional headers decorator
 * Apply to routes for automatic cache handling
 */
function cacheDecorator(maxAge = 300) {
    return (target, propertyKey, descriptor) => {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            const result = originalMethod.apply(this, args);
            // If it's a promise
            if (result && typeof result.then === 'function') {
                return result.then((response) => {
                    const reply = args[args.length - 1];
                    if (reply?.header) {
                        setCacheHeaders(reply, { isPrivate: false, maxAge });
                    }
                    return response;
                });
            }
            return result;
        };
        return descriptor;
    };
}
