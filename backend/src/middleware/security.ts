/**
 * Security headers middleware using Helmet.js
 * Implements OWASP security recommendations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fastifyHelmet from '@fastify/helmet'

/**
 * Configure security headers using Helmet
 */
export async function registerSecurityHeaders(fastify: FastifyInstance): Promise<void> {
  // Register Helmet with comprehensive security settings
  await fastify.register(fastifyHelmet, {
    // Content Security Policy - prevent XSS and injection attacks
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust for your needs
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // Cross-origin embedder policy
    crossOriginEmbedderPolicy: { 
      // Disabled by default, enable if needed for specific use cases
      policy: 'require-corp'
    },
    // Disable cross-origin resource sharing for opaque responses
    crossOriginOpenerPolicy: {
      policy: 'same-origin',
    },
    // Prevent MIME-type sniffing
    noSniff: true,
    // Enable XSS filter in browser
    xssFilter: {
      mode: 'block',
    },
    // Prevent clickjacking attacks
    frameguard: {
      action: 'deny',
    },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // Strict Transport Security - require HTTPS
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },
    // Referrer Policy - control how much referrer information is shared
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    // Disable DNS prefetching
    dnsPrefetchControl: {
      allow: false,
    },
    // Disable caching for sensitive responses
    noCache: false, // Let app control caching
  })
}

/**
 * Additional security headers middleware
 */
export async function additionalSecurityHeaders(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Remove server header to avoid revealing technology stack
  reply.removeHeader('server')
  reply.header('Server', 'Aether')
  
  // Disable client caching for sensitive endpoints
  if (request.url.includes('/auth') || request.url.includes('/payments')) {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
    reply.header('Pragma', 'no-cache')
    reply.header('Expires', '0')
  }
  
  // Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production' && request.protocol !== 'https') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  
  // Prevent browsers from MIME-sniffing
  reply.header('X-Content-Type-Options', 'nosniff')
  
  // XSS Protection
  reply.header('X-XSS-Protection', '1; mode=block')
  
  // Disable feature policy for sensitive features
  reply.header(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
  )
  
  // Tell browser not to follow links with rel="noopener"
  reply.header('X-Frame-Options', 'DENY')
}

/**
 * HTTPS redirect middleware (for production)
 */
export async function enforceHTTPS(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (process.env.NODE_ENV === 'production' && request.protocol !== 'https') {
    const url = `https://${request.hostname}${request.url}`
    reply.redirect(301, url)
  }
}

/**
 * Disable dangerous HTTP methods
 */
export async function disableDangerousMethods(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const dangerousMethods = ['TRACE', 'CONNECT']
  
  if (dangerousMethods.includes(request.method)) {
    reply.code(405).send({
      error: 'Method not allowed',
      message: `${request.method} not allowed`,
    })
  }
}

/**
 * Configure HTTPS/TLS settings
 */
export interface TLSConfig {
  key: Buffer
  cert: Buffer
}

/**
 * Validate TLS version (use TLS 1.2+)
 */
export function validateTLSVersion(tlsVersion: string): boolean {
  const validVersions = ['TLSv1.2', 'TLSv1.3']
  return validVersions.includes(tlsVersion)
}

/**
 * Security headers configuration test helper
 */
export function getSecurityHeadersConfig() {
  return {
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    dnsPrefetchControl: true,
    frameguard: true,
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: true,
    xssFilter: true,
  }
}
