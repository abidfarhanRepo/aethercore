import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/db'
import { requireAuth, requireRole } from '../plugins/authMiddleware'

interface SettingsRequest extends FastifyRequest {
  user?: any
}

interface SettingUpdateRequest {
  value: string | number | boolean | object
}

interface BatchSettingsUpdateRequest {
  settings: Array<{
    key: string
    value: string | number | boolean | object
  }>
}

export default async function settingsRoutes(fastify: FastifyInstance) {
  const requireManagerRole = requireRole('ADMIN', 'MANAGER')

  // GET all settings grouped by category
  fastify.get(
    '/api/settings',
    { preHandler: [requireAuth, requireManagerRole] },
    async (request: SettingsRequest, reply: FastifyReply) => {

      const settings = await prisma.settings.findMany({
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      })

      // Filter out encrypted values from response (don't send encrypted data to frontend)
      const filtered = settings.map((s) => ({
        ...s,
        value: s.isEncrypted ? '***ENCRYPTED***' : s.value,
      }))

      // Group by category
      const grouped = filtered.reduce(
        (acc, setting) => {
          if (!acc[setting.category]) {
            acc[setting.category] = []
          }
          acc[setting.category].push(setting)
          return acc
        },
        {} as Record<string, typeof filtered>
      )

      return grouped
    }
  )

  // GET specific setting by key
  fastify.get(
    '/api/settings/:key',
    { preHandler: [requireAuth, requireManagerRole] },
    async (request: SettingsRequest, reply: FastifyReply) => {

      const { key } = request.params as { key: string }

      const setting = await prisma.settings.findUnique({
        where: { key },
      })

      if (!setting) {
        return { error: 'Setting not found' }
      }

      return {
        ...setting,
        value: setting.isEncrypted ? '***ENCRYPTED***' : setting.value,
      }
    }
  )

  // GET settings by category
  fastify.get(
    '/api/settings/category/:category',
    { preHandler: [requireAuth, requireManagerRole] },
    async (request: SettingsRequest, reply: FastifyReply) => {

      const { category } = request.params as { category: string }

      const settings = await prisma.settings.findMany({
        where: { category },
        orderBy: { key: 'asc' },
      })

      // Filter out encrypted values
      return settings.map((s) => ({
        ...s,
        value: s.isEncrypted ? '***ENCRYPTED***' : s.value,
      }))
    }
  )

  // PUT update a specific setting
  fastify.put(
    '/api/settings/:key',
    {
      preHandler: [requireAuth, requireManagerRole],
      schema: {
        params: {
          type: 'object',
          required: ['key'],
          properties: { key: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['value'],
          properties: {
            value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
          },
        },
      },
    },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const { key } = request.params as { key: string }
      const { value } = request.body as SettingUpdateRequest

      // Check if setting exists
      const existing = await prisma.settings.findUnique({
        where: { key },
      })

      if (!existing) {
        return { error: 'Setting not found' }
      }

      // Validate value based on type
      let finalValue = String(value)

      if (existing.type === 'number') {
        const num = Number(value)
        if (isNaN(num)) {
          return { error: `Invalid value for number type: ${value}` }
        }
        finalValue = String(num)
      } else if (existing.type === 'boolean') {
        if (typeof value !== 'boolean') {
          return { error: 'Invalid value for boolean type' }
        }
        finalValue = String(value)
      }

      const updated = await prisma.settings.update({
        where: { key },
        data: {
          value: finalValue,
          updatedBy: request.user?.id,
        },
      })

      return {
        ...updated,
        value: updated.isEncrypted ? '***ENCRYPTED***' : updated.value,
      }
    }
  )

  // POST batch update multiple settings
  fastify.post(
    '/api/settings/batch',
    {
      preHandler: [requireAuth, requireManagerRole],
      schema: {
        body: {
          type: 'object',
          required: ['settings'],
          properties: {
            settings: {
              type: 'array',
              items: {
                type: 'object',
                required: ['key', 'value'],
                properties: {
                  key: { type: 'string' },
                  value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
                },
              },
            },
          },
        },
      },
    },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const { settings: updates } = request.body as BatchSettingsUpdateRequest
      const results = []

      for (const update of updates) {
        try {
          const existing = await prisma.settings.findUnique({
            where: { key: update.key },
          })

          if (!existing) {
            results.push({
              key: update.key,
              success: false,
              error: 'Setting not found',
            })
            continue
          }

          let finalValue = String(update.value)

          if (existing.type === 'number') {
            const num = Number(update.value)
            if (isNaN(num)) {
              results.push({
                key: update.key,
                success: false,
                error: `Invalid value for number type`,
              })
              continue
            }
            finalValue = String(num)
          } else if (existing.type === 'boolean') {
            if (typeof update.value !== 'boolean') {
              results.push({
                key: update.key,
                success: false,
                error: 'Invalid value for boolean type',
              })
              continue
            }
            finalValue = String(update.value)
          }

          const updated = await prisma.settings.update({
            where: { key: update.key },
            data: {
              value: finalValue,
              updatedBy: request.user?.id,
            },
          })

          results.push({
            key: update.key,
            success: true,
            data: {
              ...updated,
              value: updated.isEncrypted ? '***ENCRYPTED***' : updated.value,
            },
          })
        } catch (error: any) {
          results.push({
            key: update.key,
            success: false,
            error: error.message,
          })
        }
      }

      return { results }
    }
  )

  // POST create a new setting (admin only - seeding)
  fastify.post(
    '/api/settings',
    {
      preHandler: [requireAuth, requireRole('ADMIN')],
      schema: {
        body: {
          type: 'object',
          required: ['key', 'value', 'category'],
          properties: {
            key: { type: 'string' },
            value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
            category: { type: 'string' },
            type: { type: 'string', enum: ['string', 'number', 'boolean', 'json'] },
            label: { type: 'string' },
            description: { type: 'string' },
            isEncrypted: { type: 'boolean' },
          },
        },
      },
    },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const user = request.user
      const { key, value, category, type = 'string', label, description, isEncrypted = false } = request.body as any

      const existing = await prisma.settings.findUnique({
        where: { key },
      })

      if (existing) {
        return { error: 'Setting with this key already exists' }
      }

      const setting = await prisma.settings.create({
        data: {
          key,
          value: String(value),
          category,
          type,
          label,
          description,
          isEncrypted,
          updatedBy: user.id,
        },
      })

      return {
        ...setting,
        value: setting.isEncrypted ? '***ENCRYPTED***' : setting.value,
      }
    }
  )

  // DELETE a setting (admin only)
  fastify.delete(
    '/api/settings/:key',
    {
      preHandler: [requireAuth, requireRole('ADMIN')],
      schema: {
        params: {
          type: 'object',
          required: ['key'],
          properties: { key: { type: 'string' } },
        },
      },
    },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const { key } = request.params as { key: string }

      const deleted = await prisma.settings.delete({
        where: { key },
      })

      return { success: true, deleted: deleted.key }
    }
  )

  // TAX RATES ENDPOINTS

  // GET all tax rates
  fastify.get(
    '/api/settings/tax-rates',
    { preHandler: [requireAuth, requireManagerRole] },
    async (request: SettingsRequest, reply: FastifyReply) => {

      const rates = await prisma.taxRate.findMany({
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      })

      return rates
    }
  )

  // GET tax rate by id
  fastify.get(
    '/api/settings/tax-rates/:id',
    { preHandler: [requireAuth, requireManagerRole] },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      const rate = await prisma.taxRate.findUnique({
        where: { id },
      })

      return rate || { error: 'Tax rate not found' }
    }
  )

  // POST create tax rate
  fastify.post(
    '/api/settings/tax-rates',
    {
      preHandler: [requireAuth, requireManagerRole],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'rate'],
          properties: {
            name: { type: 'string' },
            rate: { type: 'number', minimum: 0, maximum: 100 },
            location: { type: 'string' },
            description: { type: 'string' },
            isActive: { type: 'boolean' },
            isDefault: { type: 'boolean' },
          },
        },
      },
    },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const { name, rate, location, description, isActive = true, isDefault = false } = request.body as any

      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.taxRate.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        })
      }

      const taxRate = await prisma.taxRate.create({
        data: {
          name,
          rate,
          location,
          description,
          isActive,
          isDefault,
        },
      })

      return taxRate
    }
  )

  // PUT update tax rate
  fastify.put(
    '/api/settings/tax-rates/:id',
    {
      preHandler: [requireAuth, requireManagerRole],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            rate: { type: 'number', minimum: 0, maximum: 100 },
            location: { type: 'string' },
            description: { type: 'string' },
            isActive: { type: 'boolean' },
            isDefault: { type: 'boolean' },
          },
        },
      },
    },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const { name, rate, location, description, isActive, isDefault } = request.body as any

      // If setting as default, unset other defaults
      if (isDefault) {
        await prisma.taxRate.updateMany({
          where: { id: { not: id } },
          data: { isDefault: false },
        })
      }

      const taxRate = await prisma.taxRate.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(rate !== undefined && { rate }),
          ...(location !== undefined && { location }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
          ...(isDefault !== undefined && { isDefault }),
        },
      })

      return taxRate
    }
  )

  // DELETE tax rate
  fastify.delete(
    '/api/settings/tax-rates/:id',
    {
      preHandler: [requireAuth, requireManagerRole],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      await prisma.taxRate.delete({
        where: { id },
      })

      return { success: true }
    }
  )

  // TAX EXEMPTIONS ENDPOINTS

  // GET all tax exemptions
  fastify.get(
    '/api/settings/tax-exemptions',
    { preHandler: [requireAuth, requireManagerRole] },
    async (request: SettingsRequest, reply: FastifyReply) => {

      const exemptions = await prisma.taxExemption.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      })

      return exemptions
    }
  )

  // POST create tax exemption
  fastify.post(
    '/api/settings/tax-exemptions',
    {
      preHandler: [requireAuth, requireManagerRole],
      schema: {
        body: {
          type: 'object',
          required: ['reason'],
          properties: {
            category: { type: 'string' },
            productId: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const { category, productId, reason } = request.body as any

      const exemption = await prisma.taxExemption.create({
        data: {
          category,
          productId,
          reason,
          isActive: true,
        },
      })

      return exemption
    }
  )

  // DELETE tax exemption
  fastify.delete(
    '/api/settings/tax-exemptions/:id',
    {
      preHandler: [requireAuth, requireManagerRole],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request: SettingsRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }

      await prisma.taxExemption.update({
        where: { id },
        data: { isActive: false },
      })

      return { success: true }
    }
  )
}
