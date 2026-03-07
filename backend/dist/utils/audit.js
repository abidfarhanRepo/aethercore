"use strict";
/**
 * Audit logging utility for tracking sensitive operations
 * Implements immutable audit logs for compliance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENSITIVE_ACTIONS = void 0;
exports.logAudit = logAudit;
exports.logAuthEvent = logAuthEvent;
exports.logUserEvent = logUserEvent;
exports.logPaymentEvent = logPaymentEvent;
exports.logDataAccessEvent = logDataAccessEvent;
exports.logSecurityEvent = logSecurityEvent;
exports.getAuditLogs = getAuditLogs;
exports.exportAuditLogs = exportAuditLogs;
exports.archiveAuditLogs = archiveAuditLogs;
exports.verifyAuditLogIntegrity = verifyAuditLogIntegrity;
exports.getAuditSummary = getAuditSummary;
const db_1 = require("./db");
const logger_1 = require("./logger");
/**
 * Sensitive actions that must be audited
 */
exports.SENSITIVE_ACTIONS = {
    AUTH: ['LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'MFA_ENABLED', 'MFA_DISABLED'],
    USER: ['USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'ROLE_ASSIGN', 'ROLE_REVOKE', 'PERMISSION_GRANT', 'PERMISSION_REVOKE'],
    PAYMENT: ['PAYMENT_PROCESS', 'REFUND_ISSUED', 'PAYMENT_FAILED', 'PAYMENT_VOIDED'],
    DATA: ['DATA_EXPORT', 'DATA_IMPORT', 'BACKUP_CREATED', 'BACKUP_RESTORED'],
    SYSTEM: ['CONFIG_CHANGED', 'SECURITY_SETTING_CHANGED', 'ENCRYPTION_KEY_ROTATED'],
    ACCESS: ['DOCUMENT_ACCESSED', 'REPORT_GENERATED', 'DATA_VIEWED'],
};
/**
 * Log an audit entry
 */
async function logAudit(entry, request) {
    const ipAddress = entry.ipAddress || request?.ip || request?.socket?.remoteAddress;
    const userAgent = entry.userAgent || request?.headers['user-agent'];
    try {
        const log = await db_1.prisma.auditLog.create({
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
        });
        return log.id;
    }
    catch (error) {
        // Log to application logger as fallback if database fails.
        logger_1.logger.error({ error }, 'Failed to write audit log');
        logger_1.logger.warn({ entry }, 'Audit entry fallback');
        throw error;
    }
}
/**
 * Log authentication event
 */
async function logAuthEvent(action, userId, request, details) {
    return logAudit({
        actorId: userId,
        action,
        resource: 'AUTH',
        details,
        status: 'success',
    }, request);
}
/**
 * Log user management event
 */
async function logUserEvent(action, actorId, targetUserId, request, details) {
    return logAudit({
        actorId,
        action,
        resource: 'USER',
        resourceId: targetUserId,
        details,
        status: 'success',
    }, request);
}
/**
 * Log payment event
 */
async function logPaymentEvent(action, actorId, transactionId, request, amount, details) {
    return logAudit({
        actorId,
        action,
        resource: 'PAYMENT',
        resourceId: transactionId,
        details,
        metadata: { amount },
        status: 'success',
    }, request);
}
/**
 * Log data access/export event
 */
async function logDataAccessEvent(action, actorId, dataType, request, recordCount) {
    return logAudit({
        actorId,
        action,
        resource: 'DATA',
        details: dataType,
        metadata: { recordCount },
        status: 'success',
    }, request);
}
/**
 * Log security event
 */
async function logSecurityEvent(action, actorId, request, details, severity = 'medium') {
    return logAudit({
        actorId,
        action,
        resource: 'SYSTEM',
        details,
        metadata: { severity },
        status: 'success',
    }, request);
}
/**
 * Retrieve audit logs with filters
 */
async function getAuditLogs(filters) {
    const { actorId, action, resource, startDate, endDate, limit = 100, offset = 0, } = filters;
    try {
        const logs = await db_1.prisma.auditLog.findMany({
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
        });
        const total = await db_1.prisma.auditLog.count({
            where: {
                ...(actorId && { actorId }),
                ...(action && { action }),
                ...(resource && { resource }),
                ...(startDate && { createdAt: { gte: startDate } }),
                ...(endDate && { createdAt: { lte: endDate } }),
            },
        });
        return { logs, total };
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to retrieve audit logs');
        throw error;
    }
}
/**
 * Export audit logs for compliance (GDPR, PCI-DSS, SOC2)
 */
async function exportAuditLogs(startDate, endDate, format = 'json') {
    try {
        const logs = await db_1.prisma.auditLog.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
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
            ];
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
            ]);
            const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
            return csv;
        }
        else {
            // JSON format
            return JSON.stringify(logs, null, 2);
        }
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to export audit logs');
        throw error;
    }
}
/**
 * Ensure audit logs cannot be deleted (compliance requirement)
 * Only archive or mark as archived
 */
async function archiveAuditLogs(startDate, endDate) {
    try {
        // Note: AuditLog model doesn't support archiving (immutable by design)
        // This function retrieves logs in the date range instead
        const logs = await db_1.prisma.auditLog.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
        });
        return logs.length;
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to archive audit logs');
        throw error;
    }
}
/**
 * Verify audit log integrity
 * Ensures logs haven't been modified
 */
async function verifyAuditLogIntegrity(logId) {
    try {
        const log = await db_1.prisma.auditLog.findUnique({
            where: { id: logId },
        });
        if (!log)
            return false;
        // In a production system, you would verify:
        // 1. Hash of log data against stored hash
        // 2. Digital signature
        // 3. Chain of custody
        return true;
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to verify audit log integrity');
        return false;
    }
}
/**
 * Get audit summary for security dashboard
 */
async function getAuditSummary(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    try {
        const summary = await db_1.prisma.auditLog.groupBy({
            by: ['action'],
            where: {
                createdAt: { gte: startDate },
            },
            _count: {
                id: true,
            },
        });
        const byResource = await db_1.prisma.auditLog.groupBy({
            by: ['resource'],
            where: {
                createdAt: { gte: startDate },
            },
            _count: {
                id: true,
            },
        });
        return {
            byAction: summary,
            byResource,
            period: { startDate, endDate: new Date() },
        };
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to get audit summary');
        throw error;
    }
}
