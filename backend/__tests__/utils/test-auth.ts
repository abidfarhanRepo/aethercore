import jwt from 'jsonwebtoken'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_access_secret_key'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_key'

export interface TestUser {
  id: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_CLERK' | 'SUPERVISOR'
  isActive: boolean
}

/**
 * Generate JWT access token for testing
 */
export function generateAccessToken(user: TestUser): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'access'
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  )
}

/**
 * Generate JWT refresh token for testing
 */
export function generateRefreshToken(user: TestUser): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      type: 'refresh'
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  )
}

/**
 * Generate both tokens (token pair)
 */
export function generateTokenPair(user: TestUser) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user)
  }
}

/**
 * Create test user object
 */
export function createTestUser(
  partial?: Partial<TestUser>
): TestUser {
  return {
    id: `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: `test_${Date.now()}@example.com`,
    role: 'CASHIER',
    isActive: true,
    ...partial
  }
}

/**
 * Decode token (for testing token contents)
 */
export function decodeToken(token: string): any {
  try {
    return jwt.decode(token)
  } catch (error) {
    return null
  }
}

/**
 * Verify token (will throw if invalid)
 */
export function verifyToken(token: string, type: 'access' | 'refresh'): any {
  const secret = type === 'access' ? JWT_ACCESS_SECRET : JWT_REFRESH_SECRET
  return jwt.verify(token, secret)
}
