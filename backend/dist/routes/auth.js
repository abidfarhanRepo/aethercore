"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../utils/db");
const jwt_1 = require("../lib/jwt");
const sanitizer_1 = require("../utils/sanitizer");
const brute_force_1 = require("../middleware/brute-force");
const audit_1 = require("../utils/audit");
async function authRoutes(fastify) {
    const registerSchema = {
        body: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8 }
            }
        }
    };
    const loginSchema = {
        body: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string' }
            }
        }
    };
    // Register with enhanced security
    fastify.post('/auth/register', { schema: registerSchema }, async (req, reply) => {
        try {
            const { email: rawEmail, password: rawPassword } = req.body;
            // Input validation and sanitization
            if (!rawEmail || !rawPassword) {
                return reply.status(400).send({ error: 'Email and password required' });
            }
            if ((0, sanitizer_1.removeSQLInjectionPatterns)(rawEmail) || (0, sanitizer_1.removeSQLInjectionPatterns)(rawPassword)) {
                await (0, audit_1.logAuthEvent)('LOGIN_FAILED', undefined, req, 'SQL injection attempt detected');
                return reply.status(400).send({ error: 'Invalid input' });
            }
            if ((0, sanitizer_1.containsXSSPatterns)(rawEmail) || (0, sanitizer_1.containsXSSPatterns)(rawPassword)) {
                await (0, audit_1.logAuthEvent)('LOGIN_FAILED', undefined, req, 'XSS pattern detected');
                return reply.status(400).send({ error: 'Invalid input' });
            }
            const email = (0, sanitizer_1.sanitizeEmail)(rawEmail);
            // Validate password strength
            const passwordValidation = (0, sanitizer_1.validatePasswordStrength)(rawPassword);
            if (!passwordValidation.valid) {
                return reply.status(400).send({
                    error: 'Password does not meet requirements',
                    requirements: passwordValidation.errors
                });
            }
            // Check if user already exists
            const existingUser = await db_1.prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return reply.status(409).send({ error: 'User already exists' });
            }
            // Hash password with higher rounds (12 for security-sensitive operation)
            const hash = await bcryptjs_1.default.hash(rawPassword, 12);
            // Create user with secure defaults
            const user = await db_1.prisma.user.create({
                data: {
                    email,
                    password: hash,
                    isActive: true,
                    failedLoginAttempts: 0,
                }
            });
            // Log registration
            await (0, audit_1.logAuthEvent)('USER_REGISTERED', user.id, req, `User registered: ${email}`);
            return {
                id: user.id,
                email: user.email,
                message: 'User registered successfully'
            };
        }
        catch (error) {
            console.error('Registration error:', error);
            return reply.status(500).send({ error: 'Registration failed' });
        }
    });
    // Login with enhanced security
    fastify.post('/auth/login', { schema: loginSchema }, async (req, reply) => {
        try {
            const { email: rawEmail, password } = req.body;
            if (!rawEmail || !password) {
                return reply.status(400).send({ error: 'Email and password required' });
            }
            // Sanitize email
            let email;
            try {
                email = (0, sanitizer_1.sanitizeEmail)(rawEmail);
            }
            catch {
                await (0, audit_1.logAuthEvent)('LOGIN_FAILED', undefined, req, 'Invalid email format');
                return reply.status(400).send({ error: 'Invalid email' });
            }
            // Find user
            const user = await db_1.prisma.user.findUnique({ where: { email } });
            if (!user) {
                // Log failed attempt with fake user identifier for audit
                await (0, brute_force_1.onLoginFailure)(email, req);
                await (0, audit_1.logAuthEvent)('LOGIN_FAILED', undefined, req, `User not found: ${email}`);
                // Don't reveal if user exists
                return reply.status(401).send({ error: 'Invalid credentials' });
            }
            // Check if account is locked
            if (user.lockedAt && new Date(user.lockedAt) > new Date()) {
                await (0, audit_1.logAuthEvent)('LOGIN_FAILED', user.id, req, 'Account locked');
                return reply.status(403).send({
                    error: 'Account locked',
                    message: 'Too many failed login attempts. Contact administrator.'
                });
            }
            // Check if account is active
            if (!user.isActive) {
                await (0, audit_1.logAuthEvent)('LOGIN_FAILED', user.id, req, 'Account inactive');
                return reply.status(403).send({ error: 'Account is inactive' });
            }
            // Verify password
            const passwordValid = await bcryptjs_1.default.compare(password, user.password);
            if (!passwordValid) {
                // Track failed attempt
                const lockStatus = await (0, brute_force_1.onLoginFailure)(user.email, req);
                // Update database with attempts
                const newFailedAttempts = user.failedLoginAttempts + 1;
                const isLocked = newFailedAttempts >= 5;
                await db_1.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        failedLoginAttempts: newFailedAttempts,
                        lockedAt: isLocked ? new Date(Date.now() + 15 * 60 * 1000) : null, // Lock for 15 min
                    },
                });
                await (0, audit_1.logAuthEvent)('LOGIN_FAILED', user.id, req, `Failed attempt ${newFailedAttempts}/5`);
                if (lockStatus.locked) {
                    return reply.status(429).send({
                        error: 'Too many failed attempts',
                        message: 'Account temporarily locked',
                        retryAfter: lockStatus.waitTime
                    });
                }
                return reply.status(401).send({ error: 'Invalid credentials' });
            }
            // Login successful - reset failed attempts
            await (0, brute_force_1.onLoginSuccess)(user.email, req);
            await db_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: 0,
                    lockedAt: null,
                    lastLogin: new Date(),
                },
            });
            // Generate secure token pair
            const { accessToken, refreshToken } = (0, jwt_1.generateTokenPair)({
                id: user.id,
                email: user.email,
                role: user.role,
            });
            // Store refresh token for revocation tracking
            await db_1.prisma.refreshToken.create({
                data: {
                    token: refreshToken,
                    userId: user.id,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                },
            });
            // Log successful login
            await (0, audit_1.logAuthEvent)('LOGIN', user.id, req, 'User logged in successfully');
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
            };
        }
        catch (error) {
            console.error('Login error:', error);
            return reply.status(500).send({ error: 'Authentication failed' });
        }
    });
    // Refresh token with rotation
    fastify.post('/auth/refresh', async (req, reply) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return reply.status(400).send({ error: 'Refresh token required' });
            }
            // Verify and rotate token
            const newTokens = await (0, jwt_1.rotateRefreshToken)(refreshToken);
            if (!newTokens) {
                return reply.status(401).send({ error: 'Invalid or expired refresh token' });
            }
            // Revoke the old token
            await (0, jwt_1.revokeToken)(refreshToken);
            // Update in database
            await db_1.prisma.refreshToken.updateMany({
                where: { token: refreshToken },
                data: { revoked: true }
            });
            // Store new refresh token
            await db_1.prisma.refreshToken.create({
                data: {
                    token: newTokens.refreshToken,
                    userId: '', // Will be set from JWT payload
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });
            return {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                expiresIn: newTokens.expiresIn,
            };
        }
        catch (error) {
            console.error('Token refresh error:', error);
            return reply.status(401).send({ error: 'Token refresh failed' });
        }
    });
    // Logout with token revocation
    fastify.post('/auth/logout', async (req, reply) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return reply.status(400).send({ error: 'Refresh token required' });
            }
            // Revoke token
            await Promise.all([
                (0, jwt_1.revokeToken)(refreshToken),
                db_1.prisma.refreshToken.updateMany({
                    where: { token: refreshToken },
                    data: { revoked: true }
                })
            ]);
            // Log logout
            if (req.user?.id) {
                await (0, audit_1.logAuthEvent)('LOGOUT', req.user.id, req, 'User logged out');
            }
            // Clear cookies
            reply.clearCookie('refreshToken', { path: '/api/auth' });
            return { ok: true, message: 'Logged out successfully' };
        }
        catch (error) {
            console.error('Logout error:', error);
            return reply.status(500).send({ error: 'Logout failed' });
        }
    });
    // Get current user info
    fastify.get('/auth/me', async (req, reply) => {
        try {
            const auth = req.headers.authorization;
            if (!auth) {
                return reply.status(401).send({ error: 'Authorization header missing' });
            }
            const token = auth.replace(/^Bearer\s+/, '');
            if (!token) {
                return reply.status(401).send({ error: 'Invalid authorization format' });
            }
            // Verify token - would use verifyAccessToken here in full implementation
            const payload = require('jsonwebtoken').verify(token, process.env.JWT_ACCESS_SECRET || 'default_access_secret_change_me');
            const user = await db_1.prisma.user.findUnique({ where: { id: payload.id } });
            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
            };
        }
        catch (error) {
            console.error('Auth me error:', error);
            return reply.status(401).send({ error: 'Invalid token' });
        }
    });
}
