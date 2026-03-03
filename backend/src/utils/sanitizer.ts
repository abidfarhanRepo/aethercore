/**
 * Input sanitization and validation utilities
 * Prevents XSS, SQL injection, and other injection attacks
 */

import validator from 'validator'

/**
 * Sanitize HTML content to prevent XSS attacks (simple version)
 */
export function sanitizeHTML(dirty: string): string {
  return dirty
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHTML(text: string): string {
  return validator.escape(text)
}

/**
 * Sanitize string input (trim, remove null bytes, etc.)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  
  return input
    .trim() // Remove whitespace
    .replace(/\0/g, '') // Remove null bytes
    .slice(0, 10000) // Limit length to prevent DoS via large inputs
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeString(email).toLowerCase()
  
  if (!validator.isEmail(sanitized)) {
    throw new Error('Invalid email address')
  }
  
  return sanitized
}

/**
 * Sanitize URL
 */
export function sanitizeURL(url: string): string {
  const sanitized = sanitizeString(url)
  
  if (!validator.isURL(sanitized, {
    protocols: ['http', 'https'],
    require_protocol: true,
  })) {
    throw new Error('Invalid URL')
  }
  
  return sanitized
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: any): number {
  const parsed = parseFloat(input)
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    throw new Error('Invalid number')
  }
  
  return parsed
}

/**
 * Sanitize integer input
 */
export function sanitizeInteger(input: any): number {
  const parsed = parseInt(input, 10)
  
  if (isNaN(parsed) || !isFinite(parsed)) {
    throw new Error('Invalid integer')
  }
  
  return parsed
}

/**
 * Sanitize boolean input
 */
export function sanitizeBoolean(input: any): boolean {
  if (typeof input === 'boolean') return input
  if (typeof input === 'string') {
    return ['true', '1', 'yes', 'on'].includes(input.toLowerCase())
  }
  return Boolean(input)
}

/**
 * Sanitize array input
 */
export function sanitizeArray<T>(input: any, maxLength: number = 100): T[] {
  if (!Array.isArray(input)) {
    return []
  }
  
  return input.slice(0, maxLength)
}

/**
 * Remove potential SQL injection attempts
 * Note: Use Prisma parameterized queries as primary defense
 */
export function removeSQLInjectionPatterns(input: string): boolean {
  const sqlPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/gi,
    /(--|#|\/\*|\*\/)/g, // SQL comments
    /(\bOR\b|\bAND\b).*=.*['"]/gi, // OR/AND with string comparison
    /([;'])\s*(UNION|SELECT)/gi,
  ]
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      return true // Suspicious pattern detected
    }
  }
  
  return false
}

/**
 * Check for XSS attempt patterns
 */
export function containsXSSPatterns(input: string): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /(base64)/gi,
  ]
  
  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      return true
    }
  }
  
  return false
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  // Check against common passwords
  const commonPasswords = [
    'password',
    '123456',
    'qwerty',
    'abc123',
    'password123',
    'admin',
    'letmein',
  ]
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Sanitize file upload filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe characters
    .replace(/^\./, '') // Remove leading dots
    .slice(0, 255) // Limit length
}

/**
 * Validate file type
 */
export function isAllowedFileType(
  filename: string,
  allowedTypes: string[] = ['pdf', 'xlsx', 'csv', 'json']
): boolean {
  const extension = filename.split('.').pop()?.toLowerCase()
  return extension ? allowedTypes.includes(extension) : false
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  maxDepth: number = 3,
  currentDepth: number = 0
): T {
  if (currentDepth >= maxDepth) {
    return obj
  }
  
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key)
    
    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value)
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map(item =>
          typeof item === 'string' ? sanitizeString(item) : item
        )
      } else {
        sanitized[sanitizedKey] = sanitizeObject(value, maxDepth, currentDepth + 1)
      }
    } else {
      sanitized[sanitizedKey] = value
    }
  }
  
  return sanitized
}

/**
 * Validate request size
 */
export function validateRequestSize(contentLength: string | undefined, maxSize: number = 10 * 1024 * 1024): boolean {
  if (!contentLength) return true
  
  const size = parseInt(contentLength, 10)
  return size <= maxSize
}
