import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

const sessionSecret = process.env.ADMIN_PORTAL_JWT_SECRET || 'change-me-jwt-secret'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header('authorization') || ''
  const prefix = 'Bearer '

  if (!authHeader.startsWith(prefix)) {
    res.status(401).json({ error: 'Missing bearer token' })
    return
  }

  const token = authHeader.slice(prefix.length)

  try {
    const payload = jwt.verify(token, sessionSecret)
    if (typeof payload !== 'object' || !payload || payload.type !== 'admin-session') {
      res.status(401).json({ error: 'Invalid token type' })
      return
    }
    req.adminSession = payload as typeof req.adminSession
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
