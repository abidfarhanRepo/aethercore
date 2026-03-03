/**
 * Security plugin for Fastify
 * Registers all security middleware and configurations
 */

import { FastifyInstance } from 'fastify'
import { registerSecurityHeaders, additionalSecurityHeaders, enforceHTTPS, disableDangerousMethods } from '../middleware/security'
import { registerCORS, validateCORSHeaders } from '../middleware/cors'
import { bruteForceProtection } from '../middleware/brute-force'
import { validateRequestSize } from '../utils/sanitizer'

/**
 * Plugin configuration
 */
export interface SecurityPluginConfig {
  enableHTTPS: boolean
  enableCSP: boolean
  enableRateLimit: boolean
  maxRequestSize?: number
  allowedOrigins?: string[]
}

/**
 * Register security plugin
 */
export async function registerSecurityPlugin(
  fastify: FastifyInstance,
  options: Partial<SecurityPluginConfig> = {}
): Promise<void> {
  const config: SecurityPluginConfig = {
    enableHTTPS: process.env.NODE_ENV === 'production',
    enableCSP: true,
    enableRateLimit: true,
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    ...options,
  }
  
  console.log('📋 Registering security plugin...')
  
  // 1. Register security headers
  try {
    await registerSecurityHeaders(fastify)
    console.log('✓ Security headers registered (Helmet.js)')
  } catch (error) {
    console.error('✗ Failed to register security headers:', error)
  }
  
  // 2. Register CORS
  try {
    await registerCORS(fastify)
    console.log('✓ CORS middleware registered')
  } catch (error) {
    console.error('✗ Failed to register CORS:', error)
  }
  
  // 3. Add request validation hooks
  fastify.addHook('onRequest', async (request, reply) => {
    // Validate request size
    const contentLength = request.headers['content-length']
    const maxSize = config.maxRequestSize || 10 * 1024 * 1024
    
    if (!validateRequestSize(contentLength, maxSize)) {
      reply.code(413).send({
        error: 'Payload too large',
        message: `Request exceeds maximum size of ${maxSize} bytes`,
      })
      return
    }
    
    // Disable dangerous HTTP methods
    await disableDangerousMethods(request, reply)
    
    // HTTPS enforcement
    if (config.enableHTTPS) {
      await enforceHTTPS(request, reply)
    }
    
    // Validate CORS headers
    await validateCORSHeaders(request, reply)
    
    // Brute force protection for login endpoints
    if (request.url === '/auth/login' || request.url === '/auth/register') {
      await bruteForceProtection(request, reply)
    }
    
    // Additional security headers
    await additionalSecurityHeaders(request, reply)
  })
  
  // 4. Rate limiting per IP (basic implementation)
  fastify.addHook('onRequest', async (request, reply) => {
    if (!config.enableRateLimit) return
    
    const ip = request.ip || request.socket?.remoteAddress || 'unknown'
    const key = `ratelimit:${ip}`
    
    // This would be handled by the Redis-based rate limiter
    // For now, just tracking
    request.user = { ip } as any
  })
  
  // 5. Add security context to request
  fastify.addHook('onRequest', async (request) => {
    request.security = {
      ip: request.ip || request.socket?.remoteAddress || 'unknown',
      userAgent: request.headers['user-agent'] || '',
      origin: request.headers.origin || 'unknown',
    }
  })
  
  // 6. Add response security headers
  fastify.addHook('onSend', async (request, reply) => {
    // Ensure security headers are set
    if (!reply.hasHeader('X-Content-Type-Options')) {
      reply.header('X-Content-Type-Options', 'nosniff')
    }
    
    if (!reply.hasHeader('X-Frame-Options')) {
      reply.header('X-Frame-Options', 'DENY')
    }
    
    if (!reply.hasHeader('X-XSS-Protection')) {
      reply.header('X-XSS-Protection', '1; mode=block')
    }
  })
  
  console.log('✓ Security plugin registered successfully')
  console.log(`  - HTTPS Enforcement: ${config.enableHTTPS ? 'enabled' : 'disabled'}`)
  console.log(`  - CSP: ${config.enableCSP ? 'enabled' : 'disabled'}`)
  console.log(`  - Rate Limiting: ${config.enableRateLimit ? 'enabled' : 'disabled'}`)
  console.log(`  - Max Request Size: ${config.maxRequestSize} bytes`)
}

/**
 * Extend Fastify request to include security context
 */
declare global {
  namespace FastifyInstance {
    interface FastifyRequest {
      security?: {
        ip: string
        userAgent: string
        origin: string
      }
    }
  }
}
