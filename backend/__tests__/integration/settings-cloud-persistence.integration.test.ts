import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import settingsRoutes from '../../src/routes/settings'
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

describe('Settings cloud persistence integration', () => {
  const suffix = `${Date.now()}`
  const key = `cloud_settings_persist_${suffix}`

  let appA: ReturnType<typeof Fastify>
  let appB: ReturnType<typeof Fastify>
  let managerUser: any

  beforeAll(async () => {
    appA = Fastify()
    appB = Fastify()

    await appA.register(settingsRoutes)
    await appB.register(settingsRoutes)

    await appA.ready()
    await appB.ready()

    managerUser = await prisma.user.create({
      data: {
        email: `settings-manager-${suffix}@test.local`,
        password: 'test-password-hash',
        firstName: 'Settings',
        lastName: 'Manager',
        role: 'MANAGER',
        isActive: true,
      },
    })
  })

  afterAll(async () => {
    try {
      if (appA) await appA.close()
      if (appB) await appB.close()

      await prisma.settings.deleteMany({ where: { key } })
      if (managerUser?.id) {
        await prisma.permissionLog.deleteMany({ where: { userId: managerUser.id } })
        await prisma.user.delete({ where: { id: managerUser.id } })
      }
    } finally {
      await prisma.$disconnect()
    }
  })

  it('persists settings server-side and returns them across instances', async () => {
    const token = issueAccessToken(managerUser)

    const createResponse = await appA.inject({
      method: 'PUT',
      url: `/api/settings/${key}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        value: 42,
        category: 'system',
        type: 'number',
        label: 'Cloud Persist Test',
        description: 'Ensures settings are persisted server-side',
      },
    })

    expect(createResponse.statusCode).toBe(201)

    const updateResponse = await appA.inject({
      method: 'PUT',
      url: `/api/settings/${key}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        value: 7,
        category: 'system',
        type: 'number',
      },
    })

    expect(updateResponse.statusCode).toBe(200)

    // Read from a separate Fastify instance to emulate switching machines/processes.
    const readFromSecondInstance = await appB.inject({
      method: 'GET',
      url: `/api/settings/${key}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(readFromSecondInstance.statusCode).toBe(200)
    const body = readFromSecondInstance.json()

    expect(body.key).toBe(key)
    expect(body.value).toBe('7')
    expect(body.category).toBe('system')
    expect(body.type).toBe('number')
  })
})
