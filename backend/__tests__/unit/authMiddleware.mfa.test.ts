import jwt from 'jsonwebtoken'
import { requireAuth } from '../../src/plugins/authMiddleware'

const findUniqueMock = jest.fn()

jest.mock('../../src/utils/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}))

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}))

describe('Auth middleware MFA enforcement', () => {
  const verifyMock = jwt.verify as jest.Mock

  const createReply = () => {
    const reply: any = {}
    reply.code = jest.fn(() => reply)
    reply.send = jest.fn(() => reply)
    return reply
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_for_testing_only'
    verifyMock.mockReturnValue({ id: 'user-1' })
  })

  it('returns 403 for admin without MFA on protected route', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'user-1',
      email: 'admin@test.local',
      role: 'ADMIN',
      tenantId: null,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
      mfaEnabled: false,
    })

    const req: any = {
      headers: { authorization: 'Bearer token' },
      url: '/api/v1/products',
    }
    const reply = createReply()

    await requireAuth(req, reply)

    expect(reply.code).toHaveBeenCalledWith(403)
    expect(reply.send).toHaveBeenCalledWith({ error: 'MFA enrollment required' })
  })

  it('allows admin without MFA to reach enrollment endpoints', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'user-1',
      email: 'admin@test.local',
      role: 'ADMIN',
      tenantId: null,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
      mfaEnabled: false,
    })

    const req: any = {
      headers: { authorization: 'Bearer token' },
      url: '/api/v1/auth/mfa/enroll',
    }
    const reply = createReply()

    await requireAuth(req, reply)

    expect(reply.code).not.toHaveBeenCalledWith(403)
    expect(req.user?.id).toBe('user-1')
  })

  it('allows cashier without MFA', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'user-2',
      email: 'cashier@test.local',
      role: 'CASHIER',
      tenantId: null,
      firstName: 'Cashier',
      lastName: 'User',
      isActive: true,
      mfaEnabled: false,
    })

    const req: any = {
      headers: { authorization: 'Bearer token' },
      url: '/api/v1/products',
    }
    const reply = createReply()

    await requireAuth(req, reply)

    expect(reply.code).not.toHaveBeenCalled()
    expect(req.user?.role).toBe('CASHIER')
  })
})
