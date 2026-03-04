import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../utils/db'
import { generateTokenPair, rotateRefreshToken, revokeToken, verifyAccessToken, verifyRefreshToken } from '../lib/jwt'
import { sanitizeEmail, sanitizeString, validatePasswordStrength, removeSQLInjectionPatterns, containsXSSPatterns } from '../utils/sanitizer'
import { onLoginSuccess, onLoginFailure } from '../middleware/brute-force'
import { logAuthEvent } from '../utils/audit'


export default async function authRoutes(fastify: FastifyInstance) {
  const registerSchema = {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 }
      }
    }
  }

  const loginSchema = {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' }
      }
    }
  }

  // Register with enhanced security
  fastify.post('/api/auth/register', { schema: registerSchema }, async (req, reply) => {
    try {
      const { email: rawEmail, password: rawPassword } = req.body as any
      
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
      console.error('Registration error:', error)
      return reply.status(500).send({ error: 'Registration failed' })
    }
  })

  // Login with enhanced security
  fastify.post('/api/auth/login', { schema: loginSchema }, async (req, reply) => {
    try {
      const { email: rawEmail, password } = req.body as any
      
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
      
      // Find user
      const user = await prisma.user.findUnique({ where: { email } })
      
      if (!user) {
        // Log failed attempt with fake user identifier for audit
        await onLoginFailure(email, req)
        await logAuthEvent('LOGIN_FAILED', undefined, req, `User not found: ${email}`)
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
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      return reply.status(500).send({ error: 'Authentication failed' })
    }
  })

  // Refresh token with rotation
  fastify.post('/api/auth/refresh', async (req, reply) => {
    try {
      const { refreshToken } = req.body as any
      
      if (!refreshToken) {
        return reply.status(400).send({ error: 'Refresh token required' })
      }
      
      // Verify refresh token structure before rotation
      const refreshPayload = verifyRefreshToken(refreshToken)
      if (!refreshPayload || !refreshPayload.id) {
        console.warn('Invalid refresh token attempt:', { hasPayload: !!refreshPayload })
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
      
      return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      return reply.status(401).send({ error: 'Token refresh failed' })
    }
  })

  // Logout with token revocation
  fastify.post('/api/auth/logout', async (req, reply) => {
    try {
      const { refreshToken } = req.body as any
      
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
      reply.clearCookie('refreshToken', { path: '/api/auth' })
      
      return { ok: true, message: 'Logged out successfully' }
    } catch (error) {
      console.error('Logout error:', error)
      return reply.status(500).send({ error: 'Logout failed' })
    }
  })

  // Get current user info
  fastify.get('/api/auth/me', async (req, reply) => {
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
      console.error('Auth me error:', error)
      return reply.status(401).send({ error: 'Token verification failed' })
    }
  })
}
