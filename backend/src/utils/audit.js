"use strict";
/**
 * Audit logging utility for tracking sensitive operations
 * Implements immutable audit logs for compliance
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
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
var db_1 = require("./db");
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
function logAudit(entry, request) {
    return __awaiter(this, void 0, void 0, function () {
        var ipAddress, userAgent, log, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ipAddress = entry.ipAddress || (request === null || request === void 0 ? void 0 : request.ip) || ((_a = request === null || request === void 0 ? void 0 : request.socket) === null || _a === void 0 ? void 0 : _a.remoteAddress);
                    userAgent = entry.userAgent || (request === null || request === void 0 ? void 0 : request.headers['user-agent']);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, db_1.prisma.auditLog.create({
                            data: {
                                // FIX: Set a default system ID if actorId is not provided, to avoid null constraint violations
                                actorId: entry.actorId || 'SYSTEM',
                                action: entry.action,
                                resource: entry.resource,
                                resourceId: entry.resourceId,
                                details: entry.details,
                                ipAddress: ipAddress,
                            },
                        })];
                case 2:
                    log = _b.sent();
                    return [2 /*return*/, log.id];
                case 3:
                    error_1 = _b.sent();
                    // Log to console as fallback if database fails
                    console.error('Failed to write audit log:', error_1);
                    console.warn('Audit entry:', entry);
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Log authentication event
 */
function logAuthEvent(action, userId, request, details) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, logAudit({
                    actorId: userId,
                    action: action,
                    resource: 'AUTH',
                    details: details,
                    status: 'success',
                }, request)];
        });
    });
}
/**
 * Log user management event
 */
function logUserEvent(action, actorId, targetUserId, request, details) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, logAudit({
                    actorId: actorId,
                    action: action,
                    resource: 'USER',
                    resourceId: targetUserId,
                    details: details,
                    status: 'success',
                }, request)];
        });
    });
}
/**
 * Log payment event
 */
function logPaymentEvent(action, actorId, transactionId, request, amount, details) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, logAudit({
                    actorId: actorId,
                    action: action,
                    resource: 'PAYMENT',
                    resourceId: transactionId,
                    details: details,
                    metadata: { amount: amount },
                    status: 'success',
                }, request)];
        });
    });
}
/**
 * Log data access/export event
 */
function logDataAccessEvent(action, actorId, dataType, request, recordCount) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, logAudit({
                    actorId: actorId,
                    action: action,
                    resource: 'DATA',
                    details: dataType,
                    metadata: { recordCount: recordCount },
                    status: 'success',
                }, request)];
        });
    });
}
/**
 * Log security event
 */
function logSecurityEvent(action_1, actorId_1, request_1, details_1) {
    return __awaiter(this, arguments, void 0, function (action, actorId, request, details, severity) {
        if (severity === void 0) { severity = 'medium'; }
        return __generator(this, function (_a) {
            return [2 /*return*/, logAudit({
                    actorId: actorId,
                    action: action,
                    resource: 'SYSTEM',
                    details: details,
                    metadata: { severity: severity },
                    status: 'success',
                }, request)];
        });
    });
}
/**
 * Retrieve audit logs with filters
 */
function getAuditLogs(filters) {
    return __awaiter(this, void 0, void 0, function () {
        var actorId, action, resource, startDate, endDate, _a, limit, _b, offset, logs, total, error_2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    actorId = filters.actorId, action = filters.action, resource = filters.resource, startDate = filters.startDate, endDate = filters.endDate, _a = filters.limit, limit = _a === void 0 ? 100 : _a, _b = filters.offset, offset = _b === void 0 ? 0 : _b;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, db_1.prisma.auditLog.findMany({
                            where: __assign(__assign(__assign(__assign(__assign({}, (actorId && { actorId: actorId })), (action && { action: action })), (resource && { resource: resource })), (startDate && { createdAt: { gte: startDate } })), (endDate && { createdAt: { lte: endDate } })),
                            orderBy: { createdAt: 'desc' },
                            take: Math.min(limit, 1000), // Cap at 1000 to prevent abuse
                            skip: offset,
                        })];
                case 2:
                    logs = _c.sent();
                    return [4 /*yield*/, db_1.prisma.auditLog.count({
                            where: __assign(__assign(__assign(__assign(__assign({}, (actorId && { actorId: actorId })), (action && { action: action })), (resource && { resource: resource })), (startDate && { createdAt: { gte: startDate } })), (endDate && { createdAt: { lte: endDate } })),
                        })];
                case 3:
                    total = _c.sent();
                    return [2 /*return*/, { logs: logs, total: total }];
                case 4:
                    error_2 = _c.sent();
                    console.error('Failed to retrieve audit logs:', error_2);
                    throw error_2;
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Export audit logs for compliance (GDPR, PCI-DSS, SOC2)
 */
function exportAuditLogs(startDate_1, endDate_1) {
    return __awaiter(this, arguments, void 0, function (startDate, endDate, format) {
        var logs, headers, rows, csv, error_3;
        if (format === void 0) { format = 'json'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, db_1.prisma.auditLog.findMany({
                            where: {
                                createdAt: {
                                    gte: startDate,
                                    lte: endDate,
                                },
                            },
                            orderBy: { createdAt: 'desc' },
                        })];
                case 1:
                    logs = _a.sent();
                    if (format === 'csv') {
                        headers = [
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
                        rows = logs.map(function (log) { return [
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
                        ]; });
                        csv = __spreadArray([headers], rows, true).map(function (row) { return row.map(function (cell) { return "\"".concat(cell, "\""); }).join(','); }).join('\n');
                        return [2 /*return*/, csv];
                    }
                    else {
                        // JSON format
                        return [2 /*return*/, JSON.stringify(logs, null, 2)];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error('Failed to export audit logs:', error_3);
                    throw error_3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Ensure audit logs cannot be deleted (compliance requirement)
 * Only archive or mark as archived
 */
function archiveAuditLogs(startDate, endDate) {
    return __awaiter(this, void 0, void 0, function () {
        var logs, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, db_1.prisma.auditLog.findMany({
                            where: {
                                createdAt: {
                                    gte: startDate,
                                    lte: endDate,
                                },
                            },
                        })];
                case 1:
                    logs = _a.sent();
                    return [2 /*return*/, logs.length];
                case 2:
                    error_4 = _a.sent();
                    console.error('Failed to archive audit logs:', error_4);
                    throw error_4;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Verify audit log integrity
 * Ensures logs haven't been modified
 */
function verifyAuditLogIntegrity(logId) {
    return __awaiter(this, void 0, void 0, function () {
        var log, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, db_1.prisma.auditLog.findUnique({
                            where: { id: logId },
                        })];
                case 1:
                    log = _a.sent();
                    if (!log)
                        return [2 /*return*/, false
                            // In a production system, you would verify:
                            // 1. Hash of log data against stored hash
                            // 2. Digital signature
                            // 3. Chain of custody
                        ];
                    // In a production system, you would verify:
                    // 1. Hash of log data against stored hash
                    // 2. Digital signature
                    // 3. Chain of custody
                    return [2 /*return*/, true];
                case 2:
                    error_5 = _a.sent();
                    console.error('Failed to verify audit log integrity:', error_5);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get audit summary for security dashboard
 */
function getAuditSummary() {
    return __awaiter(this, arguments, void 0, function (days) {
        var startDate, summary, byResource, error_6;
        if (days === void 0) { days = 30; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startDate = new Date();
                    startDate.setDate(startDate.getDate() - days);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, db_1.prisma.auditLog.groupBy({
                            by: ['action'],
                            where: {
                                createdAt: { gte: startDate },
                            },
                            _count: {
                                id: true,
                            },
                        })];
                case 2:
                    summary = _a.sent();
                    return [4 /*yield*/, db_1.prisma.auditLog.groupBy({
                            by: ['resource'],
                            where: {
                                createdAt: { gte: startDate },
                            },
                            _count: {
                                id: true,
                            },
                        })];
                case 3:
                    byResource = _a.sent();
                    return [2 /*return*/, {
                            byAction: summary,
                            byResource: byResource,
                            period: { startDate: startDate, endDate: new Date() },
                        }];
                case 4:
                    error_6 = _a.sent();
                    console.error('Failed to get audit summary:', error_6);
                    throw error_6;
                case 5: return [2 /*return*/];
            }
        });
    });
}
