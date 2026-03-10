import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import cashSessionRoutes from '../../src/routes/cashSessions'
import { prisma } from '../../src/utils/db'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change_me'

function issueAccessToken(userId: string): string {
  return jwt.sign({ id: userId }, JWT_ACCESS_SECRET, { expiresIn: '15m' })
}

describe('Cash sessions integration', () => {
  const suffix = `${Date.now()}`
  const tenantCode = `cash-tenant-${suffix}`
  const managerEmail = `cash-manager-${suffix}@example.test`
  const terminalId = `TERM-${suffix}`

  let app: ReturnType<typeof Fastify>
  let managerUserId: string
  let tenantId: string

  beforeAll(async () => {
    app = Fastify()
    await app.register(cashSessionRoutes)
    await app.ready()

    const tenant = await prisma.tenant.create({
      data: {
        code: tenantCode,
        name: `Cash Session Tenant ${suffix}`,
      },
    })
    tenantId = tenant.id

    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        password: 'not-used-in-test',
        role: 'MANAGER',
        isActive: true,
        mfaEnabled: true,
        tenantId,
      },
    })

    managerUserId = manager.id
  })

  afterAll(async () => {
    try {
      if (app) {
        await app.close()
      }

      await prisma.salePayment.deleteMany({
        where: {
          sale: {
            userId: managerUserId,
          },
        },
      })

      await prisma.sale.deleteMany({
        where: {
          userId: managerUserId,
        },
      })

      await prisma.auditLog.deleteMany({
        where: {
          actorId: managerUserId,
          resource: 'CASH_SESSION',
        },
      })

      await prisma.cashSession.deleteMany({
        where: {
          tenantId,
        },
      })

      await prisma.permissionLog.deleteMany({ where: { userId: managerUserId } })
      await prisma.user.deleteMany({ where: { id: managerUserId } })
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
    } finally {
      await prisma.$disconnect()
    }
  })

  it('opens, closes, and lists cash sessions with variance calculation', async () => {
    const token = issueAccessToken(managerUserId)

    const openResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cash-sessions/open',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        terminalId,
        openingFloatCents: 10000,
      },
    })

    expect(openResponse.statusCode).toBe(201)
    const openedSession = openResponse.json()
    expect(openedSession.status).toBe('OPEN')
    expect(openedSession.terminalId).toBe(terminalId)

    const duplicateOpenResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/cash-sessions/open',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        terminalId,
        openingFloatCents: 5000,
      },
    })

    expect(duplicateOpenResponse.statusCode).toBe(409)

    const sale = await prisma.sale.create({
      data: {
        userId: managerUserId,
        terminalId,
        subtotalCents: 5000,
        totalCents: 5000,
        paymentMethod: 'CASH',
        status: 'completed',
      },
    })

    await prisma.salePayment.create({
      data: {
        saleId: sale.id,
        method: 'CASH',
        amountCents: 5000,
      },
    })

    const closeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/cash-sessions/${openedSession.id}/close`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        declaredCashCents: 15100,
      },
    })

    expect(closeResponse.statusCode).toBe(200)
    const closedSession = closeResponse.json()
    expect(closedSession.status).toBe('CLOSED')
    expect(closedSession.systemCashCents).toBe(15000)
    expect(closedSession.varianceCents).toBe(100)

    const listResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/cash-sessions?terminalId=${terminalId}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    })

    expect(listResponse.statusCode).toBe(200)
    const listBody = listResponse.json() as { items: Array<{ id: string; status: string }> }
    expect(Array.isArray(listBody.items)).toBe(true)
    expect(listBody.items.some((item) => item.id === openedSession.id && item.status === 'CLOSED')).toBe(true)
  })
})
