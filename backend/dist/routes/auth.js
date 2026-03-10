"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../utils/db");
const client_1 = require("@prisma/client");
const jwt_1 = require("../lib/jwt");
const sanitizer_1 = require("../utils/sanitizer");
const brute_force_1 = require("../middleware/brute-force");
const audit_1 = require("../utils/audit");
const notificationService_1 = require("../lib/notificationService");
const securityCompliance_1 = require("../lib/securityCompliance");
const logger_1 = require("../utils/logger");
const authMiddleware_1 = require("../plugins/authMiddleware");
const mfaService_1 = require("../lib/mfaService");
const auth_1 = require("../schemas/auth");
async function authRoutes(fastify) {
    const JWT_MFA_SESSION_SECRET = process.env.JWT_MFA_SESSION_SECRET || process.env.JWT_ACCESS_SECRET || 'change_me_mfa_session_secret';
    const pinAttempts = new Map();
    const MAX_PIN_ATTEMPTS = 5;
    const PIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
    async function ensureDevAdminUser(email) {
        if (process.env.NODE_ENV === 'production') {
            return null;
        }
        if (email !== 'admin@aether.dev') {
            return null;
        }
        const existing = await db_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            return existing;
        }
        const fallbackPassword = process.env.DEV_ADMIN_PASSWORD || 'password123';
        const hash = await bcryptjs_1.default.hash(fallbackPassword, 10);
        return db_1.prisma.user.create({
            data: {
                email,
                password: hash,
                role: 'ADMIN',
                isActive: true,
                failedLoginAttempts: 0,
            },
        });
    }
    // Register with enhanced security
    fastify.post('/api/v1/auth/register', {
        config: { zod: { body: auth_1.registerBodySchema } },
    }, async (req, reply) => {
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
            logger_1.logger.error({ error }, 'Registration error');
            return reply.status(500).send({ error: 'Registration failed' });
        }
    });
    // Login with enhanced security
    fastify.post('/api/v1/auth/login', {
        config: { zod: { body: auth_1.loginBodySchema } },
    }, async (req, reply) => {
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
            // Find user; in development, auto-bootstrap admin login user if missing.
            let user = await db_1.prisma.user.findUnique({ where: { email } });
            if (!user) {
                user = await ensureDevAdminUser(email);
            }
            if (!user) {
                // Log failed attempt with fake user identifier for audit
                await (0, brute_force_1.onLoginFailure)(email, req);
                await (0, audit_1.logAuthEvent)('LOGIN_FAILED', undefined, req, `User not found: ${email}`);
                await (0, securityCompliance_1.logSecurityEventRecord)({
                    eventType: client_1.SecurityEventType.FAILED_LOGIN,
                    severity: client_1.SecuritySeverity.MEDIUM,
                    source: 'auth/login',
                    message: 'Failed login attempt for unknown user',
                    details: { email },
                    ipAddress: req.ip,
                }).catch((error) => {
                    logger_1.logger.error({ error }, 'Failed to persist failed-login security event');
                });
                await (0, notificationService_1.createFailedLoginNotification)(email, req.ip).catch((error) => {
                    logger_1.logger.error({ error }, 'Failed to persist failed-login notification');
                });
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
                await (0, securityCompliance_1.logSecurityEventRecord)({
                    eventType: client_1.SecurityEventType.FAILED_LOGIN,
                    severity: isLocked ? client_1.SecuritySeverity.HIGH : client_1.SecuritySeverity.MEDIUM,
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
                    logger_1.logger.error({ error }, 'Failed to persist failed-login security event');
                });
                await (0, notificationService_1.createFailedLoginNotification)(email, req.ip).catch((error) => {
                    logger_1.logger.error({ error }, 'Failed to persist failed-login notification');
                });
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
            if (user.mfaEnabled) {
                const tempSessionToken = jsonwebtoken_1.default.sign({
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    type: 'mfa_temp',
                }, JWT_MFA_SESSION_SECRET, { expiresIn: '5m', algorithm: 'HS256' });
                return reply.send({
                    requiresMfa: true,
                    tempSessionToken,
                });
            }
            // Generate secure token pair
            const { accessToken, refreshToken } = (0, jwt_1.generateTokenPair)({
                id: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
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
            reply.setCookie('refreshToken', refreshToken, {
                path: '/api/v1/auth',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60,
            });
            return {
                accessToken,
                refreshToken,
                expiresIn: 8 * 60 * 60, // 8 hours
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    tenantId: user.tenantId,
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    mfaEnabled: user.mfaEnabled,
                    hasPinSet: Boolean(user.pinHash),
                },
                mfaEnrollmentRequired: (user.role === 'ADMIN' || user.role === 'MANAGER') && !user.mfaEnabled,
            };
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Login error');
            return reply.status(500).send({ error: 'Authentication failed' });
        }
    });
    fastify.post('/api/v1/auth/mfa/enroll', {
        preHandler: [authMiddleware_1.requireAuth],
    }, async (req, reply) => {
        try {
            if (!req.user?.id) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }
            const user = await db_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: { id: true, email: true, mfaEnabled: true },
            });
            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }
            if (user.mfaEnabled) {
                return reply.status(409).send({ error: 'MFA is already enabled for this account' });
            }
            const enrollment = await (0, mfaService_1.generateMfaEnrollment)(user.email);
            await db_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    mfaSecret: enrollment.secret,
                    mfaRecoveryCodes: enrollment.recoveryCodes,
                    mfaEnabled: false,
                },
            });
            return reply.send({
                secret: enrollment.secret,
                qrCode: enrollment.qrCodeBase64,
                recoveryCodes: enrollment.recoveryCodes,
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'MFA enroll error');
            return reply.status(500).send({ error: 'Failed to enroll MFA' });
        }
    });
    fastify.post('/api/v1/auth/mfa/verify', {
        preHandler: [authMiddleware_1.requireAuth],
        config: { zod: { body: auth_1.mfaVerifyBodySchema } },
    }, async (req, reply) => {
        try {
            if (!req.user?.id) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }
            const { token } = req.body;
            const user = await db_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: { id: true, mfaSecret: true, mfaEnabled: true },
            });
            if (!user || !user.mfaSecret) {
                return reply.status(400).send({ error: 'MFA enrollment not initialized' });
            }
            if (!(0, mfaService_1.verifyTotpToken)(user.mfaSecret, token)) {
                return reply.status(401).send({ error: 'Invalid MFA token' });
            }
            await db_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    mfaEnabled: true,
                },
            });
            await (0, audit_1.logAuthEvent)('MFA_ENABLED', user.id, req, 'User enabled MFA');
            return reply.send({ success: true });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'MFA verify error');
            return reply.status(500).send({ error: 'Failed to verify MFA token' });
        }
    });
    fastify.post('/api/v1/auth/mfa/challenge', {
        config: { zod: { body: auth_1.mfaChallengeBodySchema } },
    }, async (req, reply) => {
        try {
            const { tempSessionToken, token, recoveryCode } = req.body;
            let decoded;
            try {
                decoded = jsonwebtoken_1.default.verify(tempSessionToken, JWT_MFA_SESSION_SECRET, {
                    algorithms: ['HS256'],
                });
            }
            catch {
                return reply.status(401).send({ error: 'Invalid or expired MFA session token' });
            }
            if (decoded.type !== 'mfa_temp' || !decoded.id || typeof decoded.id !== 'string') {
                return reply.status(401).send({ error: 'Invalid MFA session token' });
            }
            const user = await db_1.prisma.user.findUnique({
                where: { id: decoded.id },
            });
            if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecret) {
                return reply.status(401).send({ error: 'MFA challenge is not available for this account' });
            }
            let challengePassed = false;
            let nextRecoveryCodes = user.mfaRecoveryCodes;
            if (token) {
                challengePassed = (0, mfaService_1.verifyTotpToken)(user.mfaSecret, token);
            }
            else if (recoveryCode) {
                const recoveryResult = (0, mfaService_1.consumeRecoveryCode)(user.mfaRecoveryCodes, recoveryCode);
                challengePassed = recoveryResult.isValid;
                nextRecoveryCodes = recoveryResult.remainingCodes;
            }
            if (!challengePassed) {
                await (0, audit_1.logAuthEvent)('LOGIN_FAILED', user.id, req, 'Failed MFA challenge');
                await (0, securityCompliance_1.logSecurityEventRecord)({
                    eventType: client_1.SecurityEventType.MFA_FAILED,
                    severity: client_1.SecuritySeverity.HIGH,
                    source: 'api/auth/mfa/challenge',
                    message: 'Failed MFA challenge',
                    details: {
                        type: 'auth.mfa_failed',
                        mode: token ? 'totp' : 'recovery',
                    },
                    actorId: user.id,
                    ipAddress: req.ip,
                }).catch(() => { });
                return reply.status(401).send({ error: 'Invalid MFA code' });
            }
            if (recoveryCode) {
                await db_1.prisma.user.update({
                    where: { id: user.id },
                    data: { mfaRecoveryCodes: nextRecoveryCodes },
                });
            }
            const { accessToken, refreshToken } = (0, jwt_1.generateTokenPair)({
                id: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
            });
            await db_1.prisma.refreshToken.create({
                data: {
                    token: refreshToken,
                    userId: user.id,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });
            reply.setCookie('refreshToken', refreshToken, {
                path: '/api/v1/auth',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60,
            });
            await (0, audit_1.logAuthEvent)('LOGIN', user.id, req, 'User completed MFA challenge');
            return reply.send({
                accessToken,
                refreshToken,
                expiresIn: 8 * 60 * 60,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    tenantId: user.tenantId,
                    firstName: user.firstName || '',
                    lastName: user.lastName || '',
                    mfaEnabled: user.mfaEnabled,
                    hasPinSet: Boolean(user.pinHash),
                },
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'MFA challenge error');
            return reply.status(500).send({ error: 'MFA challenge failed' });
        }
    });
    fastify.get('/api/v1/auth/mfa/status', {
        preHandler: [authMiddleware_1.requireAuth],
    }, async (req, reply) => {
        try {
            if (!req.user?.id) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }
            const user = await db_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    mfaEnabled: true,
                    mfaRecoveryCodes: true,
                },
            });
            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }
            return reply.send({
                mfaEnabled: user.mfaEnabled,
                recoveryCodesRemaining: user.mfaRecoveryCodes.length,
                recoveryCodes: user.mfaRecoveryCodes,
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'MFA status error');
            return reply.status(500).send({ error: 'Failed to load MFA status' });
        }
    });
    fastify.get('/api/v1/auth/mfa/recovery-codes', {
        preHandler: [authMiddleware_1.requireAuth],
    }, async (req, reply) => {
        try {
            if (!req.user?.id) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }
            const user = await db_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    mfaRecoveryCodes: true,
                },
            });
            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }
            return reply.send({
                recoveryCodes: user.mfaRecoveryCodes,
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'MFA recovery-codes error');
            return reply.status(500).send({ error: 'Failed to load recovery codes' });
        }
    });
    fastify.post('/api/v1/auth/mfa/reset', {
        preHandler: [authMiddleware_1.requireAuth],
    }, async (req, reply) => {
        try {
            if (!req.user?.id) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }
            await db_1.prisma.user.update({
                where: { id: req.user.id },
                data: {
                    mfaEnabled: false,
                    mfaSecret: null,
                    mfaRecoveryCodes: [],
                },
            });
            await (0, audit_1.logAuthEvent)('MFA_DISABLED', req.user.id, req, 'User reset MFA enrollment');
            return reply.send({ success: true });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'MFA reset error');
            return reply.status(500).send({ error: 'Failed to reset MFA' });
        }
    });
    fastify.post('/api/v1/auth/verify-pin', {
        preHandler: [authMiddleware_1.requireAuth],
    }, async (req, reply) => {
        try {
            if (!req.user?.id) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }
            const body = (req.body || {});
            const pin = (body.pin || '').trim();
            if (!/^\d{4,8}$/.test(pin)) {
                return reply.status(400).send({ error: 'PIN must be 4 to 8 digits' });
            }
            const user = await db_1.prisma.user.findUnique({
                where: { id: req.user.id },
                select: { pinHash: true },
            });
            if (!user?.pinHash) {
                return reply.status(400).send({ error: 'PIN not set for this account' });
            }
            const now = Date.now();
            const currentAttemptState = pinAttempts.get(req.user.id);
            const activeWindow = currentAttemptState && now - currentAttemptState.firstAttemptAt <= PIN_ATTEMPT_WINDOW_MS
                ? currentAttemptState
                : { count: 0, firstAttemptAt: now };
            if (activeWindow.count >= MAX_PIN_ATTEMPTS) {
                return reply
                    .status(429)
                    .header('Retry-After', String(Math.ceil(PIN_ATTEMPT_WINDOW_MS / 1000)))
                    .send({ error: 'Too many PIN attempts. Please try again later.' });
            }
            const verified = await bcryptjs_1.default.compare(pin, user.pinHash);
            if (!verified) {
                pinAttempts.set(req.user.id, {
                    count: activeWindow.count + 1,
                    firstAttemptAt: activeWindow.firstAttemptAt,
                });
                await (0, securityCompliance_1.logSecurityEventRecord)({
                    eventType: client_1.SecurityEventType.FAILED_LOGIN,
                    severity: activeWindow.count + 1 >= MAX_PIN_ATTEMPTS ? client_1.SecuritySeverity.HIGH : client_1.SecuritySeverity.MEDIUM,
                    source: 'auth/verify-pin',
                    message: `Failed PIN verification attempt (${activeWindow.count + 1}/${MAX_PIN_ATTEMPTS})`,
                    details: {
                        userId: req.user.id,
                        attempt: activeWindow.count + 1,
                        maxAttempts: MAX_PIN_ATTEMPTS,
                    },
                    actorId: req.user.id,
                    ipAddress: req.ip,
                }).catch((eventError) => {
                    logger_1.logger.error({ eventError }, 'Failed to persist PIN security event');
                });
                return reply.status(401).send({ error: 'Invalid PIN' });
            }
            pinAttempts.delete(req.user.id);
            return reply.send({ verified: true });
        }
        catch (error) {
            logger_1.logger.error({ error }, 'PIN verification error');
            return reply.status(500).send({ error: 'Failed to verify PIN' });
        }
    });
    // Refresh token with rotation
    fastify.post('/api/v1/auth/refresh', {
        config: { zod: { body: auth_1.refreshBodySchema } },
    }, async (req, reply) => {
        try {
            const body = (req.body || {});
            const refreshToken = body?.refreshToken || req.cookies?.refreshToken;
            if (!refreshToken) {
                return reply.status(400).send({ error: 'Refresh token required' });
            }
            // Verify refresh token structure before rotation
            const refreshPayload = (0, jwt_1.verifyRefreshToken)(refreshToken);
            if (!refreshPayload || !refreshPayload.id) {
                logger_1.logger.warn({ hasPayload: !!refreshPayload }, 'Invalid refresh token attempt');
                return reply.status(401).send({ error: 'Invalid or expired refresh token' });
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
            // Store new refresh token with correct userId from the decoded token
            const userId = refreshPayload.id;
            await db_1.prisma.refreshToken.create({
                data: {
                    token: newTokens.refreshToken,
                    userId: userId, // FIX: Use actual userId from token payload
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });
            reply.setCookie('refreshToken', newTokens.refreshToken, {
                path: '/api/v1/auth',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60,
            });
            return {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                expiresIn: newTokens.expiresIn,
            };
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Token refresh error');
            return reply.status(401).send({ error: 'Token refresh failed' });
        }
    });
    // Logout with token revocation
    fastify.post('/api/v1/auth/logout', {
        config: { zod: { body: auth_1.logoutBodySchema } },
    }, async (req, reply) => {
        try {
            const body = (req.body || {});
            const refreshToken = body?.refreshToken || req.cookies?.refreshToken;
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
            reply.clearCookie('refreshToken', { path: '/api/v1/auth' });
            return { ok: true, message: 'Logged out successfully' };
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Logout error');
            return reply.status(500).send({ error: 'Logout failed' });
        }
    });
    // Get current user info
    fastify.get('/api/v1/auth/me', async (req, reply) => {
        try {
            const auth = req.headers.authorization;
            if (!auth) {
                return reply.status(401).send({ error: 'Authorization header missing' });
            }
            const token = auth.replace(/^Bearer\s+/, '');
            if (!token) {
                return reply.status(401).send({ error: 'Invalid authorization format' });
            }
            // Use proper JWT verification function with error handling
            const payload = (0, jwt_1.verifyAccessToken)(token);
            if (!payload || !payload.id) {
                return reply.status(401).send({ error: 'Invalid or expired token' });
            }
            const user = await db_1.prisma.user.findUnique({ where: { id: payload.id } });
            if (!user) {
                return reply.status(404).send({ error: 'User not found' });
            }
            if (!user.isActive) {
                return reply.status(403).send({ error: 'User account is inactive' });
            }
            return {
                id: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                mfaEnabled: user.mfaEnabled,
                hasPinSet: Boolean(user.pinHash),
            };
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Auth me error');
            return reply.status(401).send({ error: 'Token verification failed' });
        }
    });
}
