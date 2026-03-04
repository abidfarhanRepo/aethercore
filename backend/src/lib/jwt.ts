/**
 * JWT security utilities with token rotation and revocation support
 */

import jwt from 'jsonwebtoken'
import Redis from 'ioredis'

// Allow Redis to be disabled for development
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true'
let redis: Redis | null = null

// Only initialize Redis if not disabled and not in development
if (!REDIS_DISABLED && process.env.NODE_ENV !== 'development') {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  redis.on('error', (err) => {
    console.warn('Redis client error:', err);
    // Gracefully degrade if Redis fails
  })
}

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'default_access_secret_change_me'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_change_me'
const JWT_ACCESS_EXPIRES_IN = '15m' // Short expiration for access tokens
const JWT_REFRESH_EXPIRES_IN = '7d'

/**
 * Validates JWT secret length (minimum 32 characters)
 */
function validateSecretLength(secret: string, name: string): void {
  if (secret.length < 32) {
    throw new Error(`${name} must be at least 32 characters. Set in environment variables.`)
  }
}

/**
 * Generate access token (short-lived)
 */
export function generateAccessToken(payload: Record<string, any>): string {
  validateSecretLength(JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET')
  
  return jwt.sign(
    {
      ...payload,
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_ACCESS_SECRET,
    {
      expiresIn: JWT_ACCESS_EXPIRES_IN,
      algorithm: 'HS256',
    }
  )
}

/**
 * Generate refresh token (long-lived, rotatable)
 */
export function generateRefreshToken(payload: Record<string, any>): string {
  validateSecretLength(JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET')
  
  return jwt.sign(
    {
      ...payload,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_REFRESH_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      algorithm: 'HS256',
    }
  )
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): Record<string, any> | null {
  try {
    validateSecretLength(JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET')
    
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    }) as Record<string, any>
    
    if (decoded.type !== 'access') {
      return null
    }
    
    return decoded
  } catch (error) {
    return null
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): Record<string, any> | null {
  try {
    validateSecretLength(JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET')
    
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
    }) as Record<string, any>
    
    if (decoded.type !== 'refresh') {
      return null
    }
    
    return decoded
  } catch (error) {
    return null
  }
}

/**
 * Revoke a token by adding it to a blacklist in Redis
 */
export async function revokeToken(token: string, expiresIn: number = 900): Promise<void> {
  try {
    if (!redis) {
      console.warn('Redis not available - token revocation skipped')
      return
    }
    const jti = `revoked:${token}`
    await redis.setex(jti, expiresIn, '1')
  } catch (error) {
    console.error('Failed to revoke token:', error)
    // Don't throw - token revocation failure shouldn't break auth
  }
}

/**
 * Check if token has been revoked
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  try {
    if (!redis) {
      return false // Redis unavailable, assume token not revoked
    }
    const jti = `revoked:${token}`
    const revoked = await redis.get(jti)
    return revoked !== null
  } catch (error) {
    console.error('Failed to check token revocation:', error)
    return false
  }
}

/**
 * Generate token pair (access + refresh)
 */
export function generateTokenPair(payload: Record<string, any>): {
  accessToken: string
  refreshToken: string
  expiresIn: number
} {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: 15 * 60, // 15 minutes in seconds
  }
}

/**
 * Rotate refresh token
 * Issues a new access+refresh token pair, revokes the old refresh token
 */
export async function rotateRefreshToken(oldRefreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
} | null> {
  const decoded = verifyRefreshToken(oldRefreshToken)
  
  if (!decoded) {
    return null
  }
  
  // Check if token was revoked
  if (await isTokenRevoked(oldRefreshToken)) {
    return null
  }
  
  // Revoke old token
  await revokeToken(oldRefreshToken)
  
  // Generate new token pair
  const { id, email, role } = decoded
  return generateTokenPair({ id, email, role })
}

/**
 * Validate JWT claims
 */
export function validateTokenClaims(
  decoded: Record<string, any>,
  requiredClaims: string[] = ['id', 'email', 'role']
): boolean {
  for (const claim of requiredClaims) {
    if (!(claim in decoded)) {
      return false
    }
  }
  return true
}

/**
 * Extract user ID from token safely
 */
export function extractUserId(token: string): string | null {
  const decoded = verifyAccessToken(token)
  return decoded?.id || null
}

/**
 * Decode token without verification (use with caution)
 * Only for reading claims before verification in specific scenarios
 */
export function decodeTokenWithoutVerification(token: string): Record<string, any> | null {
  try {
    const decoded = jwt.decode(token) as Record<string, any>
    return decoded
  } catch {
    return null
  }
}
