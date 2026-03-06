import { api } from './api'

export interface AppNotification {
  id: string
  type: 'SECURITY' | 'SYSTEM' | 'AUTH'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  message: string
  metadata?: Record<string, unknown>
  isRead: boolean
  readAt?: string | null
  isArchived: boolean
  archivedAt?: string | null
  recipientId?: string | null
  actorId?: string | null
  createdAt: string
  updatedAt: string
}

export const notificationAPI = {
  list: (params?: { includeArchived?: boolean; unreadOnly?: boolean; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.includeArchived) search.set('includeArchived', 'true')
    if (params?.unreadOnly) search.set('unreadOnly', 'true')
    if (params?.limit) search.set('limit', String(params.limit))
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return api.get<{ notifications: AppNotification[] }>(`/api/notifications${suffix}`)
  },
  getUnreadCount: () => api.get<{ unreadCount: number }>('/api/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/api/notifications/${id}/read`),
  archive: (id: string) => api.patch(`/api/notifications/${id}/archive`),
}
