"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSecurityEventRecord = logSecurityEventRecord;
exports.logKeyRotation = logKeyRotation;
exports.logBackupDrillEvent = logBackupDrillEvent;
exports.collectAndPersistSecurityStatus = collectAndPersistSecurityStatus;
const client_1 = require("@prisma/client");
const db_1 = require("../utils/db");
function resolveFirstEnv(keys) {
    for (const key of keys) {
        const value = process.env[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return { key, value };
        }
    }
    return {};
}
function parseOptionalDate(value) {
    if (!value)
        return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed;
}
function toPrismaJson(value) {
    if (!value)
        return undefined;
    return value;
}
async function logSecurityEventRecord(args) {
    return db_1.prisma.securityEvent.create({
        data: {
            eventType: args.eventType,
            severity: args.severity,
            source: args.source,
            message: args.message,
            details: toPrismaJson(args.details),
            actorId: args.actorId,
            ipAddress: args.ipAddress,
        },
    });
}
async function logKeyRotation(args) {
    return db_1.prisma.keyRotationLog.create({
        data: {
            component: args.component,
            oldKeyVersion: args.oldKeyVersion,
            newKeyVersion: args.newKeyVersion,
            status: args.status || 'success',
            details: toPrismaJson(args.details),
            actorId: args.actorId,
        },
    });
}
async function logBackupDrillEvent(args) {
    const severity = args.status === 'failed' ? client_1.SecuritySeverity.HIGH : client_1.SecuritySeverity.LOW;
    return logSecurityEventRecord({
        eventType: client_1.SecurityEventType.UNKNOWN,
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
    });
}
async function collectAndPersistSecurityStatus(request) {
    const httpsEnv = resolveFirstEnv(['ENFORCE_HTTPS', 'HTTPS_ONLY']);
    const tlsKeyEnv = resolveFirstEnv(['TLS_KEY_PATH', 'SSL_KEY_PATH']);
    const tlsCertEnv = resolveFirstEnv(['TLS_CERT_PATH', 'SSL_CERT_PATH']);
    const tlsCaEnv = resolveFirstEnv(['TLS_CA_PATH', 'SSL_CA_PATH']);
    const certSubjectEnv = resolveFirstEnv(['TLS_CERT_SUBJECT', 'SSL_CERT_SUBJECT']);
    const certIssuerEnv = resolveFirstEnv(['TLS_CERT_ISSUER', 'SSL_CERT_ISSUER']);
    const certValidFromEnv = resolveFirstEnv(['TLS_CERT_VALID_FROM', 'SSL_CERT_VALID_FROM']);
    const certValidToEnv = resolveFirstEnv(['TLS_CERT_VALID_TO', 'SSL_CERT_VALID_TO']);
    const httpsEnforced = process.env.NODE_ENV === 'production' ||
        (httpsEnv.value ? ['1', 'true', 'yes'].includes(httpsEnv.value.toLowerCase()) : false);
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
    };
    const warnings = [];
    if (!httpsEnforced)
        warnings.push('HTTPS is not enforced by current app configuration.');
    if (!tlsKeyEnv.value || !tlsCertEnv.value) {
        warnings.push('TLS key/cert paths are not both configured in backend environment.');
    }
    const status = warnings.length === 0 ? 'healthy' : 'warning';
    const snapshot = await db_1.prisma.systemSecurityStatus.create({
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
    });
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
    };
}
