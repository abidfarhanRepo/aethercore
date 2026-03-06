import { FastifyInstance } from 'fastify'
import { TenantProfile } from '@prisma/client'
import { prisma } from '../utils/db'
import { requireAuth, requireRole } from '../plugins/authMiddleware'
import { ensureTenantCapabilityFlag, PROFILE_CAPABILITY_DEFAULTS } from '../lib/pluginService'

function parseProfile(value?: string): TenantProfile {
  if (!value) return 'GENERAL'
  const normalized = value.toUpperCase()
  if (normalized === 'SUPERMARKET' || normalized === 'RESTAURANT' || normalized === 'PHARMACY' || normalized === 'GENERAL') {
    return normalized as TenantProfile
  }
  return 'GENERAL'
}

export default async function pluginRoutes(fastify: FastifyInstance) {
  const managerGuard = [requireAuth, requireRole('ADMIN', 'MANAGER')]

  fastify.get('/api/plugins', { preHandler: managerGuard }, async () => {
    const plugins = await prisma.plugin.findMany({
      include: {
        capabilities: {
          select: { key: true, name: true, description: true, isDefault: true },
          orderBy: { key: 'asc' },
        },
        dependencies: {
          include: {
            dependsOnPlugin: { select: { key: true, version: true } },
          },
        },
      },
      orderBy: [{ isCore: 'desc' }, { key: 'asc' }],
    })

    return { plugins }
  })

  fastify.get('/api/plugins/tenants', { preHandler: managerGuard }, async () => {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: { select: { users: true, featureFlags: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return { tenants }
  })

  fastify.post('/api/plugins/tenants', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const body = (req.body || {}) as { name?: string; code?: string; profile?: string }

    if (!body.name || !body.code) {
      return reply.code(400).send({ error: 'name and code are required' })
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: body.name,
        code: body.code.toUpperCase(),
        profile: parseProfile(body.profile),
      },
    })

    return reply.code(201).send(tenant)
  })

  fastify.get('/api/plugins/tenants/:tenantId/feature-flags', { preHandler: managerGuard }, async (req, reply) => {
    const { tenantId } = req.params as { tenantId: string }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        featureFlags: {
          orderBy: { capabilityKey: 'asc' },
        },
      },
    })

    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' })
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        code: tenant.code,
        profile: tenant.profile,
      },
      defaults: PROFILE_CAPABILITY_DEFAULTS[tenant.profile],
      flags: tenant.featureFlags,
    }
  })

  fastify.put('/api/plugins/tenants/:tenantId/feature-flags/:capabilityKey', { preHandler: managerGuard }, async (req, reply) => {
    const { tenantId, capabilityKey } = req.params as { tenantId: string; capabilityKey: string }
    const body = (req.body || {}) as { enabled?: boolean; config?: Record<string, unknown> }

    if (typeof body.enabled !== 'boolean') {
      return reply.code(400).send({ error: 'enabled must be a boolean' })
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' })
    }

    const upserted = await ensureTenantCapabilityFlag({
      tenantId,
      capabilityKey,
      enabled: body.enabled,
      updatedBy: (req as any).user?.id,
      config: body.config,
    })

    return upserted
  })

  fastify.post('/api/plugins/:pluginKey/enable', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { pluginKey } = req.params as { pluginKey: string }
    const { tenantId } = (req.body || {}) as { tenantId?: string }

    const plugin = await prisma.plugin.findUnique({
      where: { key: pluginKey },
      include: { capabilities: { select: { key: true } } },
    })

    if (!plugin) {
      return reply.code(404).send({ error: 'Plugin not found' })
    }

    await prisma.plugin.update({ where: { id: plugin.id }, data: { isEnabled: true } })

    if (tenantId) {
      for (const capability of plugin.capabilities) {
        await ensureTenantCapabilityFlag({
          tenantId,
          capabilityKey: capability.key,
          enabled: true,
          updatedBy: (req as any).user?.id,
          sourcePluginId: plugin.id,
        })
      }
    }

    return { ok: true, pluginKey, isEnabled: true }
  })

  fastify.post('/api/plugins/:pluginKey/disable', { preHandler: [requireAuth, requireRole('ADMIN')] }, async (req, reply) => {
    const { pluginKey } = req.params as { pluginKey: string }
    const { tenantId } = (req.body || {}) as { tenantId?: string }

    const plugin = await prisma.plugin.findUnique({
      where: { key: pluginKey },
      include: {
        dependencies: {
          include: {
            dependsOnPlugin: { select: { key: true } },
          },
        },
        capabilities: { select: { key: true } },
      },
    })

    if (!plugin) {
      return reply.code(404).send({ error: 'Plugin not found' })
    }

    const dependents = await prisma.pluginDependency.findMany({
      where: {
        dependsOnPluginId: plugin.id,
        plugin: { isEnabled: true },
      },
      include: {
        plugin: { select: { key: true } },
      },
    })

    if (dependents.length > 0) {
      return reply.code(409).send({
        error: 'Dependency conflict',
        details: dependents.map((item) => item.plugin.key),
      })
    }

    await prisma.plugin.update({ where: { id: plugin.id }, data: { isEnabled: false } })

    if (tenantId) {
      for (const capability of plugin.capabilities) {
        await ensureTenantCapabilityFlag({
          tenantId,
          capabilityKey: capability.key,
          enabled: false,
          updatedBy: (req as any).user?.id,
          sourcePluginId: plugin.id,
        })
      }
    }

    return { ok: true, pluginKey, isEnabled: false }
  })
}
