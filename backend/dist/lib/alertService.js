"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAlertRulesConfig = getAlertRulesConfig;
exports.saveAlertRulesConfig = saveAlertRulesConfig;
exports.evaluateAlertRules = evaluateAlertRules;
exports.serializeAlertRulesConfig = serializeAlertRulesConfig;
const client_1 = require("@prisma/client");
const db_1 = require("../utils/db");
const securityCompliance_1 = require("./securityCompliance");
const notificationService_1 = require("./notificationService");
const ALERT_SETTINGS_KEY = 'security.alert_rules';
const DEFAULT_ALERT_RULES = {
    routingPolicy: {
        notifyAdminManager: true,
    },
    rules: {
        auth_spike: { enabled: true, threshold: 5, windowMinutes: 10 },
        security_status_failure: { enabled: true, threshold: 1, windowMinutes: 15 },
        cert_expiry: { enabled: true, threshold: 21, windowMinutes: 1440 },
        backup_failure: { enabled: true, threshold: 1, windowMinutes: 10080 },
    },
};
function toPrismaJson(value) {
    return value;
}
function asObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value;
}
function parseRuleConfig(value, fallback) {
    const obj = asObject(value);
    const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : fallback.enabled;
    const threshold = typeof obj.threshold === 'number' && Number.isFinite(obj.threshold)
        ? Math.max(1, Math.floor(obj.threshold))
        : fallback.threshold;
    const windowMinutes = typeof obj.windowMinutes === 'number' && Number.isFinite(obj.windowMinutes)
        ? Math.max(1, Math.floor(obj.windowMinutes))
        : fallback.windowMinutes;
    return { enabled, threshold, windowMinutes };
}
function parseAlertRulesConfig(value) {
    const obj = asObject(value);
    const routingPolicy = asObject(obj.routingPolicy);
    const rules = asObject(obj.rules);
    return {
        routingPolicy: {
            notifyAdminManager: typeof routingPolicy.notifyAdminManager === 'boolean'
                ? routingPolicy.notifyAdminManager
                : DEFAULT_ALERT_RULES.routingPolicy.notifyAdminManager,
        },
        rules: {
            auth_spike: parseRuleConfig(rules.auth_spike, DEFAULT_ALERT_RULES.rules.auth_spike),
            security_status_failure: parseRuleConfig(rules.security_status_failure, DEFAULT_ALERT_RULES.rules.security_status_failure),
            cert_expiry: parseRuleConfig(rules.cert_expiry, DEFAULT_ALERT_RULES.rules.cert_expiry),
            backup_failure: parseRuleConfig(rules.backup_failure, DEFAULT_ALERT_RULES.rules.backup_failure),
        },
    };
}
async function getAlertRulesConfig() {
    const setting = await db_1.prisma.settings.findUnique({ where: { key: ALERT_SETTINGS_KEY } });
    if (!setting) {
        return DEFAULT_ALERT_RULES;
    }
    try {
        return parseAlertRulesConfig(JSON.parse(setting.value));
    }
    catch {
        return DEFAULT_ALERT_RULES;
    }
}
async function saveAlertRulesConfig(incoming, updatedBy) {
    const current = await getAlertRulesConfig();
    const merged = parseAlertRulesConfig({
        routingPolicy: {
            ...current.routingPolicy,
            ...(incoming.routingPolicy || {}),
        },
        rules: {
            ...current.rules,
            ...(incoming.rules || {}),
        },
    });
    await db_1.prisma.settings.upsert({
        where: { key: ALERT_SETTINGS_KEY },
        update: {
            value: JSON.stringify(merged),
            category: 'system',
            type: 'json',
            label: 'Security Alert Rules',
            description: 'Phase 8-B alert thresholds and routing policy.',
            updatedBy,
        },
        create: {
            key: ALERT_SETTINGS_KEY,
            value: JSON.stringify(merged),
            category: 'system',
            type: 'json',
            label: 'Security Alert Rules',
            description: 'Phase 8-B alert thresholds and routing policy.',
            updatedBy,
        },
    });
    return merged;
}
async function shouldThrottleAlert(source, minutes) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const existing = await db_1.prisma.securityEvent.findFirst({
        where: { source, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
    });
    return Boolean(existing);
}
async function emitAlert(args) {
    await (0, securityCompliance_1.logSecurityEventRecord)({
        eventType: client_1.SecurityEventType.UNKNOWN,
        severity: args.severity || client_1.SecuritySeverity.HIGH,
        source: args.source,
        message: args.message,
        details: args.details,
        actorId: args.actorId,
        ipAddress: args.ipAddress,
    });
    if (args.notifyAdminManager) {
        await (0, notificationService_1.createAdminManagerNotification)({
            type: client_1.NotificationType.SECURITY,
            severity: args.severity || client_1.SecuritySeverity.HIGH,
            title: args.title,
            message: args.message,
            metadata: args.details,
            actorId: args.actorId,
        });
    }
}
async function evaluateAlertRules(actorId, ipAddress) {
    const config = await getAlertRulesConfig();
    const triggered = [];
    if (config.rules.auth_spike.enabled) {
        const since = new Date(Date.now() - config.rules.auth_spike.windowMinutes * 60 * 1000);
        const failedCount = await db_1.prisma.securityEvent.count({
            where: {
                eventType: client_1.SecurityEventType.FAILED_LOGIN,
                createdAt: { gte: since },
            },
        });
        if (failedCount >= config.rules.auth_spike.threshold) {
            const throttled = await shouldThrottleAlert('alert/auth_spike', config.rules.auth_spike.windowMinutes);
            if (!throttled) {
                const message = `${failedCount} failed logins detected in the last ${config.rules.auth_spike.windowMinutes} minutes.`;
                await emitAlert({
                    source: 'alert/auth_spike',
                    title: 'Auth Spike Alert',
                    message,
                    details: {
                        failedCount,
                        threshold: config.rules.auth_spike.threshold,
                        windowMinutes: config.rules.auth_spike.windowMinutes,
                    },
                    actorId,
                    ipAddress,
                    notifyAdminManager: config.routingPolicy.notifyAdminManager,
                });
                triggered.push({
                    rule: 'auth_spike',
                    value: failedCount,
                    threshold: config.rules.auth_spike.threshold,
                    windowMinutes: config.rules.auth_spike.windowMinutes,
                    message,
                });
            }
        }
    }
    if (config.rules.security_status_failure.enabled) {
        const since = new Date(Date.now() - config.rules.security_status_failure.windowMinutes * 60 * 1000);
        const failures = await db_1.prisma.securityEvent.count({
            where: {
                eventType: client_1.SecurityEventType.SECURITY_STATUS_CHECK_FAILED,
                createdAt: { gte: since },
            },
        });
        if (failures >= config.rules.security_status_failure.threshold) {
            const throttled = await shouldThrottleAlert('alert/security_status_failure', config.rules.security_status_failure.windowMinutes);
            if (!throttled) {
                const message = `${failures} security status failures in the last ${config.rules.security_status_failure.windowMinutes} minutes.`;
                await emitAlert({
                    source: 'alert/security_status_failure',
                    title: 'Security Status Failure Alert',
                    message,
                    details: {
                        failures,
                        threshold: config.rules.security_status_failure.threshold,
                        windowMinutes: config.rules.security_status_failure.windowMinutes,
                    },
                    actorId,
                    ipAddress,
                    notifyAdminManager: config.routingPolicy.notifyAdminManager,
                });
                triggered.push({
                    rule: 'security_status_failure',
                    value: failures,
                    threshold: config.rules.security_status_failure.threshold,
                    windowMinutes: config.rules.security_status_failure.windowMinutes,
                    message,
                });
            }
        }
    }
    if (config.rules.cert_expiry.enabled) {
        const latest = await db_1.prisma.systemSecurityStatus.findFirst({
            orderBy: { checkedAt: 'desc' },
            select: { tlsCertValidTo: true },
        });
        if (latest?.tlsCertValidTo) {
            const daysUntilExpiry = Math.ceil((latest.tlsCertValidTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry <= config.rules.cert_expiry.threshold) {
                const throttled = await shouldThrottleAlert('alert/cert_expiry', 1440);
                if (!throttled) {
                    const message = `TLS certificate expires in ${daysUntilExpiry} day(s).`;
                    await emitAlert({
                        source: 'alert/cert_expiry',
                        title: 'Certificate Expiry Alert',
                        message,
                        details: {
                            daysUntilExpiry,
                            thresholdDays: config.rules.cert_expiry.threshold,
                            certificateValidTo: latest.tlsCertValidTo.toISOString(),
                        },
                        severity: daysUntilExpiry <= 7 ? client_1.SecuritySeverity.CRITICAL : client_1.SecuritySeverity.HIGH,
                        actorId,
                        ipAddress,
                        notifyAdminManager: config.routingPolicy.notifyAdminManager,
                    });
                    triggered.push({
                        rule: 'cert_expiry',
                        value: daysUntilExpiry,
                        threshold: config.rules.cert_expiry.threshold,
                        windowMinutes: config.rules.cert_expiry.windowMinutes,
                        message,
                    });
                }
            }
        }
    }
    if (config.rules.backup_failure.enabled) {
        const since = new Date(Date.now() - config.rules.backup_failure.windowMinutes * 60 * 1000);
        const backupFailures = await db_1.prisma.securityEvent.count({
            where: {
                source: { in: ['api/security/backup-drills', 'cli/security/backup-drills'] },
                severity: client_1.SecuritySeverity.HIGH,
                createdAt: { gte: since },
            },
        });
        if (backupFailures >= config.rules.backup_failure.threshold) {
            const throttled = await shouldThrottleAlert('alert/backup_failure', config.rules.backup_failure.windowMinutes);
            if (!throttled) {
                const message = `${backupFailures} backup/restore drill failures in the last ${config.rules.backup_failure.windowMinutes} minutes.`;
                await emitAlert({
                    source: 'alert/backup_failure',
                    title: 'Backup Failure Alert',
                    message,
                    details: {
                        backupFailures,
                        threshold: config.rules.backup_failure.threshold,
                        windowMinutes: config.rules.backup_failure.windowMinutes,
                    },
                    actorId,
                    ipAddress,
                    notifyAdminManager: config.routingPolicy.notifyAdminManager,
                });
                triggered.push({
                    rule: 'backup_failure',
                    value: backupFailures,
                    threshold: config.rules.backup_failure.threshold,
                    windowMinutes: config.rules.backup_failure.windowMinutes,
                    message,
                });
            }
        }
    }
    await db_1.prisma.settings.upsert({
        where: { key: 'security.alert_last_evaluation' },
        update: {
            value: JSON.stringify({ checkedAt: new Date().toISOString(), triggered }),
            category: 'system',
            type: 'json',
            label: 'Security Alert Last Evaluation',
            description: 'Stores latest alert evaluation evidence.',
            updatedBy: actorId,
        },
        create: {
            key: 'security.alert_last_evaluation',
            value: JSON.stringify({ checkedAt: new Date().toISOString(), triggered }),
            category: 'system',
            type: 'json',
            label: 'Security Alert Last Evaluation',
            description: 'Stores latest alert evaluation evidence.',
            updatedBy: actorId,
        },
    });
    return {
        checkedAt: new Date().toISOString(),
        triggered,
    };
}
function serializeAlertRulesConfig(config) {
    return toPrismaJson(config);
}
