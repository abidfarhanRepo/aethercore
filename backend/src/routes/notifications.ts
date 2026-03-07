import { FastifyInstance } from 'fastify'
import { requireAuth } from '../plugins/authMiddleware'
import {
  archiveNotification,
  getUnreadCount,
  listNotifications,
  markNotificationRead,
} from '../lib/notificationService'

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get('/api/notifications', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user
    const query = (req.query || {}) as {
      includeArchived?: string
      unreadOnly?: string
      limit?: string
    }

    const includeArchived = query.includeArchived === 'true'
    const unreadOnly = query.unreadOnly === 'true'
    const limit = query.limit ? Number(query.limit) : undefined

    if (!user?.id) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    const notifications = await listNotifications({
      recipientId: user.id,
      includeArchived,
      unreadOnly,
      limit,
    })

    return { notifications }
  })

  fastify.get('/api/notifications/unread-count', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user
    if (!user?.id) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    const count = await getUnreadCount(user.id)
    return { unreadCount: count }
  })

  fastify.patch('/api/notifications/:id/read', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user
    const { id } = req.params as { id: string }

    if (!user?.id) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    const updated = await markNotificationRead(id, user.id)
    if (updated.count === 0) {
      return reply.code(404).send({ error: 'Notification not found' })
    }

    return { ok: true }
  })

  fastify.patch('/api/notifications/:id/archive', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user
    const { id } = req.params as { id: string }

    if (!user?.id) {
      return reply.code(401).send({ error: 'unauthenticated' })
    }

    const updated = await archiveNotification(id, user.id)
    if (updated.count === 0) {
      return reply.code(404).send({ error: 'Notification not found' })
    }

    return { ok: true }
  })
}
