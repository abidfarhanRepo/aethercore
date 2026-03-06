import { NotificationType, Prisma, Role, SecuritySeverity } from '@prisma/client'
import { prisma } from '../utils/db'

export interface CreateNotificationInput {
  type: NotificationType
  severity: SecuritySeverity
  title: string
  message: string
  metadata?: Record<string, unknown>
  recipientId?: string
  actorId?: string
}

function toPrismaJson(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!value) return undefined
  return value as Prisma.InputJsonValue
}

export interface NotificationListOptions {
  recipientId: string
  includeArchived?: boolean
  unreadOnly?: boolean
  limit?: number
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      metadata: toPrismaJson(input.metadata),
      recipientId: input.recipientId,
      actorId: input.actorId,
    },
  })
}

export async function createRoleScopedNotification(
  roles: Role[],
  input: Omit<CreateNotificationInput, 'recipientId'>
) {
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: roles },
      isActive: true,
    },
    select: { id: true },
  })

  if (recipients.length === 0) {
    return []
  }

  return prisma.$transaction(
    recipients.map((recipient) =>
      prisma.notification.create({
        data: {
          type: input.type,
          severity: input.severity,
          title: input.title,
          message: input.message,
          metadata: toPrismaJson(input.metadata),
          recipientId: recipient.id,
          actorId: input.actorId,
        },
      })
    )
  )
}

export async function createAdminManagerNotification(input: Omit<CreateNotificationInput, 'recipientId'>) {
  return createRoleScopedNotification(['ADMIN', 'MANAGER'], input)
}

export async function listNotifications(options: NotificationListOptions) {
  return prisma.notification.findMany({
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
  })
}

export async function getUnreadCount(recipientId: string) {
  return prisma.notification.count({
    where: {
      isArchived: false,
      isRead: false,
      OR: [
        { recipientId },
        { recipientId: null },
      ],
    },
  })
}

export async function markNotificationRead(notificationId: string, recipientId: string) {
  return prisma.notification.updateMany({
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
  })
}

export async function archiveNotification(notificationId: string, recipientId: string) {
  return prisma.notification.updateMany({
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
  })
}

export async function createFailedLoginNotification(email: string, ipAddress?: string) {
  return createNotification({
    type: NotificationType.AUTH,
    severity: SecuritySeverity.MEDIUM,
    title: 'Failed login attempt detected',
    message: `A failed login attempt was detected for ${email}.`,
    metadata: {
      email,
      ipAddress: ipAddress || 'unknown',
    },
  })
}

export async function createSecurityStatusFailureNotification(error: string, actorId?: string) {
  return createAdminManagerNotification({
    type: NotificationType.SECURITY,
    severity: SecuritySeverity.HIGH,
    title: 'Security status check failed',
    message: 'Backend could not complete a security status check.',
    metadata: { error },
    actorId,
  })
}

export async function createKeyRotationNotification(args: {
  component: string
  status: string
  actorId?: string
  details?: Record<string, unknown>
}) {
  return createAdminManagerNotification({
    type: NotificationType.SECURITY,
    severity: args.status === 'success' ? SecuritySeverity.MEDIUM : SecuritySeverity.HIGH,
    title: `Security key rotation ${args.status}`,
    message: `Key rotation completed for ${args.component} with status ${args.status}.`,
    metadata: {
      component: args.component,
      status: args.status,
      ...(args.details || {}),
    },
    actorId: args.actorId,
  })
}
