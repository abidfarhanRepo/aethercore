/**
 * Encryption utilities for sensitive data
 * Uses crypto.subtle for modern browser/Node.js compatibility
 * Falls back to crypto for Node.js environments
 */

import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_32_char_key_change_in_prod'
const ALGORITHM = 'aes-256-gcm'

/**
 * Validates encryption key length
 */
function ensureKeyLength(): string {
  if (ENCRYPTION_KEY.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters in production')
    }
    console.warn('ENCRYPTION_KEY is less than 32 characters. This is insecure. Set ENCRYPTION_KEY env var.')
    // Pad key to 32 bytes for development only 
    return ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32)
  }
  return ENCRYPTION_KEY.substring(0, 32)
}

/**
 * Encrypts sensitive data using AES-256-GCM
 * Returns base64 encoded result with IV and auth tag
 */
export function encryptData(plaintext: string): string {
  try {
    const key = Buffer.from(ensureKeyLength())
    const iv = crypto.randomBytes(12) // GCM standard IV size
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    // Combine IV + encrypted data + auth tag
    const combined = iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex')
    return Buffer.from(combined).toString('base64')
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypts data encrypted with encryptData
 */
export function decryptData(encryptedBase64: string): string {
  try {
    const key = Buffer.from(ensureKeyLength())
    const combined = Buffer.from(encryptedBase64, 'base64').toString('hex')
    const [ivHex, encrypted, authTagHex] = combined.split(':')
    
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Hash-based MAC for data integrity verification
 * Used for API request signing
 */
export function createHMAC(data: string, secret?: string): string {
  const key = secret || ENCRYPTION_KEY
  return crypto
    .createHmac('sha256', key)
    .update(data)
    .digest('hex')
}

/**
 * Verify HMAC signature
 */
export function verifyHMAC(data: string, signature: string, secret?: string): boolean {
  const key = secret || ENCRYPTION_KEY
  const computed = createHMAC(data, key)
  
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(signature)
  )
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Generate API key with timestamp and signature
 */
export function generateAPIKey(): string {
  const timestamp = Date.now().toString()
  const random = generateRandomBytes(16)
  const key = `aether_${timestamp}${random}`
  
  return key
}

/**
 * Create signed request token for sensitive operations
 */
export function createSignedToken(data: Record<string, any>, expiresIn?: number): string {
  const payload: Record<string, any> = {
    ...data,
    iat: Math.floor(Date.now() / 1000),
  }
  
  if (expiresIn) {
    payload.exp = Math.floor(Date.now() / 1000) + expiresIn
  }
  
  const signature = createHMAC(JSON.stringify(payload))
  return Buffer.from(JSON.stringify({ ...payload, signature })).toString('base64')
}

/**
 * Verify signed token
 */
export function verifySignedToken(token: string): Record<string, any> | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'))
    const { signature, ...payload } = decoded
    
    const computedSignature = createHMAC(JSON.stringify(payload))
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))) {
      return null
    }
    
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    
    return payload
  } catch {
    return null
  }
}
