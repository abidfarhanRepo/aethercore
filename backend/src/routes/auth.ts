import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../utils/db'
import { SecurityEventType, SecuritySeverity } from '@prisma/client'
import { generateTokenPair, rotateRefreshToken, revokeToken, verifyAccessToken, verifyRefreshToken } from '../lib/jwt'
import { sanitizeEmail, sanitizeString, validatePasswordStrength, removeSQLInjectionPatterns, containsXSSPatterns } from '../utils/sanitizer'
import { onLoginSuccess, onLoginFailure } from '../middleware/brute-force'
import { logAuthEvent } from '../utils/audit'
import { createFailedLoginNotification } from '../lib/notificationService'
import { logSecurityEventRecord } from '../lib/securityCompliance'
import { logger } from '../utils/logger'
import { requireAuth } from '../plugins/authMiddleware'
import { consumeRecoveryCode, generateMfaEnrollment, verifyTotpToken } from '../lib/mfaService'
import {
  loginBodySchema,
  LoginBody,
  mfaChallengeBodySchema,
  MfaChallengeBody,
  mfaVerifyBodySchema,
  MfaVerifyBody,
  logoutBodySchema,
  LogoutBody,
  refreshBodySchema,
  RefreshBody,
  registerBodySchema,
  RegisterBody,
} from '../schemas/auth'


export default async function authRoutes(fastify: FastifyInstance) {
  const JWT_MFA_SESSION_SECRET =
    process.env.JWT_MFA_SESSION_SECRET || process.env.JWT_ACCESS_SECRET || 'change_me_mfa_session_secret'

  async function ensureDevAdminUser(email: string) {
    if (process.env.NODE_ENV === 'production') {
      return null
    }

    if (email !== 'admin@aether.dev') {
      return null
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return existing
    }

    const fallbackPassword = process.env.DEV_ADMIN_PASSWORD || 'password123'
    const hash = await bcrypt.hash(fallbackPassword, 10)
    return prisma.user.create({
      data: {
        email,
        password: hash,
        role: 'ADMIN',
        isActive: true,
        failedLoginAttempts: 0,
      },
    })
  }
  // Register with enhanced security
  fastify.post('/api/v1/auth/register', {
    config: { zod: { body: registerBodySchema } },
  }, async (req, reply) => {
    try {
      const { email: rawEmail, password: rawPassword } = req.body as RegisterBody
      
      // Input validation and sanitization
      if (!rawEmail || !rawPassword) {
        return reply.status(400).send({ error: 'Email and password required' })
      }
      
      if (removeSQLInjectionPatterns(rawEmail) || removeSQLInjectionPatterns(rawPassword)) {
        await logAuthEvent('LOGIN_FAILED', undefined, req, 'SQL injection attempt detected')
        return reply.status(400).send({ error: 'Invalid input' })
      }
      
      if (containsXSSPatterns(rawEmail) || containsXSSPatterns(rawPassword)) {
        await logAuthEvent('LOGIN_FAILED', undefined, req, 'XSS pattern detected')
        return reply.status(400).send({ error: 'Invalid input' })
      }
      
      const email = sanitizeEmail(rawEmail)
      
      // Validate password strength
      const passwordValidation = validatePasswordStrength(rawPassword)
      if (!passwordValidation.valid) {
        return reply.status(400).send({
          error: 'Password does not meet requirements',
          requirements: passwordValidation.errors
        })
      }
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        return reply.status(409).send({ error: 'User already exists' })
      }
      
      // Hash password with higher rounds (12 for security-sensitive operation)
      const hash = await bcrypt.hash(rawPassword, 12)
      
      // Create user with secure defaults
      const user = await prisma.user.create({
        data: {
          email,
          password: hash,
          isActive: true,
          failedLoginAttempts: 0,
        }
      })
      
      // Log registration
      await logAuthEvent('USER_REGISTERED', user.id, req, `User registered: ${email}`)
      
      return {
        id: user.id,
        email: user.email,
        message: 'User registered successfully'
      }
    } catch (error) {
      logger.error({ error }, 'Registration error')
      return reply.status(500).send({ error: 'Registration failed' })
    }
  })

  // Login with enhanced security
  fastify.post('/api/v1/auth/login', {
    config: { zod: { body: loginBodySchema } },
  }, async (req, reply) => {
    try {
      const { email: rawEmail, password } = req.body as LoginBody
      
      if (!rawEmail || !password) {
        return reply.status(400).send({ error: 'Email and password required' })
      }
      
      // Sanitize email
      let email: string
      try {
        email = sanitizeEmail(rawEmail)
      } catch {
        await logAuthEvent('LOGIN_FAILED', undefined, req, 'Invalid email format')
        return reply.status(400).send({ error: 'Invalid email' })
      }
      
      // Find user; in development, auto-bootstrap admin login user if missing.
      let user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        user = await ensureDevAdminUser(email)
      }
      
      if (!user) {
        // Log failed attempt with fake user identifier for audit
        await onLoginFailure(email, req)
        await logAuthEvent('LOGIN_FAILED', undefined, req, `User not found: ${email}`)
        await logSecurityEventRecord({
          eventType: SecurityEventType.FAILED_LOGIN,
          severity: SecuritySeverity.MEDIUM,
          source: 'auth/login',
          message: 'Failed login attempt for unknown user',
          details: { email },
          ipAddress: req.ip,
        }).catch((error) => {
          logger.error({ error }, 'Failed to persist failed-login security event')
        })
        await createFailedLoginNotification(email, req.ip).catch((error) => {
          logger.error({ error }, 'Failed to persist failed-login notification')
        })
        // Don't reveal if user exists
        return reply.status(401).send({ error: 'Invalid credentials' })
      }
      
      // Check if account is locked
      if (user.lockedAt && new Date(user.lockedAt) > new Date()) {
        await logAuthEvent('LOGIN_FAILED', user.id, req, 'Account locked')
        return reply.status(403).send({
          error: 'Account locked',
          message: 'Too many failed login attempts. Contact administrator.'
        })
      }
      
      // Check if account is active
      if (!user.isActive) {
        await logAuthEvent('LOGIN_FAILED', user.id, req, 'Account inactive')
        return reply.status(403).send({ error: 'Account is inactive' })
      }
      
      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password)
      
      if (!passwordValid) {
        // Track failed attempt
        const lockStatus = await onLoginFailure(user.email, req)
        
        // Update database with attempts
        const newFailedAttempts = user.failedLoginAttempts + 1
        const isLocked = newFailedAttempts >= 5
        
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: newFailedAttempts,
            lockedAt: isLocked ? new Date(Date.now() + 15 * 60 * 1000) : null, // Lock for 15 min
          },
        })
        
        await logAuthEvent('LOGIN_FAILED', user.id, req, `Failed attempt ${newFailedAttempts}/5`)
        await logSecurityEventRecord({
          eventType: SecurityEventType.FAILED_LOGIN,
          severity: isLocked ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM,
          source: 'auth/login',
          message: `Failed login attempt ${newFailedAttempts}/5`,
          details: {
            email,
            failedAttempts: newFailedAttempts,
            lockApplied: isLocked,
          },
          actorId: user.id,
          ipAddress: req.ip,
        }).catch((error) => {
          logger.error({ error }, 'Failed to persist failed-login security event')
        })
        await createFailedLoginNotification(email, req.ip).catch((error) => {
          logger.error({ error }, 'Failed to persist failed-login notification')
        })
        
        if (lockStatus.locked) {
          return reply.status(429).send({
            error: 'Too many failed attempts',
            message: 'Account temporarily locked',
            retryAfter: lockStatus.waitTime
          })
        }
        
        return reply.status(401).send({ error: 'Invalid credentials' })
      }
      
      // Login successful - reset failed attempts
      await onLoginSuccess(user.email, req)
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedAt: null,
          lastLogin: new Date(),
        },
      })

      if (user.mfaEnabled) {
        const tempSessionToken = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            type: 'mfa_temp',
          },
          JWT_MFA_SESSION_SECRET,
          { expiresIn: '5m', algorithm: 'HS256' }
        )

        return reply.send({
          requiresMfa: true,
          tempSessionToken,
        })
      }
      
      // Generate secure token pair
      const { accessToken, refreshToken } = generateTokenPair({
        id: user.id,
        email: user.email,
        role: user.role,
      })
      
      // Store refresh token for revocation tracking
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      })
      
      // Log successful login
      await logAuthEvent('LOGIN', user.id, req, 'User logged in successfully')

      reply.setCookie('refreshToken', refreshToken, {
        path: '/api/v1/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
      })
      
      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          mfaEnabled: user.mfaEnabled,
        },
        mfaEnrollmentRequired: (user.role === 'ADMIN' || user.role === 'MANAGER') && !user.mfaEnabled,
      }
    } catch (error) {
      logger.error({ error }, 'Login error')
      return reply.status(500).send({ error: 'Authentication failed' })
    }
  })

  fastify.post('/api/v1/auth/mfa/enroll', {
    preHandler: [requireAuth],
  }, async (req, reply) => {
    try {
      if (!req.user?.id) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, mfaEnabled: true },
      })

      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      if (user.mfaEnabled) {
        return reply.status(409).send({ error: 'MFA is already enabled for this account' })
      }

      const enrollment = await generateMfaEnrollment(user.email)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaSecret: enrollment.secret,
          mfaRecoveryCodes: enrollment.recoveryCodes,
          mfaEnabled: false,
        },
      })

      return reply.send({
        secret: enrollment.secret,
        qrCode: enrollment.qrCodeBase64,
        recoveryCodes: enrollment.recoveryCodes,
      })
    } catch (error) {
      logger.error({ error }, 'MFA enroll error')
      return reply.status(500).send({ error: 'Failed to enroll MFA' })
    }
  })

  fastify.post('/api/v1/auth/mfa/verify', {
    preHandler: [requireAuth],
    config: { zod: { body: mfaVerifyBodySchema } },
  }, async (req, reply) => {
    try {
      if (!req.user?.id) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const { token } = req.body as MfaVerifyBody

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, mfaSecret: true, mfaEnabled: true },
      })

      if (!user || !user.mfaSecret) {
        return reply.status(400).send({ error: 'MFA enrollment not initialized' })
      }

      if (!verifyTotpToken(user.mfaSecret, token)) {
        return reply.status(401).send({ error: 'Invalid MFA token' })
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
        },
      })

      await logAuthEvent('MFA_ENABLED', user.id, req, 'User enabled MFA')
      return reply.send({ success: true })
    } catch (error) {
      logger.error({ error }, 'MFA verify error')
      return reply.status(500).send({ error: 'Failed to verify MFA token' })
    }
  })

  fastify.post('/api/v1/auth/mfa/challenge', {
    config: { zod: { body: mfaChallengeBodySchema } },
  }, async (req, reply) => {
    try {
      const { tempSessionToken, token, recoveryCode } = req.body as MfaChallengeBody

      let decoded: Record<string, unknown>
      try {
        decoded = jwt.verify(tempSessionToken, JWT_MFA_SESSION_SECRET, {
          algorithms: ['HS256'],
        }) as Record<string, unknown>
      } catch {
        return reply.status(401).send({ error: 'Invalid or expired MFA session token' })
      }

      if (decoded.type !== 'mfa_temp' || !decoded.id || typeof decoded.id !== 'string') {
        return reply.status(401).send({ error: 'Invalid MFA session token' })
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      })

      if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecret) {
        return reply.status(401).send({ error: 'MFA challenge is not available for this account' })
      }

      let challengePassed = false
      let nextRecoveryCodes = user.mfaRecoveryCodes

      if (token) {
        challengePassed = verifyTotpToken(user.mfaSecret, token)
      } else if (recoveryCode) {
        const recoveryResult = consumeRecoveryCode(user.mfaRecoveryCodes, recoveryCode)
        challengePassed = recoveryResult.isValid
        nextRecoveryCodes = recoveryResult.remainingCodes
      }

      if (!challengePassed) {
        await logAuthEvent('LOGIN_FAILED', user.id, req, 'Failed MFA challenge')
        return reply.status(401).send({ error: 'Invalid MFA code' })
      }

      if (recoveryCode) {
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaRecoveryCodes: nextRecoveryCodes },
        })
      }

      const { accessToken, refreshToken } = generateTokenPair({
        id: user.id,
        email: user.email,
        role: user.role,
      })

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      reply.setCookie('refreshToken', refreshToken, {
        path: '/api/v1/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
      })

      await logAuthEvent('LOGIN', user.id, req, 'User completed MFA challenge')

      return reply.send({
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          mfaEnabled: user.mfaEnabled,
        },
      })
    } catch (error) {
      logger.error({ error }, 'MFA challenge error')
      return reply.status(500).send({ error: 'MFA challenge failed' })
    }
  })

  // Refresh token with rotation
  fastify.post('/api/v1/auth/refresh', {
    config: { zod: { body: refreshBodySchema } },
  }, async (req, reply) => {
    try {
      const body = (req.body || {}) as RefreshBody
      const refreshToken = body?.refreshToken || req.cookies?.refreshToken
      
      if (!refreshToken) {
        return reply.status(400).send({ error: 'Refresh token required' })
      }
      
      // Verify refresh token structure before rotation
      const refreshPayload = verifyRefreshToken(refreshToken)
      if (!refreshPayload || !refreshPayload.id) {
        logger.warn({ hasPayload: !!refreshPayload }, 'Invalid refresh token attempt')
        return reply.status(401).send({ error: 'Invalid or expired refresh token' })
      }
      
      // Verify and rotate token
      const newTokens = await rotateRefreshToken(refreshToken)
      
      if (!newTokens) {
        return reply.status(401).send({ error: 'Invalid or expired refresh token' })
      }
      
      // Revoke the old token
      await revokeToken(refreshToken)
      
      // Update in database
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true }
      })
      
      // Store new refresh token with correct userId from the decoded token
      const userId = refreshPayload.id
      await prisma.refreshToken.create({
        data: {
          token: newTokens.refreshToken,
          userId: userId,  // FIX: Use actual userId from token payload
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      reply.setCookie('refreshToken', newTokens.refreshToken, {
        path: '/api/v1/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
      })
      
      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
      }
    } catch (error) {
      logger.error({ error }, 'Token refresh error')
      return reply.status(401).send({ error: 'Token refresh failed' })
    }
  })

  // Logout with token revocation
  fastify.post('/api/v1/auth/logout', {
    config: { zod: { body: logoutBodySchema } },
  }, async (req, reply) => {
    try {
      const body = (req.body || {}) as LogoutBody
      const refreshToken = body?.refreshToken || req.cookies?.refreshToken
      
      if (!refreshToken) {
        return reply.status(400).send({ error: 'Refresh token required' })
      }
      
      // Revoke token
      await Promise.all([
        revokeToken(refreshToken),
        prisma.refreshToken.updateMany({
          where: { token: refreshToken },
          data: { revoked: true }
        })
      ])
      
      // Log logout
      if (req.user?.id) {
        await logAuthEvent('LOGOUT', req.user.id, req, 'User logged out')
      }
      
      // Clear cookies
      reply.clearCookie('refreshToken', { path: '/api/v1/auth' })
      
      return { ok: true, message: 'Logged out successfully' }
    } catch (error) {
      logger.error({ error }, 'Logout error')
      return reply.status(500).send({ error: 'Logout failed' })
    }
  })

  // Get current user info
  fastify.get('/api/v1/auth/me', async (req, reply) => {
    try {
      const auth = req.headers.authorization
      if (!auth) {
        return reply.status(401).send({ error: 'Authorization header missing' })
      }
      
      const token = auth.replace(/^Bearer\s+/, '')
      if (!token) {
        return reply.status(401).send({ error: 'Invalid authorization format' })
      }
      
      // Use proper JWT verification function with error handling
      const payload = verifyAccessToken(token)
      if (!payload || !payload.id) {
        return reply.status(401).send({ error: 'Invalid or expired token' })
      }
      
      const user = await prisma.user.findUnique({ where: { id: payload.id } })
      
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }
      
      if (!user.isActive) {
        return reply.status(403).send({ error: 'User account is inactive' })
      }
      
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      }
    } catch (error) {
      logger.error({ error }, 'Auth me error')
      return reply.status(401).send({ error: 'Token verification failed' })
    }
  })
}
