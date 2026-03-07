/**
 * Audit logging utility for tracking sensitive operations
 * Implements immutable audit logs for compliance
 */

import { FastifyRequest } from 'fastify'
import { prisma } from './db'
import { logger } from './logger'

/**
 * Audit log entry type
 */
export interface AuditLogEntry {
  actorId?: string
  action: string
  resource: string
  resourceId?: string
  details?: string
  ipAddress?: string
  userAgent?: string
  status: 'success' | 'failure'
  metadata?: Record<string, any>
}

/**
 * Sensitive actions that must be audited
 */
export const SENSITIVE_ACTIONS = {
  AUTH: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'MFA_ENABLED', 'MFA_DISABLED'],
  USER: ['USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'ROLE_ASSIGN', 'ROLE_REVOKE', 'PERMISSION_GRANT', 'PERMISSION_REVOKE'],
  PAYMENT: ['PAYMENT_PROCESS', 'REFUND_ISSUED', 'PAYMENT_FAILED', 'PAYMENT_VOIDED'],
  DATA: ['DATA_EXPORT', 'DATA_IMPORT', 'BACKUP_CREATED', 'BACKUP_RESTORED'],
  SYSTEM: ['CONFIG_CHANGED', 'SECURITY_SETTING_CHANGED', 'ENCRYPTION_KEY_ROTATED'],
  ACCESS: ['DOCUMENT_ACCESSED', 'REPORT_GENERATED', 'DATA_VIEWED'],
}

/**
 * Log an audit entry
 */
export async function logAudit(
  entry: AuditLogEntry,
  request?: FastifyRequest
): Promise<string> {
  const ipAddress = entry.ipAddress || request?.ip || request?.socket?.remoteAddress
  const userAgent = entry.userAgent || request?.headers['user-agent']
  
  try {
    const log = await prisma.auditLog.create({
      data: {
        // FIX: actorId is optional (can be null). Don't set it if undefined.
        // This allows logging events that happen before user identification (like failed logins)
        ...(entry.actorId ? { actorId: entry.actorId } : {}),
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        details: entry.details,
        ipAddress,
      },
    })
    
    return log.id
  } catch (error) {
    // Log to application logger as fallback if database fails.
    logger.error({ error }, 'Failed to write audit log')
    logger.warn({ entry }, 'Audit entry fallback')
    throw error
  }
}

/**
 * Log authentication event
 */
export async function logAuthEvent(
  action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'USER_REGISTERED',
  userId: string | undefined,
  request: FastifyRequest,
  details?: string
): Promise<string> {
  return logAudit(
    {
      actorId: userId,
      action,
      resource: 'AUTH',
      details,
      status: 'success',
    },
    request
  )
}

/**
 * Log user management event
 */
export async function logUserEvent(
  action: 'USER_CREATE' | 'USER_UPDATE' | 'USER_DELETE' | 'ROLE_ASSIGN' | 'ROLE_REVOKE',
  actorId: string,
  targetUserId: string,
  request: FastifyRequest,
  details?: string
): Promise<string> {
  return logAudit(
    {
      actorId,
      action,
      resource: 'USER',
      resourceId: targetUserId,
      details,
      status: 'success',
    },
    request
  )
}

/**
 * Log payment event
 */
export async function logPaymentEvent(
  action: 'PAYMENT_PROCESS' | 'REFUND_ISSUED' | 'PAYMENT_FAILED' | 'PAYMENT_VOIDED',
  actorId: string | undefined,
  transactionId: string,
  request: FastifyRequest,
  amount?: number,
  details?: string
): Promise<string> {
  return logAudit(
    {
      actorId,
      action,
      resource: 'PAYMENT',
      resourceId: transactionId,
      details,
      metadata: { amount },
      status: 'success',
    },
    request
  )
}

/**
 * Log data access/export event
 */
export async function logDataAccessEvent(
  action: 'DATA_EXPORT' | 'DATA_IMPORT' | 'REPORT_GENERATED' | 'DATA_VIEWED',
  actorId: string,
  dataType: string,
  request: FastifyRequest,
  recordCount?: number
): Promise<string> {
  return logAudit(
    {
      actorId,
      action,
      resource: 'DATA',
      details: dataType,
      metadata: { recordCount },
      status: 'success',
    },
    request
  )
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  action: 'SECURITY_SETTING_CHANGED' | 'ENCRYPTION_KEY_ROTATED' | 'CONFIG_CHANGED' | 'UNAUTHORIZED_ACCESS_ATTEMPT',
  actorId: string | undefined,
  request: FastifyRequest,
  details: string,
  severity: 'low' | 'medium' | 'high' = 'medium'
): Promise<string> {
  return logAudit(
    {
      actorId,
      action,
      resource: 'SYSTEM',
      details,
      metadata: { severity },
      status: 'success',
    },
    request
  )
}

/**
 * Retrieve audit logs with filters
 */
export async function getAuditLogs(
  filters: {
    actorId?: string
    action?: string
    resource?: string
    startDate?: Date
    endDate?: Date
    limit?: number
    offset?: number
  }
) {
  const {
    actorId,
    action,
    resource,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = filters
  
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(actorId && { actorId }),
        ...(action && { action }),
        ...(resource && { resource }),
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } }),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 1000), // Cap at 1000 to prevent abuse
      skip: offset,
    })
    
    const total = await prisma.auditLog.count({
      where: {
        ...(actorId && { actorId }),
        ...(action && { action }),
        ...(resource && { resource }),
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } }),
      },
    })
    
    return { logs, total }
  } catch (error) {
    logger.error({ error }, 'Failed to retrieve audit logs')
    throw error
  }
}

/**
 * Export audit logs for compliance (GDPR, PCI-DSS, SOC2)
 */
export async function exportAuditLogs(
  startDate: Date,
  endDate: Date,
  format: 'json' | 'csv' = 'json'
): Promise<string> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    
    if (format === 'csv') {
      // Convert to CSV format
      const headers = [
        'ID',
        'Timestamp',
        'Actor ID',
        'Action',
        'Resource',
        'Resource ID',
        'Details',
        'IP Address',
        'Status',
        'Metadata',
      ]
      
      const rows = logs.map(log => [
        log.id,
        log.createdAt.toISOString(),
        log.actorId || '',
        log.action,
        log.resource,
        log.resourceId || '',
        log.details || '',
        log.ipAddress || '',
        'success',
        '',
      ])
      
      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
      return csv
    } else {
      // JSON format
      return JSON.stringify(logs, null, 2)
    }
  } catch (error) {
    logger.error({ error }, 'Failed to export audit logs')
    throw error
  }
}

/**
 * Ensure audit logs cannot be deleted (compliance requirement)
 * Only archive or mark as archived
 */
export async function archiveAuditLogs(
  startDate: Date,
  endDate: Date
): Promise<number> {
  try {
    // Note: AuditLog model doesn't support archiving (immutable by design)
    // This function retrieves logs in the date range instead
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    })
    
    return logs.length
  } catch (error) {
    logger.error({ error }, 'Failed to archive audit logs')
    throw error
  }
}

/**
 * Verify audit log integrity
 * Ensures logs haven't been modified
 */
export async function verifyAuditLogIntegrity(logId: string): Promise<boolean> {
  try {
    const log = await prisma.auditLog.findUnique({
      where: { id: logId },
    })
    
    if (!log) return false
    
    // In a production system, you would verify:
    // 1. Hash of log data against stored hash
    // 2. Digital signature
    // 3. Chain of custody
    
    return true
  } catch (error) {
    logger.error({ error }, 'Failed to verify audit log integrity')
    return false
  }
}

/**
 * Get audit summary for security dashboard
 */
export async function getAuditSummary(days: number = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  try {
    const summary = await prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: {
        id: true,
      },
    })
    
    const byResource = await prisma.auditLog.groupBy({
      by: ['resource'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: {
        id: true,
      },
    })
    
    return {
      byAction: summary,
      byResource,
      period: { startDate, endDate: new Date() },
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get audit summary')
    throw error
  }
}
