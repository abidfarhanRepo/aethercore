import fs from 'node:fs'
import path from 'node:path'

describe('API route contract normalization', () => {
  const paymentsRouteFile = path.join(
    __dirname,
    '..',
    '..',
    'src',
    'routes',
    'payments.ts'
  )
  const syncRouteFile = path.join(
    __dirname,
    '..',
    '..',
    'src',
    'routes',
    'sync.ts'
  )

  it('uses /api prefix for payment routes', () => {
    const source = fs.readFileSync(paymentsRouteFile, 'utf8')

    expect(source).toContain("'/api/payments/process'")
    expect(source).toContain("'/api/payments/square'")
    expect(source).toContain("'/api/payments/paypal'")
    expect(source).toContain("'/api/payments/settings'")

    const nonApiPaymentRouteMatches = source.match(
      /fastify\.(get|post|put|patch|delete)(<[^>]*>)?\(\s*['\"]\/payments\//g
    )

    expect(nonApiPaymentRouteMatches ?? []).toHaveLength(0)
  })

  it('uses /api prefix for sync batch route', () => {
    const source = fs.readFileSync(syncRouteFile, 'utf8')

    expect(source).toContain("'/api/sync/batch'")
    expect(source).not.toContain("'/sync/batch'")
  })
})
