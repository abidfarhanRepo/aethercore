import { requireAllCapabilities, requireCapability } from '../../src/middleware/capabilityMiddleware'

const mockResolveTenantIdForUser = jest.fn()
const mockIsCapabilityEnabledForTenant = jest.fn()

jest.mock('../../src/lib/pluginService', () => ({
  resolveTenantIdForUser: (...args: unknown[]) => mockResolveTenantIdForUser(...args),
  isCapabilityEnabledForTenant: (...args: unknown[]) => mockIsCapabilityEnabledForTenant(...args),
}))

describe('capabilityMiddleware', () => {
  const makeReply = () => {
    const send = jest.fn()
    const code = jest.fn(() => ({ send }))
    return { code, send }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveTenantIdForUser.mockResolvedValue('tenant-1')
  })

  it('allows request when required capability is enabled', async () => {
    mockIsCapabilityEnabledForTenant.mockResolvedValue(true)
    const middleware = requireCapability('restaurant.kds')

    const req = { user: { id: 'u1', tenantId: 'tenant-1' } } as any
    const reply = makeReply() as any

    await middleware(req, reply)

    expect(mockIsCapabilityEnabledForTenant).toHaveBeenCalledWith('tenant-1', 'restaurant.kds')
    expect(reply.code).not.toHaveBeenCalled()
  })

  it('fails closed when capability is disabled', async () => {
    mockIsCapabilityEnabledForTenant.mockResolvedValue(false)
    const middleware = requireCapability('restaurant.kds')

    const req = { user: { id: 'u1', tenantId: 'tenant-1' } } as any
    const reply = makeReply() as any

    await middleware(req, reply)

    expect(reply.code).toHaveBeenCalledWith(403)
  })

  it('fails when any capability in list is disabled', async () => {
    mockIsCapabilityEnabledForTenant
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    const middleware = requireAllCapabilities(['inventory.expiry', 'inventory.lot_tracking'])

    const req = { user: { id: 'u1', tenantId: 'tenant-1' } } as any
    const reply = makeReply() as any

    await middleware(req, reply)

    expect(reply.code).toHaveBeenCalledWith(403)
  })
})
