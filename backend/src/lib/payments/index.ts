import crypto from 'crypto'
import { logger } from '../../utils/logger'

/**
 * Payment utilities for encryption, validation, and helper functions
 */

const ENCRYPTION_ALGORITHM = 'aes-256-cbc'
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')

/**
 * Encrypt sensitive data (API keys, tokens)
 */
export function encryptSensitiveData(data: string): string {
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32),
      iv
    )

    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Return iv:encrypted so we can decrypt later
    return `${iv.toString('hex')}:${encrypted}`
  } catch (error) {
    logger.error({ error }, 'Encryption error')
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt sensitive data
 */
export function decryptSensitiveData(encryptedData: string): string {
  try {
    const [ivHex, encrypted] = encryptedData.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32),
      iv
    )

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    logger.error({ error }, 'Decryption error')
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Hash sensitive data for comparison (e.g., CVV verification)
 */
export function hashSensitiveData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Mask credit card number (show only last 4 digits)
 */
export function maskCardNumber(cardNumber: string): string {
  if (!cardNumber || cardNumber.length < 4) {
    return 'xxxx'
  }
  return 'xxxx xxxx xxxx ' + cardNumber.slice(-4)
}

/**
 * Get last 4 digits of card
 */
export function getCardLastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/**
 * Validate card number using Luhn algorithm
 */
export function validateCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19) {
    return false
  }

  let sum = 0
  let isEven = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * Validate CVV (3-4 digits)
 */
export function validateCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv)
}

/**
 * Validate card expiry date
 */
export function validateCardExpiry(month: number, year: number): boolean {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (year < currentYear) {
    return false
  }

  if (year === currentYear && month < currentMonth) {
    return false
  }

  if (month < 1 || month > 12) {
    return false
  }

  return true
}

/**
 * Detect card brand from number
 */
export function detectCardBrand(cardNumber: string): string {
  const patterns: Record<string, RegExp> = {
    VISA: /^4[0-9]{12}(?:[0-9]{3})?$/,
    MASTERCARD: /^5[1-5][0-9]{14}$|^2(?:2(?:2[1-9]|[3-9][0-9])|[3-6][0-9]{2}|7(?:[01][0-9]|20))[0-9]{12}$/,
    AMEX: /^3[47][0-9]{13}$/,
    DISCOVER: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
    DINERS: /^3(?:0[0-5]|[68][0-9])[0-9]{11}$/,
    JCB: /^(?:2131|1800|35\d{3})\d{11}$/,
  }

  const number = cardNumber.replace(/\D/g, '')

  for (const [brand, pattern] of Object.entries(patterns)) {
    if (pattern.test(number)) {
      return brand
    }
  }

  return 'UNKNOWN'
}

/**
 * Generate idempotency key
 */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`
}

/**
 * Validate address (basic validation)
 */
export function validateAddress(
  street: string,
  city: string,
  state: string,
  zip: string,
  country: string
): boolean {
  if (!street || street.trim().length < 3) return false
  if (!city || city.trim().length < 2) return false
  if (!state || state.trim().length < 2) return false
  if (!zip || zip.trim().length < 3) return false
  if (!country || country.trim().length < 2) return false
  return true
}

/**
 * Log payment attempt (never log full card data)
 */
export function logPaymentAttempt(
  transactionId: string,
  processor: string,
  amount: number,
  cardLast4: string,
  status: 'success' | 'failure' | 'pending',
  errorMessage?: string
): void {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    transactionId,
    processor,
    amount,
    cardLast4,
    status,
    errorMessage,
  }

  logger.info({ paymentLog: logEntry }, 'Payment attempt')

  // In production, send to logging service (e.g., CloudWatch, ELK)
}

/**
 * Calculate transaction fee
 */
export function calculateTransactionFee(
  amount: number,
  processor: string
): { feeCents: number; percentage: number; fixed: number } {
  // Example fee structures - adjust based on your contracts
  const feeStructures: Record<string, { percentage: number; fixed: number }> = {
    STRIPE: { percentage: 2.9, fixed: 30 }, // 2.9% + $0.30
    SQUARE: { percentage: 2.6, fixed: 0 }, // 2.6% (no fixed fee for online)
    PAYPAL: { percentage: 3.49, fixed: 30 }, // 3.49% + $0.30
    CASH: { percentage: 0, fixed: 0 }, // No fees for cash
  }

  const structure = feeStructures[processor.toUpperCase()] || {
    percentage: 0,
    fixed: 0,
  }

  const feeCents = Math.round(amount * (structure.percentage / 100)) + structure.fixed

  return {
    feeCents,
    percentage: structure.percentage,
    fixed: structure.fixed,
  }
}

/**
 * Validate payment amount
 */
export function validatePaymentAmount(
  amount: number,
  min: number = 1,
  max: number = 999999999
): boolean {
  return amount >= min && amount <= max && Number.isInteger(amount)
}

/**
 * Format amount for display
 */
export function formatAmount(centAmount: number, currency: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  })
  return formatter.format(centAmount / 100)
}

/**
 * Create webhook signature
 */
export function createWebhookSignature(
  payload: string,
  secret: string
): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createWebhookSignature(payload, secret)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Retry policy for failed payments
 */
export function shouldRetryPayment(
  attemptNumber: number,
  error: string
): boolean {
  // Don't retry on certain errors
  const noRetryErrors = [
    'CARD_DECLINED',
    'INVALID_CARD',
    'INSUFFICIENT_FUNDS',
    'FRAUD_DETECTED',
    'AUTHENTICATION_REQUIRED',
  ]

  if (noRetryErrors.some((e) => error.includes(e))) {
    return false
  }

  // Max 3 retries with exponential backoff
  return attemptNumber < 3
}

/**
 * Calculate retry timeout (exponential backoff)
 */
export function getRetryTimeout(attemptNumber: number): number {
  // 1s, 4s, 9s...
  const baseDelay = 1000
  return baseDelay * Math.pow(attemptNumber, 2)
}

/**
 * Validate payment processor configuration
 */
export function validateProcessorConfig(
  processor: string,
  config: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  switch (processor.toUpperCase()) {
    case 'STRIPE':
      if (!config.apiKey || typeof config.apiKey !== 'string')
        errors.push('Stripe API key is required and must be a string')
      if (!config.webhookSecret || typeof config.webhookSecret !== 'string')
        errors.push('Stripe webhook secret is required')
      break

    case 'SQUARE':
      if (!config.apiKey || typeof config.apiKey !== 'string')
        errors.push('Square API key is required')
      if (!config.applicationId || typeof config.applicationId !== 'string')
        errors.push('Square application ID is required')
      if (!config.locationId || typeof config.locationId !== 'string')
        errors.push('Square location ID is required')
      break

    case 'PAYPAL':
      if (!config.clientId || typeof config.clientId !== 'string')
        errors.push('PayPal client ID is required')
      if (!config.clientSecret || typeof config.clientSecret !== 'string')
        errors.push('PayPal client secret is required')
      if (!config.webhookId || typeof config.webhookId !== 'string')
        errors.push('PayPal webhook ID is required')
      break

    default:
      errors.push(`Unknown payment processor: ${processor}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
