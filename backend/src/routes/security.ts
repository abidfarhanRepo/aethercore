import { SecurityEventType, SecuritySeverity } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import { requireAuth, requireRole } from '../plugins/authMiddleware'
import {
  collectAndPersistSecurityStatus,
  logBackupDrillEvent,
  logSecurityEventRecord,
  logKeyRotation,
} from '../lib/securityCompliance'
import {
  evaluateAlertRules,
  getAlertRulesConfig,
  saveAlertRulesConfig,
  type AlertRuleType,
} from '../lib/alertService'
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

interface BackupDrillListQuery {
  limit?: string
  drillType?: 'daily_backup' | 'weekly_restore_simulation'
  status?: 'in_progress' | 'completed' | 'failed'
}

interface BackupDrillSimulationBody {
  snapshotId?: string
  expectedMinRecords?: number
  simulateFailure?: boolean
}

interface AlertRulePatch {
  enabled?: boolean
  threshold?: number
  windowMinutes?: number
}

interface AlertRulesUpdateBody {
  routingPolicy?: {
    notifyAdminManager?: boolean
  }
  rules?: Partial<Record<AlertRuleType, AlertRulePatch>>
}

const ALLOWED_ROTATION_COMPONENTS = new Set(['jwt_access', 'jwt_refresh', 'encryption', 'tls', 'settings'])

export default async function securityRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/v1/security/status',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (req, reply) => {
      try {
        const status = await collectAndPersistSecurityStatus(req)
        return status
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        const actorId = req.user?.id

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
    '/api/v1/security/events',
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
    '/api/v1/security/key-rotations',
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
    '/api/v1/security/rotate-keys',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (req, reply) => {
      const body = (req.body || {}) as RotateKeysBody
      const actorId = req.user?.id

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
            'Verify /api/v1/security/status and /api/v1/health after rollout.',
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

  fastify.get(
    '/api/v1/security/backup-drills',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (req, reply) => {
      const query = (req.query || {}) as BackupDrillListQuery
      const limit = Math.min(Math.max(Number(query.limit || 50), 1), 200)

      try {
        const rawEvents = await prisma.securityEvent.findMany({
          where: {
            OR: [
              { source: 'api/security/backup-drills' },
              { source: 'cli/security/backup-drills' },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })

        const items = rawEvents.filter((event) => {
          const details = (event.details || {}) as Record<string, unknown>
          const drillType = typeof details.drillType === 'string' ? details.drillType : undefined
          const status = typeof details.status === 'string' ? details.status : undefined

          if (query.drillType && drillType !== query.drillType) {
            return false
          }

          if (query.status && status !== query.status) {
            return false
          }

          return true
        })

        return {
          items,
          meta: { limit, count: items.length },
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return reply.code(500).send({
          error: 'Failed to fetch backup drill history',
          details: message,
        })
      }
    }
  )

  fastify.post(
    '/api/v1/security/backup-drills/simulate-restore',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (req, reply) => {
      const actorId = req.user?.id
      const body = (req.body || {}) as BackupDrillSimulationBody

      if (process.env.NODE_ENV === 'production') {
        return reply.code(403).send({
          error: 'Restore simulation is blocked in production environments',
        })
      }

      const drillId = `restore-sim-${Date.now()}`
      const snapshotId = body.snapshotId || 'latest-backup'
      const startedAt = Date.now()

      try {
        await logBackupDrillEvent({
          drillId,
          drillType: 'weekly_restore_simulation',
          eventKind: 'RESTORE_SIMULATION_INITIATED',
          status: 'in_progress',
          summary: `Restore simulation initiated from snapshot ${snapshotId}`,
          details: {
            snapshotId,
            environment: process.env.NODE_ENV || 'development',
          },
          actorId,
          ipAddress: req.ip,
        })

        await prisma.$queryRaw`SELECT 1`

        const [saleCount, productCount, userCount] = await Promise.all([
          prisma.sale.count(),
          prisma.product.count(),
          prisma.user.count(),
        ])

        const totalRecords = saleCount + productCount + userCount

        if (typeof body.expectedMinRecords === 'number' && totalRecords < body.expectedMinRecords) {
          throw new Error(
            `Record validation failed. total=${totalRecords}, expectedMin=${body.expectedMinRecords}`
          )
        }

        if (body.simulateFailure === true) {
          throw new Error('Forced failure requested by simulateFailure=true')
        }

        const durationMs = Date.now() - startedAt

        await logBackupDrillEvent({
          drillId,
          drillType: 'weekly_restore_simulation',
          eventKind: 'RESTORE_SIMULATION_COMPLETED',
          status: 'completed',
          summary: 'Restore simulation completed successfully',
          details: {
            snapshotId,
            durationMs,
            counts: {
              sales: saleCount,
              products: productCount,
              users: userCount,
            },
            dataValidated: true,
          },
          actorId,
          ipAddress: req.ip,
        })

        return reply.send({
          drillId,
          status: 'completed',
          snapshotId,
          durationMs,
          counts: {
            sales: saleCount,
            products: productCount,
            users: userCount,
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        await logBackupDrillEvent({
          drillId,
          drillType: 'weekly_restore_simulation',
          eventKind: 'RESTORE_SIMULATION_FAILED',
          status: 'failed',
          summary: `Restore simulation failed: ${message}`,
          details: {
            snapshotId,
            error: message,
          },
          actorId,
          ipAddress: req.ip,
        }).catch(() => {})

        return reply.code(500).send({
          error: 'Restore simulation failed',
          details: message,
          drillId,
        })
      }
    }
  )

  fastify.get(
    '/api/v1/security/alert-rules',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (_req, reply) => {
      try {
        const config = await getAlertRulesConfig()
        return { config }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return reply.code(500).send({ error: 'Failed to fetch alert rules', details: message })
      }
    }
  )

  fastify.put(
    '/api/v1/security/alert-rules',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (req, reply) => {
      const body = (req.body || {}) as AlertRulesUpdateBody
      try {
        const config = await saveAlertRulesConfig(body, req.user?.id)
        return { config }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return reply.code(500).send({ error: 'Failed to update alert rules', details: message })
      }
    }
  )

  fastify.post(
    '/api/v1/security/alert-rules/evaluate',
    { preHandler: [requireAuth, requireRole('ADMIN', 'MANAGER')] },
    async (req, reply) => {
      try {
        const evaluation = await evaluateAlertRules(req.user?.id, req.ip)
        return { evaluation }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return reply.code(500).send({ error: 'Failed to evaluate alert rules', details: message })
      }
    }
  )
}
