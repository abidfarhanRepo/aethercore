import { SecurityEventType, SecuritySeverity } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../plugins/authMiddleware'
import {
  collectAndPersistSecurityStatus,
  logSecurityEventRecord,
  logKeyRotation,
} from '../lib/securityCompliance'
import {
  createKeyRotationNotification,
  createSecurityStatusFailureNotification,
} from '../lib/notificationService'
import { prisma } from '../utils/db'

interface SecurityListQuery {
  limit?: string
}

interface RotateKeysBody {
  component?: 'jwt_access' | 'jwt_refresh' | 'encryption' | 'tls' | 'settings'
  newVersion?: string
  notes?: string
}

const ALLOWED_ROTATION_COMPONENTS = new Set(['jwt_access', 'jwt_refresh', 'encryption', 'tls', 'settings'])

export default async function securityRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/security/status',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (req, reply) => {
      try {
        const status = await collectAndPersistSecurityStatus(req)
        return status
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        const actorId = (req as any).user?.id as string | undefined

        await logSecurityEventRecord({
          eventType: SecurityEventType.SECURITY_STATUS_CHECK_FAILED,
          severity: SecuritySeverity.HIGH,
          source: 'api/security/status',
          message: 'Security status check failed',
          details: { error: message },
          actorId,
          ipAddress: req.ip,
        }).catch((eventError) => {
          req.log.error({ err: eventError }, 'Failed to persist security status failure event')
        })

        await createSecurityStatusFailureNotification(message, actorId).catch((notificationError) => {
          req.log.error({ err: notificationError }, 'Failed to persist security status failure notification')
        })

        return reply.code(500).send({
          error: 'Failed to collect security status',
          details: message,
        })
      }
    }
  )

  fastify.get(
    '/api/security/events',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (req, reply) => {
      const query = (req.query || {}) as SecurityListQuery
      const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200)

      try {
        const events = await prisma.securityEvent.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
        })

        return {
          items: events,
          meta: { limit, count: events.length },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return reply.code(500).send({ error: 'Failed to fetch security events', details: message })
      }
    }
  )

  fastify.get(
    '/api/security/key-rotations',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (req, reply) => {
      const query = (req.query || {}) as SecurityListQuery
      const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200)

      try {
        const rotations = await prisma.keyRotationLog.findMany({
          orderBy: { rotatedAt: 'desc' },
          take: limit,
        })

        return {
          items: rotations,
          meta: { limit, count: rotations.length },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return reply.code(500).send({ error: 'Failed to fetch key rotation logs', details: message })
      }
    }
  )

  fastify.post(
    '/api/security/rotate-keys',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (req, reply) => {
      const body = (req.body || {}) as RotateKeysBody
      const actorId = (req as any).user?.id as string | undefined

      if (!body.component || !ALLOWED_ROTATION_COMPONENTS.has(body.component)) {
        return reply.code(400).send({
          error: 'Invalid component',
          allowedComponents: Array.from(ALLOWED_ROTATION_COMPONENTS),
        })
      }

      if (!body.newVersion?.trim()) {
        return reply.code(400).send({ error: 'newVersion is required' })
      }

      try {
        const latestForComponent = await prisma.keyRotationLog.findFirst({
          where: { component: body.component },
          orderBy: { rotatedAt: 'desc' },
        })

        const rotation = await logKeyRotation({
          component: body.component,
          oldKeyVersion: latestForComponent?.newKeyVersion || undefined,
          newKeyVersion: body.newVersion,
          status: 'success',
          details: {
            notes: body.notes || null,
            requiresManualEnvUpdate: true,
            requiresRedeploy: true,
          },
          actorId,
        })

        await logSecurityEventRecord({
          eventType: SecurityEventType.KEY_ROTATION,
          severity: SecuritySeverity.MEDIUM,
          source: 'api/security/rotate-keys',
          message: `Key rotation logged for ${body.component}`,
          details: {
            component: body.component,
            oldKeyVersion: latestForComponent?.newKeyVersion || null,
            newVersion: body.newVersion,
            notes: body.notes || null,
            requiresManualEnvUpdate: true,
            requiresRedeploy: true,
          },
          actorId,
          ipAddress: req.ip,
        })

        await createKeyRotationNotification({
          component: body.component,
          status: 'success',
          actorId,
          details: {
            oldKeyVersion: latestForComponent?.newKeyVersion || null,
            newVersion: body.newVersion,
            notes: body.notes || null,
          },
        })

        return reply.code(201).send({
          message:
            'Rotation has been logged. Apply the new secret/certificate in your secret provider, then redeploy affected services to activate it.',
          actionRequired: [
            'Update secret provider value (K8s Secret / vault / CI secret).',
            'Roll backend/frontend deployments that consume this secret.',
            'Verify /api/security/status and /api/health after rollout.',
          ],
          rotation,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        await logSecurityEventRecord({
          eventType: SecurityEventType.KEY_ROTATION,
          severity: SecuritySeverity.HIGH,
          source: 'api/security/rotate-keys',
          message: 'Key rotation attempt failed',
          details: {
            component: body.component,
            error: message,
          },
          actorId,
          ipAddress: req.ip,
        }).catch(() => {})

        await createKeyRotationNotification({
          component: body.component || 'unknown',
          status: 'failed',
          actorId,
          details: { error: message },
        }).catch(() => {})

        return reply.code(500).send({
          error: 'Failed to rotate keys',
          details: message,
        })
      }
    }
  )
}
