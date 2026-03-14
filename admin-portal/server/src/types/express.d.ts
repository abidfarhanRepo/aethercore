import type { JwtPayload } from 'jsonwebtoken'

declare global {
  namespace Express {
    interface Request {
      adminSession?: JwtPayload & { username: string; type: 'admin-session' }
    }
  }
}

export {}
