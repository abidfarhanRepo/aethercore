import { FastifyRequest, FastifyReply } from 'fastify';
import { createGzip, createBrotliCompress, constants as zlibConstants } from 'zlib';
import { logger } from '../utils/logger';

// Minimum size before compressing (1KB)
const MIN_COMPRESS_SIZE = 1024;

// Content types to compress
const COMPRESSIBLE_TYPES = [
  'application/json',
  'application/javascript',
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'application/xml',
  'application/xml+rss',
  'text/javascript',
  'application/typescript',
  'text/typescript',
  'application/x-www-form-urlencoded',
];

// Content types to exclude (already compressed)
const EXCLUDE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'application/zip',
  'application/gzip',
  'application/pdf',
  'font/woff',
  'font/woff2',
  'font/ttf',
];

/**
 * Check if response should be compressed
 */
function shouldCompress(
  contentType?: string,
  contentLength?: number
): boolean {
  if (!contentType || !contentLength) {
    return false;
  }

  // Don't compress if below threshold
  if (contentLength < MIN_COMPRESS_SIZE) {
    return false;
  }

  // Don't compress excluded types
  if (EXCLUDE_TYPES.some((type) => contentType.includes(type))) {
    return false;
  }

  // Compress if in compressible list
  return COMPRESSIBLE_TYPES.some((type) => contentType.includes(type));
}

/**
 * Get best compression method supported by client
 */
function getCompressionMethod(acceptEncoding?: string): 'gzip' | 'br' | null {
  if (!acceptEncoding) {
    return null;
  }

  // Prefer brotli if supported (better compression)
  if (acceptEncoding.includes('br')) {
    return 'br';
  }

  // Fall back to gzip
  if (acceptEncoding.includes('gzip')) {
    return 'gzip';
  }

  return null;
}

/**
 * Fastify compression middleware plugin
 * Automatically compresses responses based on client support and content type
 */
export async function compressionMiddleware(
  fastify: any,
  options?: { level?: number; threshold?: number }
) {
  const compressionLevel = options?.level || 6; // 1-9, default 6
  const threshold = options?.threshold || MIN_COMPRESS_SIZE;

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    try {
      // Check if we should compress
      const contentType = reply.getHeader('content-type') as string;
      const contentLength = reply.getHeader('content-length') as number;

      if (!shouldCompress(contentType, contentLength || (payload?.length || 0))) {
        return payload;
      }

      const compressionMethod = getCompressionMethod(
        request.headers['accept-encoding'] as string
      );

      if (!compressionMethod) {
        return payload;
      }

      // Convert payload to buffer if needed
      let buffer: Buffer;
      if (typeof payload === 'string') {
        buffer = Buffer.from(payload);
      } else if (Buffer.isBuffer(payload)) {
        buffer = payload;
      } else if (payload?.toString) {
        buffer = Buffer.from(payload.toString());
      } else {
        return payload;
      }

      // Skip if payload is too small
      if (buffer.length < threshold) {
        return payload;
      }

      return new Promise((resolve, reject) => {
        const startTime = Date.now();

        if (compressionMethod === 'gzip') {
          const gzip = createGzip({ level: compressionLevel });
          const chunks: Buffer[] = [];

          gzip.on('data', (chunk) => chunks.push(chunk));
          gzip.on('end', () => {
            const compressed = Buffer.concat(chunks);
            const ratio = ((1 - compressed.length / buffer.length) * 100).toFixed(2);
            const duration = Date.now() - startTime;

            reply.header('content-encoding', 'gzip');
            reply.removeHeader('content-length');

            logger.debug(
              `Compressed response: ${buffer.length}B -> ${compressed.length}B (${ratio}%) in ${duration}ms`
            );

            resolve(compressed);
          });
          gzip.on('error', reject);
          gzip.end(buffer);
        } else {
          // Brotli compression
          const brotli = createBrotliCompress({
            params: {
              [zlibConstants.BROTLI_PARAM_LGWIN]: 22,
              [zlibConstants.BROTLI_PARAM_LGBLOCK]: 24,
              [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
            },
          });
          const chunks: Buffer[] = [];

          brotli.on('data', (chunk: Buffer) => chunks.push(chunk));
          brotli.on('end', () => {
            const compressed = Buffer.concat(chunks);
            const ratio = ((1 - compressed.length / buffer.length) * 100).toFixed(2);
            const duration = Date.now() - startTime;

            reply.header('content-encoding', 'br');
            reply.removeHeader('content-length');

            logger.debug(
              `Compressed response (brotli): ${buffer.length}B -> ${compressed.length}B (${ratio}%) in ${duration}ms`
            );

            resolve(compressed);
          });
          brotli.on('error', reject);
          brotli.end(buffer);
        }
      });
    } catch (error) {
      logger.error('Compression error:', error);
      return payload;
    }
  });
}

/**
 * Manual compression utility for specific responses
 */
export async function compressData(
  data: Buffer | string,
  method: 'gzip' | 'br' = 'gzip'
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;

    if (method === 'gzip') {
      const gzip = createGzip({ level: 6 });
      const chunks: Buffer[] = [];

      gzip.on('data', (chunk) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);
      gzip.end(buffer);
    } else {
      const brotli = createBrotliCompress();
      const chunks: Buffer[] = [];

      brotli.on('data', (chunk: Buffer) => chunks.push(chunk));
      brotli.on('end', () => resolve(Buffer.concat(chunks)));
      brotli.on('error', reject);
      brotli.end(buffer);
    }
  });
}
