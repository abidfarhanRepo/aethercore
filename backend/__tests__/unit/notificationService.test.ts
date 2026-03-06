import { NotificationType, SecuritySeverity } from '@prisma/client'
import {
  createAdminManagerNotification,
  createNotification,
  createSecurityStatusFailureNotification,
  getUnreadCount,
  listNotifications,
  markNotificationRead,
} from '../../src/lib/notificationService'

const mockPrisma = {
  user: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
}

jest.mock('../../src/utils/db', () => ({
  prisma: mockPrisma,
}))

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a notification with expected payload', async () => {
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' })

    await createNotification({
      type: NotificationType.SECURITY,
      severity: SecuritySeverity.HIGH,
      title: 'Security test',
      message: 'Security event occurred',
      recipientId: 'user-1',
      actorId: 'user-2',
      metadata: { source: 'test' },
    })

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        type: NotificationType.SECURITY,
        severity: SecuritySeverity.HIGH,
        title: 'Security test',
        message: 'Security event occurred',
        metadata: { source: 'test' },
        recipientId: 'user-1',
        actorId: 'user-2',
      },
    })
  })

  it('lists only active notifications for recipient plus global notifications', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([])

    await listNotifications({
      recipientId: 'user-1',
      limit: 20,
    })

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        isArchived: false,
        isRead: undefined,
        OR: [{ recipientId: 'user-1' }, { recipientId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
  })

  it('returns unread count for recipient plus global notifications', async () => {
    mockPrisma.notification.count.mockResolvedValue(3)

    const count = await getUnreadCount('user-1')

    expect(count).toBe(3)
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({
      where: {
        isArchived: false,
        isRead: false,
        OR: [{ recipientId: 'user-1' }, { recipientId: null }],
      },
    })
  })

  it('marks notification as read only when visible to recipient', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 })

    const result = await markNotificationRead('notif-1', 'user-1')

    expect(result.count).toBe(1)
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'notif-1',
        isArchived: false,
        OR: [{ recipientId: 'user-1' }, { recipientId: null }],
      },
      data: {
        isRead: true,
        readAt: expect.any(Date),
      },
    })
  })

  it('creates role-scoped notifications for all active admins and managers', async () => {
    const created = [{ id: 'notif-a' }, { id: 'notif-b' }]
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'manager-1' }])
    mockPrisma.notification.create
      .mockResolvedValueOnce(created[0])
      .mockResolvedValueOnce(created[1])
    mockPrisma.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops))

    const result = await createAdminManagerNotification({
      type: NotificationType.SECURITY,
      severity: SecuritySeverity.HIGH,
      title: 'Security action required',
      message: 'Rotate key immediately',
      actorId: 'actor-1',
    })

    expect(result).toEqual(created)
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        isActive: true,
      },
      select: { id: true },
    })
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2)
  })

  it('uses admin-manager fanout for security status failure notifications', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }])
    mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' })
    mockPrisma.$transaction.mockImplementation(async (ops: Array<Promise<unknown>>) => Promise.all(ops))

    await createSecurityStatusFailureNotification('boom', 'actor-1')

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        type: NotificationType.SECURITY,
        severity: SecuritySeverity.HIGH,
        title: 'Security status check failed',
        message: 'Backend could not complete a security status check.',
        metadata: { error: 'boom' },
        recipientId: 'admin-1',
        actorId: 'actor-1',
      },
    })
  })
})
