import { FastifyReply, FastifyRequest } from 'fastify'
import jwt from 'jsonwebtoken'
import { prisma } from '../utils/db'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change_me'

// Permission Matrix
export const PERMISSION_MATRIX: Record<string, string[]> = {
  ADMIN: [
    // All permissions
    'products.create',
    'products.read',
    'products.update',
    'products.delete',
    'sales.create',
    'sales.read',
    'sales.update',
    'sales.void',
    'sales.refund',
    'sales.return',
    'inventory.read',
    'inventory.update',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.recount',
    'purchases.create',
    'purchases.read',
    'purchases.update',
    'purchases.receive',
    'purchases.cancel',
    'reports.view',
    'reports.export',
    'users.create',
    'users.read',
    'users.update',
    'users.delete',
    'users.change-password',
    'users.reset-password',
    'users.unlock',
    'roles.create',
    'roles.read',
    'roles.update',
    'roles.delete',
    'audit.view',
  ],
  MANAGER: [
    'products.read',
    'sales.read',
    'sales.refund',
    'sales.return',
    'inventory.read',
    'purchases.read',
    'reports.view',
    'reports.export',
    'users.read',
    'users.update', // Can update non-admin users
    'users.change-password',
    'users.reset-password',
    'roles.read',
    'audit.view',
  ],
  SUPERVISOR: [
    'products.read',
    'sales.read',
    'inventory.read',
    'purchases.read',
    'reports.view',
    'users.read',
    'users.change-password',
    'audit.view',
  ],
  CASHIER: [
    'products.read',
    'sales.create',
    'sales.read',
    'sales.void',
    'sales.refund',
    'sales.return',
    'inventory.read',
    'users.change-password',
  ],
  STOCK_CLERK: [
    'products.read',
    'inventory.read',
    'inventory.update',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.recount',
    'purchases.read',
    'users.change-password',
  ],
}

export interface AuthUser {
  id: string
  email: string
  role: string
  firstName?: string
  lastName?: string
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization
  if (!auth) return reply.code(401).send({ error: 'missing auth' })
  const token = auth.replace(/^Bearer\s+/, '')
  try {
    const payload: any = jwt.verify(token, JWT_ACCESS_SECRET)
    // Fetch full user data
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'user not found or inactive' })
    }

    // attach user to request
    ;(req as any).user = user
  } catch (e) {
    return reply.code(401).send({ error: 'invalid token' })
  }
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user
    if (!user) return reply.code(401).send({ error: 'unauthenticated' })

    if (!allowedRoles.includes(user.role) && user.role !== 'ADMIN') {
      // Log permission denial
      await logPermissionDenial(user.id, 'DENY', 'UNKNOWN', `role:${allowedRoles.join(',')}`, req)
      return reply.code(403).send({ error: 'forbidden' })
    }
  }
}

export function requirePermission(...permissions: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user
    if (!user) return reply.code(401).send({ error: 'unauthenticated' })

    // Check if user has permission
    const hasPermission = await checkPermission(user.id, user.role, permissions)

    if (!hasPermission) {
      // Log permission denial
      await logPermissionDenial(user.id, 'DENY', permissions.join(','), 'denied', req)
      return reply.code(403).send({ error: 'forbidden' })
    }

    // Log successful permission check
    await logPermissionDenial(user.id, 'ATTEMPT', permissions.join(','), 'granted', req)
  }
}

async function checkPermission(userId: string, role: string, requiredPermissions: string[]): Promise<boolean> {
  // ADMIN always has permission
  if (role === 'ADMIN') return true

  const matrixPermissions = PERMISSION_MATRIX[role] || []

  // Check if user has all required permissions
  return requiredPermissions.every((perm) => matrixPermissions.includes(perm))
}

async function logPermissionDenial(
  userId: string,
  action: 'GRANT' | 'REVOKE' | 'DENY' | 'ATTEMPT',
  permission: string,
  granted: boolean | string,
  req: FastifyRequest
) {
  try {
    await prisma.permissionLog.create({
      data: {
        userId,
        action,
        resource: permission.split('.')[0] || 'UNKNOWN',
        permission,
        granted: typeof granted === 'boolean' ? granted : granted === 'granted',
        ipAddress: req.ip || req.socket?.remoteAddress,
      },
    })
  } catch (e) {
    // Silently fail audit logging
    console.error('Failed to log permission:', e)
  }
}

export { prisma }
