import { FastifyReply, FastifyRequest } from 'fastify'
import { SecurityEventType, SecuritySeverity } from '@prisma/client'
import { logSecurityEventRecord } from '../lib/securityCompliance'
import { isCapabilityEnabledForTenant, resolveTenantIdForUser } from '../lib/pluginService'

async function deny(req: FastifyRequest, reply: FastifyReply, capability: string) {
  await logSecurityEventRecord({
    eventType: SecurityEventType.CAPABILITY_DENIED,
    severity: SecuritySeverity.MEDIUM,
    source: 'middleware/capability',
    message: `Capability denied: ${capability}`,
    details: {
      type: 'authz.capability_denied',
      capability,
      path: req.url,
      method: req.method,
    },
    actorId: req.user?.id,
    ipAddress: req.ip,
  }).catch(() => {})

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
      return deny(req, reply, capability)
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
        return deny(req, reply, capability)
      }
    }
  }
}
