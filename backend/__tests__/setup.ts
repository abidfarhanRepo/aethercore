/**
 * Jest Setup File
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://test:test@localhost:5432/aether_test'
process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_for_testing_only'
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key_for_testing_only'
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'

// Suppress logs during tests (can be overridden with --verbose)
if (!process.env.DEBUG) {
  global.console.log = jest.fn()
  global.console.info = jest.fn()
  global.console.debug = jest.fn()
}

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      }
    }
  },
  toBeValidJWT(received: string) {
    const parts = received.split('.')
    const pass = parts.length === 3
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT (3 dot-separated parts)`,
        pass: false,
      }
    }
  }
})

// Global test teardown
afterAll(async () => {
  // Cleanup any global resources
  jest.clearAllMocks()
})

// Timeout for slow tests
jest.setTimeout(30000)
