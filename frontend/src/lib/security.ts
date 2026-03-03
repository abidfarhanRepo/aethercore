/**
 * Frontend security utilities
 * Implements client-side security measures
 */

/**
 * Escape HTML to prevent XSS
 */
export function escapeHTML(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Sanitize user input before display
 */
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate and sanitize URL
 */
export function validateURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow http and https
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Secure storage for sensitive data
 * Uses sessionStorage instead of localStorage to minimize exposure
 */
export const SecureStorage = {
  /**
   * Store access token (short-lived)
   */
  setAccessToken(token: string): void {
    sessionStorage.setItem('accessToken', token)
  },

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return sessionStorage.getItem('accessToken')
  },

  /**
   * Clear access token
   */
  clearAccessToken(): void {
    sessionStorage.removeItem('accessToken')
  },

  /**
   * Store user data (non-sensitive only)
   */
  setUser(user: Record<string, any>): void {
    sessionStorage.setItem('user', JSON.stringify(user))
  },

  /**
   * Get user data
   */
  getUser(): Record<string, any> | null {
    const data = sessionStorage.getItem('user')
    return data ? JSON.parse(data) : null
  },

  /**
   * Clear all session data
   */
  clearAll(): void {
    sessionStorage.clear()
    localStorage.clear() // Also clear localStorage for cleanup
  },

  /**
   * Check if has valid session
   */
  hasValidSession(): boolean {
    return sessionStorage.getItem('accessToken') !== null
  },
}

/**
 * CSRF token management
 */
export const CSRFToken = {
  /**
   * Get CSRF token from cookie or meta tag
   */
  getToken(): string | null {
    // Try to get from meta tag first
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
    if (meta) {
      return meta.content
    }

    // Try to get from cookie
    return this.getCookie('csrf-token')
  },

  /**
   * Get cookie value
   */
  getCookie(name: string): string | null {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null
    }
    return null
  },

  /**
   * Set CSRF token in request headers
   */
  setTokenHeader(headers: Record<string, string>): Record<string, string> {
    const token = this.getToken()
    if (token) {
      headers['X-CSRF-Token'] = token
    }
    return headers
  },
}

/**
 * HTTP security headers validation
 */
export async function validateSecurityHeaders(): Promise<{
  has_hsts: boolean
  has_csp: boolean
  has_x_frame_options: boolean
  has_x_content_type_options: boolean
  has_x_xss_protection: boolean
}> {
  try {
    const response = await fetch('/health', { method: 'HEAD' })
    const headers: Record<string, string> = {}

    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })

    return {
      has_hsts: !!headers['strict-transport-security'],
      has_csp: !!headers['content-security-policy'],
      has_x_frame_options: !!headers['x-frame-options'],
      has_x_content_type_options: !!headers['x-content-type-options'],
      has_x_xss_protection: !!headers['x-xss-protection'],
    }
  } catch (error) {
    console.error('Failed to validate security headers:', error)
    return {
      has_hsts: false,
      has_csp: false,
      has_x_frame_options: false,
      has_x_content_type_options: false,
      has_x_xss_protection: false,
    }
  }
}

/**
 * Check if connection is secure (HTTPS)
 */
export function isSecureConnection(): boolean {
  return window.location.protocol === 'https:'
}

/**
 * Log security events
 */
export function logSecurityEvent(
  event: string,
  details?: Record<string, any>
): void {
  if (window.location.hostname === 'localhost') {
    console.warn(`🔒 Security Event: ${event}`, details)
  }

  // In production, send to logging service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to logging endpoint
  }
}

/**
 * Rate limit client-side tracking
 */
export const RateLimitTracker = {
  attempts: new Map<string, number[]>(),

  /**
   * Check if rate limit exceeded
   */
  isRateLimited(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < windowMs)

    // Check if exceeded
    if (recentAttempts.length >= maxAttempts) {
      return true
    }

    // Record new attempt
    recentAttempts.push(now)
    this.attempts.set(key, recentAttempts)

    return false
  },

  /**
   * Clear rate limit tracking
   */
  clear(key: string): void {
    this.attempts.delete(key)
  },
}

/**
 * Subresource Integrity (SRI) helper
 */
export function getSRIAttribute(hash: string, algorithm: string = 'sha384'): string {
  return `${algorithm}-${hash}`
}

/**
 * Security policy compliance check
 */
export async function checkSecurityCompliance(): Promise<{
  https: boolean
  headers: boolean
  localStorage_empty: boolean
  session_valid: boolean
  timestamp: number
}> {
  const headers = await validateSecurityHeaders()
  const allHeaders = Object.values(headers).every(v => v)

  return {
    https: isSecureConnection(),
    headers: allHeaders,
    localStorage_empty: Object.keys(localStorage).length === 0,
    session_valid: SecureStorage.hasValidSession(),
    timestamp: Date.now(),
  }
}

/**
 * Clear sensitive data on logout
 */
export function clearSensitiveData(): void {
  SecureStorage.clearAll()
  RateLimitTracker.attempts.clear('')
  logSecurityEvent('User cleared sensitive data')
}

/**
 * Setup security event listeners
 */
export function setupSecurityListeners(): void {
  // Clear on page hide (user closes tab)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      logSecurityEvent('Page hidden')
    }
  })

  // Warn on leaving page with unsaved data
  window.addEventListener('beforeunload', (e) => {
    // Optionally check for unsaved data
  })

  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    logSecurityEvent('Unhandled error', {
      message: event.message,
      filename: event.filename,
    })
  })

  // Detect console activity
  const originalLog = console.log
  console.log = function (...args) {
    if (process.env.NODE_ENV === 'production') {
      logSecurityEvent('Console accessed')
    }
    originalLog(...args)
  }
}

/**
 * Request signing helper for sensitive operations
 */
export async function signRequest(
  method: string,
  url: string,
  body?: Record<string, any>
): Promise<string> {
  // In production, would use crypto.subtle.sign()
  const data = `${method}${url}${body ? JSON.stringify(body) : ''}`
  const encoder = new TextEncoder()

  // This is a simplified version
  // Production would use HMAC with server-side secret
  return btoa(data)
}

/**
 * Initialize frontend security
 */
export function initializeSecurity(): void {
  console.log('🔒 Initializing frontend security...')

  setupSecurityListeners()

  // Validate security on load
  if (process.env.NODE_ENV === 'production') {
    checkSecurityCompliance().then(result => {
      if (!result.https) {
        console.warn('⚠️ Not using HTTPS! Security is compromised.')
      }
      if (!result.headers) {
        console.warn('⚠️ Missing security headers')
      }
    })
  }

  console.log('✓ Frontend security initialized')
}
