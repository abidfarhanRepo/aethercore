import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import securityRoutes from '../../src/routes/security'
import { prisma } from '../../src/utils/db'

type Role = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'CASHIER' | 'STOCK_CLERK'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_access_secret_key_for_testing_only'

function issueAccessToken(user: { id: string; email: string; role: Role }) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  )
}

describe('Security status integration', () => {
  let app: ReturnType<typeof Fastify>
  let adminUser: any
  let managerUser: any
  const suiteStart = new Date()

  beforeAll(async () => {
    app = Fastify()
    await app.register(securityRoutes)
    await app.ready()

    managerUser = await prisma.user.create({
      data: {
        email: `security-status-manager-${Date.now()}@test.local`,
        password: 'test-password-hash',
        firstName: 'Security',
        lastName: 'Manager',
        role: 'MANAGER',
        isActive: true,
      },
    })

    adminUser = await prisma.user.create({
      data: {
        email: `security-status-admin-${Date.now()}@test.local`,
        password: 'test-password-hash',
        firstName: 'Security',
        lastName: 'Admin',
        role: 'ADMIN',
        isActive: true,
      },
    })
  })

  afterAll(async () => {
    try {
      if (app) await app.close()
      if (adminUser?.id) {
        await prisma.permissionLog.deleteMany({ where: { userId: adminUser.id } })
        await prisma.user.delete({ where: { id: adminUser.id } })
      }
      if (managerUser?.id) {
        await prisma.permissionLog.deleteMany({ where: { userId: managerUser.id } })
        await prisma.user.delete({ where: { id: managerUser.id } })
      }
      await prisma.notification.deleteMany({
        where: {
          createdAt: {
            gte: suiteStart,
          },
        },
      })
      await prisma.keyRotationLog.deleteMany({
        where: {
          rotatedAt: {
            gte: suiteStart,
          },
        },
      })
      await prisma.securityEvent.deleteMany({
        where: {
          createdAt: {
            gte: suiteStart,
          },
        },
      })
      await prisma.systemSecurityStatus.deleteMany({
        where: {
          createdAt: {
            gte: suiteStart,
          },
        },
      })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('returns security posture with unknown/unavailable clarity and persists snapshot', async () => {
    const token = issueAccessToken(managerUser)

    const response = await app.inject({
      method: 'GET',
      url: '/api/security/status',
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('https.enforced')
    expect(body).toHaveProperty('tls.keyPath.configured')
    expect(body).toHaveProperty('tls.certPath.configured')
    expect(body).toHaveProperty('headers.headers.strictTransportSecurity.configured', true)
    expect(body).toHaveProperty('requestContext.sslTermination', 'unknown_or_external')

    const snapshot = await prisma.systemSecurityStatus.findFirst({
      where: {
        createdAt: {
          gte: suiteStart,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(snapshot).toBeTruthy()
    expect(typeof snapshot?.httpsEnforced).toBe('boolean')
  })

  it('returns security events and key rotations for manager', async () => {
    const managerToken = issueAccessToken(managerUser)

    await prisma.securityEvent.create({
      data: {
        eventType: 'TLS_CONFIG_CHANGED',
        severity: 'MEDIUM',
        source: 'test',
        message: 'TLS config updated in test',
        actorId: adminUser.id,
      },
    })

    await prisma.keyRotationLog.create({
      data: {
        component: 'jwt_access',
        oldKeyVersion: 'v1',
        newKeyVersion: 'v2',
        status: 'success',
        actorId: adminUser.id,
      },
    })

    const eventsResponse = await app.inject({
      method: 'GET',
      url: '/api/security/events?limit=5',
      headers: {
        authorization: `Bearer ${managerToken}`,
      },
    })

    expect(eventsResponse.statusCode).toBe(200)
    expect(eventsResponse.json()).toHaveProperty('items')
    expect(Array.isArray(eventsResponse.json().items)).toBe(true)

    const rotationsResponse = await app.inject({
      method: 'GET',
      url: '/api/security/key-rotations?limit=5',
      headers: {
        authorization: `Bearer ${managerToken}`,
      },
    })

    expect(rotationsResponse.statusCode).toBe(200)
    expect(rotationsResponse.json()).toHaveProperty('items')
    expect(Array.isArray(rotationsResponse.json().items)).toBe(true)
  })

  it('allows ADMIN key rotation logging and blocks MANAGER for rotate endpoint', async () => {
    const adminToken = issueAccessToken(adminUser)
    const managerToken = issueAccessToken(managerUser)

    const deniedResponse = await app.inject({
      method: 'POST',
      url: '/api/security/rotate-keys',
      headers: {
        authorization: `Bearer ${managerToken}`,
      },
      payload: {
        component: 'jwt_access',
        newVersion: 'v2',
      },
    })

    expect(deniedResponse.statusCode).toBe(403)

    const response = await app.inject({
      method: 'POST',
      url: '/api/security/rotate-keys',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        component: 'jwt_access',
        newVersion: 'v2',
        notes: 'Quarterly rotation test',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body).toHaveProperty('rotation')
    expect(body.rotation.component).toBe('jwt_access')
    expect(body).toHaveProperty('actionRequired')

    const persistedRotation = await prisma.keyRotationLog.findFirst({
      where: {
        component: 'jwt_access',
        actorId: adminUser.id,
        newKeyVersion: 'v2',
      },
      orderBy: { rotatedAt: 'desc' },
    })
    expect(persistedRotation).toBeTruthy()

    const notifiedUsers = await prisma.notification.findMany({
      where: {
        title: 'Security key rotation success',
        actorId: adminUser.id,
      },
    })
    const recipientIds = new Set(notifiedUsers.map((item) => item.recipientId))
    expect(recipientIds.has(adminUser.id)).toBe(true)
    expect(recipientIds.has(managerUser.id)).toBe(true)
  })
})
