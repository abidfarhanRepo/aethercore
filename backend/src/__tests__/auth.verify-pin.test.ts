import Fastify from 'fastify'
import bcrypt from 'bcryptjs'
import authRoutes from '../routes/auth'
import { prisma } from '../utils/db'

jest.mock('@prisma/client', () => ({
  SecurityEventType: {
    FAILED_LOGIN: 'FAILED_LOGIN',
  },
  SecuritySeverity: {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
  },
}))

jest.mock('../utils/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

const prismaMock = prisma as unknown as {
  user: {
    findUnique: jest.Mock
  }
}

jest.mock('../plugins/authMiddleware', () => ({
  requireAuth: async (req: any) => {
    req.user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'CASHIER',
      tenantId: 'tenant-1',
      isActive: true,
      mfaEnabled: true,
    }
  },
}))

jest.mock('../utils/audit', () => ({
  logAuthEvent: jest.fn(),
}))

jest.mock('../lib/securityCompliance', () => ({
  logSecurityEventRecord: jest.fn().mockResolvedValue(undefined),
}))

describe('POST /api/v1/auth/verify-pin', () => {
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    jest.clearAllMocks()

    app = Fastify()
    await app.register(authRoutes)
  })

  afterEach(async () => {
    await app.close()
  })

  test('returns 429 and Retry-After when max PIN attempts are exceeded', async () => {
    const hashedOtherPin = await bcrypt.hash('9999', 4)
    prismaMock.user.findUnique.mockResolvedValue({ pinHash: hashedOtherPin })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-pin',
        headers: { authorization: 'Bearer test-token' },
        payload: { pin: '1234' },
      })

      expect(failedResponse.statusCode).toBe(401)
    }

    const lockoutResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-pin',
      headers: { authorization: 'Bearer test-token' },
      payload: { pin: '1234' },
    })

    expect(lockoutResponse.statusCode).toBe(429)
    expect(lockoutResponse.headers['retry-after']).toBe('900')
    expect(lockoutResponse.json()).toEqual({ error: 'Too many PIN attempts. Please try again later.' })
  })

  test('returns verified=true for a correct PIN', async () => {
    const hashedPin = await bcrypt.hash('4321', 4)
    prismaMock.user.findUnique.mockResolvedValue({ pinHash: hashedPin })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-pin',
      headers: { authorization: 'Bearer test-token' },
      payload: { pin: '4321' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ verified: true })
  })
})
