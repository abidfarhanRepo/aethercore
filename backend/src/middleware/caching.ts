import { FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * HTTP cache headers middleware
 * Implements Cache-Control, ETag, Last-Modified
 * Enables 304 Not Modified responses
 */

export interface CacheHeaderOptions {
  maxAge?: number; // seconds
  isPrivate?: boolean;
  isImmutable?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  sMaxAge?: number; // Shared cache max age (CDN)
}

export async function cacheHeadersMiddleware(fastify: any) {
  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    try {
      // Don't cache if already has cache headers
      if (reply.getHeader('cache-control')) {
        return payload;
      }

      // Generate ETag from payload
      const etagValue = generateETag(payload);
      reply.header('etag', etagValue);

      // Set default cache headers based on response type
      const contentType = reply.getHeader('content-type') as string;
      const method = request.method;
      const path = request.url;

      if (method === 'GET') {
        if (contentType?.includes('application/json')) {
          // API responses: cache privately for 5 minutes
          reply.header('cache-control', 'private, max-age=300');
        } else if (contentType?.includes('text/html')) {
          // HTML: cache for 1 hour
          reply.header('cache-control', 'public, max-age=3600');
        } else if (contentType?.includes('javascript') || contentType?.includes('css')) {
          // Static assets: cache for 1 year (with content hash)
          reply.header('cache-control', 'public, max-age=31536000, immutable');
        } else if (contentType?.includes('image/')) {
          // Images: cache for 1 week
          reply.header('cache-control', 'public, max-age=604800');
        } else {
          // Default: cache for 1 hour
          reply.header('cache-control', 'public, max-age=3600');
        }
      } else {
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
    } catch (error) {
      logger.error('Cache headers middleware error:', error);
      return payload;
    }
  });
}

/**
 * Generate ETag from payload
 */
function generateETag(payload: any): string {
  const data =
    typeof payload === 'string' ? payload : JSON.stringify(payload);
  return `"${crypto.createHash('md5').update(data).digest('hex')}"`;
}

/**
 * Set cache headers for a specific response
 */
export function setCacheHeaders(
  reply: FastifyReply,
  options: CacheHeaderOptions
): void {
  const parts: string[] = [];

  if (options.isPrivate) {
    parts.push('private');
  } else {
    parts.push('public');
  }

  if (options.noStore) {
    parts.push('no-store');
  } else if (options.noCache) {
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
export async function cacheListResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  data: any,
  maxAge: number = 300
): Promise<boolean> {
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
export function setStaleWhileRevalidateHeaders(
  reply: FastifyReply,
  maxAge: number = 300,
  staleTime: number = 86400
): void {
  setCacheHeaders(reply, {
    isPrivate: false,
    maxAge,
  });

  reply.header(
    'cache-control',
    `public, max-age=${maxAge}, stale-while-revalidate=${staleTime}`
  );
}

/**
 * Conditional headers decorator
 * Apply to routes for automatic cache handling
 */
export function cacheDecorator(maxAge: number = 300) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const result = originalMethod.apply(this, args);

      // If it's a promise
      if (result && typeof result.then === 'function') {
        return result.then((response: any) => {
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
