import { Prisma, SecurityEventType, SecuritySeverity } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { prisma } from '../utils/db'

function resolveFirstEnv(keys: string[]): { key?: string; value?: string } {
  for (const key of keys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return { key, value }
    }
  }
  return {}
}

function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return undefined
  }
  return parsed
}

function toPrismaJson(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!value) return undefined
  return value as Prisma.InputJsonValue
}

export async function logSecurityEventRecord(args: {
  eventType: SecurityEventType
  severity: SecuritySeverity
  source: string
  message: string
  details?: Record<string, unknown>
  actorId?: string
  ipAddress?: string
}) {
  return prisma.securityEvent.create({
    data: {
      eventType: args.eventType,
      severity: args.severity,
      source: args.source,
      message: args.message,
      details: toPrismaJson(args.details),
      actorId: args.actorId,
      ipAddress: args.ipAddress,
    },
  })
}

export async function logKeyRotation(args: {
  component: string
  oldKeyVersion?: string
  newKeyVersion?: string
  status?: string
  details?: Record<string, unknown>
  actorId?: string
}) {
  return prisma.keyRotationLog.create({
    data: {
      component: args.component,
      oldKeyVersion: args.oldKeyVersion,
      newKeyVersion: args.newKeyVersion,
      status: args.status || 'success',
      details: toPrismaJson(args.details),
      actorId: args.actorId,
    },
  })
}

export async function logBackupDrillEvent(args: {
  drillId: string
  drillType: 'daily_backup' | 'weekly_restore_simulation'
  eventKind: 'BACKUP_INITIATED' | 'BACKUP_COMPLETED' | 'BACKUP_FAILED' | 'RESTORE_SIMULATION_INITIATED' | 'RESTORE_SIMULATION_COMPLETED' | 'RESTORE_SIMULATION_FAILED'
  status: 'in_progress' | 'completed' | 'failed'
  source?: string
  summary?: string
  details?: Record<string, unknown>
  actorId?: string
  ipAddress?: string
}) {
  const severity = args.status === 'failed' ? SecuritySeverity.HIGH : SecuritySeverity.LOW
  return logSecurityEventRecord({
    eventType: SecurityEventType.UNKNOWN,
    severity,
    source: args.source || 'api/security/backup-drills',
    message: args.summary || `${args.eventKind} (${args.drillType})`,
    details: {
      drillId: args.drillId,
      drillType: args.drillType,
      eventKind: args.eventKind,
      status: args.status,
      ...(args.details || {}),
    },
    actorId: args.actorId,
    ipAddress: args.ipAddress,
  })
}

export async function collectAndPersistSecurityStatus(request?: FastifyRequest) {
  const httpsEnv = resolveFirstEnv(['ENFORCE_HTTPS', 'HTTPS_ONLY'])
  const tlsKeyEnv = resolveFirstEnv(['TLS_KEY_PATH', 'SSL_KEY_PATH'])
  const tlsCertEnv = resolveFirstEnv(['TLS_CERT_PATH', 'SSL_CERT_PATH'])
  const tlsCaEnv = resolveFirstEnv(['TLS_CA_PATH', 'SSL_CA_PATH'])

  const certSubjectEnv = resolveFirstEnv(['TLS_CERT_SUBJECT', 'SSL_CERT_SUBJECT'])
  const certIssuerEnv = resolveFirstEnv(['TLS_CERT_ISSUER', 'SSL_CERT_ISSUER'])
  const certValidFromEnv = resolveFirstEnv(['TLS_CERT_VALID_FROM', 'SSL_CERT_VALID_FROM'])
  const certValidToEnv = resolveFirstEnv(['TLS_CERT_VALID_TO', 'SSL_CERT_VALID_TO'])

  const httpsEnforced =
    process.env.NODE_ENV === 'production' ||
    (httpsEnv.value ? ['1', 'true', 'yes'].includes(httpsEnv.value.toLowerCase()) : false)

  const coreHeaderPosture = {
    configuredViaSecurityPlugin: true,
    headers: {
      strictTransportSecurity: {
        configured: true,
        source: 'middleware/security.ts',
      },
      xContentTypeOptions: {
        configured: true,
        source: 'middleware/security.ts',
      },
      xFrameOptions: {
        configured: true,
        source: 'middleware/security.ts',
      },
      xXssProtection: {
        configured: true,
        source: 'middleware/security.ts',
      },
      contentSecurityPolicy: {
        configured: true,
        source: 'middleware/security.ts',
      },
    },
  }

  const warnings: string[] = []
  if (!httpsEnforced) warnings.push('HTTPS is not enforced by current app configuration.')
  if (!tlsKeyEnv.value || !tlsCertEnv.value) {
    warnings.push('TLS key/cert paths are not both configured in backend environment.')
  }

  const status = warnings.length === 0 ? 'healthy' : 'warning'

  const snapshot = await prisma.systemSecurityStatus.create({
    data: {
      httpsEnforced,
      tlsKeyPathConfigured: Boolean(tlsKeyEnv.value),
      tlsCertPathConfigured: Boolean(tlsCertEnv.value),
      tlsCaPathConfigured: Boolean(tlsCaEnv.value),
      tlsCertSubject: certSubjectEnv.value,
      tlsCertIssuer: certIssuerEnv.value,
      tlsCertValidFrom: parseOptionalDate(certValidFromEnv.value),
      tlsCertValidTo: parseOptionalDate(certValidToEnv.value),
      coreHeaderPosture,
      status,
      notes: warnings.length > 0 ? warnings.join(' ') : 'Security posture is healthy.',
      checkedAt: new Date(),
    },
  })

  return {
    status: snapshot.status,
    checkedAt: snapshot.checkedAt,
    https: {
      enforced: snapshot.httpsEnforced,
      source: httpsEnv.key || (process.env.NODE_ENV === 'production' ? 'NODE_ENV=production' : 'default'),
      known: true,
    },
    tls: {
      keyPath: {
        configured: snapshot.tlsKeyPathConfigured,
        sourceEnv: tlsKeyEnv.key || 'unavailable',
      },
      certPath: {
        configured: snapshot.tlsCertPathConfigured,
        sourceEnv: tlsCertEnv.key || 'unavailable',
      },
      caPath: {
        configured: snapshot.tlsCaPathConfigured,
        sourceEnv: tlsCaEnv.key || 'unavailable',
      },
      certificateMetadata: {
        subject: snapshot.tlsCertSubject || null,
        issuer: snapshot.tlsCertIssuer || null,
        validFrom: snapshot.tlsCertValidFrom ? snapshot.tlsCertValidFrom.toISOString() : null,
        validTo: snapshot.tlsCertValidTo ? snapshot.tlsCertValidTo.toISOString() : null,
        availability: {
          subject: Boolean(snapshot.tlsCertSubject),
          issuer: Boolean(snapshot.tlsCertIssuer),
          validityWindow: Boolean(snapshot.tlsCertValidFrom && snapshot.tlsCertValidTo),
        },
      },
    },
    headers: coreHeaderPosture,
    unknowns: [],
    notes: warnings,
    requestContext: {
      requestId: request?.id || null,
      observedProtocol: request?.protocol || 'unavailable',
      sslTermination: 'unknown_or_external',
    },
  }
}
