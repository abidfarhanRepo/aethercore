import { FastifyReply, FastifyRequest } from 'fastify'
import { isCapabilityEnabledForTenant, resolveTenantIdForUser } from '../lib/pluginService'

async function deny(reply: FastifyReply, capability: string) {
  return reply.code(403).send({
    error: 'Capability disabled',
    capability,
    code: 'CAPABILITY_DISABLED',
  })
}

export function requireCapability(capability: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as { id?: string; tenantId?: string | null } | undefined
    const tenantId = await resolveTenantIdForUser(user)

    const enabled = await isCapabilityEnabledForTenant(tenantId, capability)
    if (!enabled) {
      return deny(reply, capability)
    }
  }
}

export function requireAllCapabilities(capabilities: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as { id?: string; tenantId?: string | null } | undefined
    const tenantId = await resolveTenantIdForUser(user)

    for (const capability of capabilities) {
      const enabled = await isCapabilityEnabledForTenant(tenantId, capability)
      if (!enabled) {
        return deny(reply, capability)
      }
    }
  }
}
