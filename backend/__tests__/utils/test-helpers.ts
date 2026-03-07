/**
 * Common test assertions and helpers
 */

import { logger } from '../../src/utils/logger'

/**
 * Assert response has expected structure
 */
export function assertValidResponse(response: any) {
  expect(response).toBeDefined()
  expect(response).toHaveProperty('status')
  expect(response).toHaveProperty('data')
}

/**
 * Assert error response format
 */
export function assertErrorResponse(
  response: any,
  statusCode: number,
  errorCode?: string
) {
  expect(response.status).toBe(statusCode)
  expect(response.data).toHaveProperty('error')
  expect(response.data).toHaveProperty('code')
  expect(response.data).toHaveProperty('timestamp')
  
  if (errorCode) {
    expect(response.data.code).toBe(errorCode)
  }
}

/**
 * Assert user object structure
 */
export function assertValidUser(user: any) {
  expect(user).toHaveProperty('id')
  expect(user).toHaveProperty('email')
  expect(user).toHaveProperty('firstName')
  expect(user).toHaveProperty('role')
  expect(user).toHaveProperty('isActive')
  expect(user).toHaveProperty('createdAt')
  expect(user).not.toHaveProperty('password') // Should never return password
}

/**
 * Assert product object structure
 */
export function assertValidProduct(product: any) {
  expect(product).toHaveProperty('id')
  expect(product).toHaveProperty('sku')
  expect(product).toHaveProperty('name')
  expect(product).toHaveProperty('priceCents')
  expect(product).toHaveProperty('costCents')
  expect(product).toHaveProperty('isActive')
  expect(product).toHaveProperty('createdAt')
}

/**
 * Assert sale object structure
 */
export function assertValidSale(sale: any) {
  expect(sale).toHaveProperty('id')
  expect(sale).toHaveProperty('saleNumber')
  expect(sale).toHaveProperty('userId')
  expect(sale).toHaveProperty('items')
  expect(Array.isArray(sale.items)).toBe(true)
  expect(sale).toHaveProperty('subtotalCents')
  expect(sale).toHaveProperty('discountCents')
  expect(sale).toHaveProperty('taxCents')
  expect(sale).toHaveProperty('totalCents')
  expect(sale).toHaveProperty('status')
  expect(sale).toHaveProperty('createdAt')
}

/**
 * Assert sale item structure
 */
export function assertValidSaleItem(item: any) {
  expect(item).toHaveProperty('productId')
  expect(item).toHaveProperty('qty')
  expect(item).toHaveProperty('unitPrice')
  expect(item).toHaveProperty('subtotalCents')
}

/**
 * Assert token pair structure
 */
export function assertValidTokenPair(tokens: any) {
  expect(tokens).toHaveProperty('accessToken')
  expect(tokens).toHaveProperty('refreshToken')
  expect(tokens).toHaveProperty('expiresIn')
  
  expect(typeof tokens.accessToken).toBe('string')
  expect(typeof tokens.refreshToken).toBe('string')
  expect(typeof tokens.expiresIn).toBe('number')
  
  // Verify they're JWTs (3 dot-separated parts)
  expect(tokens.accessToken.split('.').length).toBe(3)
  expect(tokens.refreshToken.split('.').length).toBe(3)
}

/**
 * Assert inventory location structure
 */
export function assertValidInventoryLocation(loc: any) {
  expect(loc).toHaveProperty('id')
  expect(loc).toHaveProperty('productId')
  expect(loc).toHaveProperty('warehouseId')
  expect(loc).toHaveProperty('qty')
  expect(loc).toHaveProperty('minThreshold')
  expect(loc).toHaveProperty('reorderPoint')
}

/**
 * Assert pagination response
 */
export function assertValidPaginatedResponse(response: any) {
  expect(response).toHaveProperty('data')
  expect(Array.isArray(response.data)).toBe(true)
  expect(response).toHaveProperty('total')
  expect(response).toHaveProperty('skip')
  expect(response).toHaveProperty('take')
  
  expect(typeof response.total).toBe('number')
  expect(typeof response.skip).toBe('number')
  expect(typeof response.take).toBe('number')
}

/**
 * Wait for a condition
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const start = Date.now()
  
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`)
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}

/**
 * Sleep for duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Generate random string
 */
export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, length + 2)
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substr(2, 5)}@test.local`
}

/**
 * Generate random SKU
 */
export function randomSKU(): string {
  return `TEST-SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
}

/**
 * Assert API response timing
 */
export function assertResponseTime(
  startTime: number,
  maxMs: number,
  operation: string = 'Operation'
) {
  const elapsed = Date.now() - startTime
  expect(elapsed).toBeLessThan(maxMs)
  logger.info({ operation, elapsed, targetMs: maxMs }, 'Performance assertion completed')
}

/**
 * Assert no sensitive data in response
 */
export function assertNoSensitiveData(data: any, paths: string[] = []) {
  const sensitiveFields = [
    'password',
    'passwordHash',
    'secret',
    'apiKey',
    'secretKey',
    'token',
    'refreshToken',
    ...paths
  ]
  
  const dataStr = JSON.stringify(data)
  
  for (const field of sensitiveFields) {
    expect(dataStr.toLowerCase()).not.toContain(field.toLowerCase())
  }
}

/**
 * Create pagination test matrix
 */
export function getPaginationTestCases() {
  return [
    { skip: 0, take: 10 },
    { skip: 10, take: 10 },
    { skip: 100, take: 50 },
    { skip: 0, take: 1 },
    { skip: 0, take: 1000 }
  ]
}

/**
 * Compare decimal cents (accounts for rounding)
 */
export function assertCentsEqual(actual: number, expected: number, tolerance: number = 5) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

/**
 * Verify transaction atomicity - all or nothing
 */
export function assertTransactionAtomicity(
  beforeState: any,
  afterState: any,
  changedFields: string[]
) {
  // All specified fields should change or none
  const changed = changedFields.filter(
    field => beforeState[field] !== afterState[field]
  )
  
  // Either all changed or none
  expect(changed.length === 0 || changed.length === changedFields.length).toBe(true)
}
