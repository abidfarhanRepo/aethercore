"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = createNotification;
exports.createRoleScopedNotification = createRoleScopedNotification;
exports.createAdminManagerNotification = createAdminManagerNotification;
exports.listNotifications = listNotifications;
exports.getUnreadCount = getUnreadCount;
exports.markNotificationRead = markNotificationRead;
exports.archiveNotification = archiveNotification;
exports.createFailedLoginNotification = createFailedLoginNotification;
exports.createSecurityStatusFailureNotification = createSecurityStatusFailureNotification;
exports.createKeyRotationNotification = createKeyRotationNotification;
const client_1 = require("@prisma/client");
const db_1 = require("../utils/db");
function toPrismaJson(value) {
    if (!value)
        return undefined;
    return value;
}
async function createNotification(input) {
    return db_1.prisma.notification.create({
        data: {
            type: input.type,
            severity: input.severity,
            title: input.title,
            message: input.message,
            metadata: toPrismaJson(input.metadata),
            recipientId: input.recipientId,
            actorId: input.actorId,
        },
    });
}
async function createRoleScopedNotification(roles, input) {
    const recipients = await db_1.prisma.user.findMany({
        where: {
            role: { in: roles },
            isActive: true,
        },
        select: { id: true },
    });
    if (recipients.length === 0) {
        return [];
    }
    return db_1.prisma.$transaction(recipients.map((recipient) => db_1.prisma.notification.create({
        data: {
            type: input.type,
            severity: input.severity,
            title: input.title,
            message: input.message,
            metadata: toPrismaJson(input.metadata),
            recipientId: recipient.id,
            actorId: input.actorId,
        },
    })));
}
async function createAdminManagerNotification(input) {
    return createRoleScopedNotification(['ADMIN', 'MANAGER'], input);
}
async function listNotifications(options) {
    return db_1.prisma.notification.findMany({
        where: {
            isArchived: options.includeArchived ? undefined : false,
            isRead: options.unreadOnly ? false : undefined,
            OR: [
                { recipientId: options.recipientId },
                { recipientId: null },
            ],
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(options.limit ?? 50, 1), 200),
    });
}
async function getUnreadCount(recipientId) {
    return db_1.prisma.notification.count({
        where: {
            isArchived: false,
            isRead: false,
            OR: [
                { recipientId },
                { recipientId: null },
            ],
        },
    });
}
async function markNotificationRead(notificationId, recipientId) {
    return db_1.prisma.notification.updateMany({
        where: {
            id: notificationId,
            isArchived: false,
            OR: [
                { recipientId },
                { recipientId: null },
            ],
        },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });
}
async function archiveNotification(notificationId, recipientId) {
    return db_1.prisma.notification.updateMany({
        where: {
            id: notificationId,
            OR: [
                { recipientId },
                { recipientId: null },
            ],
        },
        data: {
            isArchived: true,
            archivedAt: new Date(),
        },
    });
}
async function createFailedLoginNotification(email, ipAddress) {
    return createNotification({
        type: client_1.NotificationType.AUTH,
        severity: client_1.SecuritySeverity.MEDIUM,
        title: 'Failed login attempt detected',
        message: `A failed login attempt was detected for ${email}.`,
        metadata: {
            email,
            ipAddress: ipAddress || 'unknown',
        },
    });
}
async function createSecurityStatusFailureNotification(error, actorId) {
    return createAdminManagerNotification({
        type: client_1.NotificationType.SECURITY,
        severity: client_1.SecuritySeverity.HIGH,
        title: 'Security status check failed',
        message: 'Backend could not complete a security status check.',
        metadata: { error },
        actorId,
    });
}
async function createKeyRotationNotification(args) {
    return createAdminManagerNotification({
        type: client_1.NotificationType.SECURITY,
        severity: args.status === 'success' ? client_1.SecuritySeverity.MEDIUM : client_1.SecuritySeverity.HIGH,
        title: `Security key rotation ${args.status}`,
        message: `Key rotation completed for ${args.component} with status ${args.status}.`,
        metadata: {
            component: args.component,
            status: args.status,
            ...(args.details || {}),
        },
        actorId: args.actorId,
    });
}
