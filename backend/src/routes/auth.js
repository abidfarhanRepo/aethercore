"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
var bcryptjs_1 = require("bcryptjs");
var db_1 = require("../utils/db");
var jwt_1 = require("../lib/jwt");
var sanitizer_1 = require("../utils/sanitizer");
var brute_force_1 = require("../middleware/brute-force");
var audit_1 = require("../utils/audit");
function authRoutes(fastify) {
    return __awaiter(this, void 0, void 0, function () {
        var registerSchema, loginSchema;
        var _this = this;
        return __generator(this, function (_a) {
            registerSchema = {
                body: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 8 }
                    }
                }
            };
            loginSchema = {
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
            fastify.post('/api/auth/register', { schema: registerSchema }, function (req, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, rawEmail, rawPassword, email, passwordValidation, existingUser, hash, user, error_1;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 9, , 10]);
                            _a = req.body, rawEmail = _a.email, rawPassword = _a.password;
                            // Input validation and sanitization
                            if (!rawEmail || !rawPassword) {
                                return [2 /*return*/, reply.status(400).send({ error: 'Email and password required' })];
                            }
                            if (!((0, sanitizer_1.removeSQLInjectionPatterns)(rawEmail) || (0, sanitizer_1.removeSQLInjectionPatterns)(rawPassword))) return [3 /*break*/, 2];
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('LOGIN_FAILED', undefined, req, 'SQL injection attempt detected')];
                        case 1:
                            _b.sent();
                            return [2 /*return*/, reply.status(400).send({ error: 'Invalid input' })];
                        case 2:
                            if (!((0, sanitizer_1.containsXSSPatterns)(rawEmail) || (0, sanitizer_1.containsXSSPatterns)(rawPassword))) return [3 /*break*/, 4];
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('LOGIN_FAILED', undefined, req, 'XSS pattern detected')];
                        case 3:
                            _b.sent();
                            return [2 /*return*/, reply.status(400).send({ error: 'Invalid input' })];
                        case 4:
                            email = (0, sanitizer_1.sanitizeEmail)(rawEmail);
                            passwordValidation = (0, sanitizer_1.validatePasswordStrength)(rawPassword);
                            if (!passwordValidation.valid) {
                                return [2 /*return*/, reply.status(400).send({
                                        error: 'Password does not meet requirements',
                                        requirements: passwordValidation.errors
                                    })];
                            }
                            return [4 /*yield*/, db_1.prisma.user.findUnique({ where: { email: email } })];
                        case 5:
                            existingUser = _b.sent();
                            if (existingUser) {
                                return [2 /*return*/, reply.status(409).send({ error: 'User already exists' })];
                            }
                            return [4 /*yield*/, bcryptjs_1.default.hash(rawPassword, 12)
                                // Create user with secure defaults
                            ];
                        case 6:
                            hash = _b.sent();
                            return [4 /*yield*/, db_1.prisma.user.create({
                                    data: {
                                        email: email,
                                        password: hash,
                                        isActive: true,
                                        failedLoginAttempts: 0,
                                    }
                                })
                                // Log registration
                            ];
                        case 7:
                            user = _b.sent();
                            // Log registration
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('USER_REGISTERED', user.id, req, "User registered: ".concat(email))];
                        case 8:
                            // Log registration
                            _b.sent();
                            return [2 /*return*/, {
                                    id: user.id,
                                    email: user.email,
                                    message: 'User registered successfully'
                                }];
                        case 9:
                            error_1 = _b.sent();
                            console.error('Registration error:', error_1);
                            return [2 /*return*/, reply.status(500).send({ error: 'Registration failed' })];
                        case 10: return [2 /*return*/];
                    }
                });
            }); });
            // Login with enhanced security
            fastify.post('/api/auth/login', { schema: loginSchema }, function (req, reply) { return __awaiter(_this, void 0, void 0, function () {
                var _a, rawEmail, password, email, _b, user, passwordValid, lockStatus, newFailedAttempts, isLocked, _c, accessToken, refreshToken, error_2;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _d.trys.push([0, 22, , 23]);
                            _a = req.body, rawEmail = _a.email, password = _a.password;
                            if (!rawEmail || !password) {
                                return [2 /*return*/, reply.status(400).send({ error: 'Email and password required' })];
                            }
                            email = void 0;
                            _d.label = 1;
                        case 1:
                            _d.trys.push([1, 2, , 4]);
                            email = (0, sanitizer_1.sanitizeEmail)(rawEmail);
                            return [3 /*break*/, 4];
                        case 2:
                            _b = _d.sent();
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('LOGIN_FAILED', undefined, req, 'Invalid email format')];
                        case 3:
                            _d.sent();
                            return [2 /*return*/, reply.status(400).send({ error: 'Invalid email' })];
                        case 4: return [4 /*yield*/, db_1.prisma.user.findUnique({ where: { email: email } })];
                        case 5:
                            user = _d.sent();
                            if (!!user) return [3 /*break*/, 8];
                            // Log failed attempt with fake user identifier for audit
                            return [4 /*yield*/, (0, brute_force_1.onLoginFailure)(email, req)];
                        case 6:
                            // Log failed attempt with fake user identifier for audit
                            _d.sent();
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('LOGIN_FAILED', undefined, req, "User not found: ".concat(email))
                                // Don't reveal if user exists
                            ];
                        case 7:
                            _d.sent();
                            // Don't reveal if user exists
                            return [2 /*return*/, reply.status(401).send({ error: 'Invalid credentials' })];
                        case 8:
                            if (!(user.lockedAt && new Date(user.lockedAt) > new Date())) return [3 /*break*/, 10];
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('LOGIN_FAILED', user.id, req, 'Account locked')];
                        case 9:
                            _d.sent();
                            return [2 /*return*/, reply.status(403).send({
                                    error: 'Account locked',
                                    message: 'Too many failed login attempts. Contact administrator.'
                                })];
                        case 10:
                            if (!!user.isActive) return [3 /*break*/, 12];
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('LOGIN_FAILED', user.id, req, 'Account inactive')];
                        case 11:
                            _d.sent();
                            return [2 /*return*/, reply.status(403).send({ error: 'Account is inactive' })];
                        case 12: return [4 /*yield*/, bcryptjs_1.default.compare(password, user.password)];
                        case 13:
                            passwordValid = _d.sent();
                            if (!!passwordValid) return [3 /*break*/, 17];
                            return [4 /*yield*/, (0, brute_force_1.onLoginFailure)(user.email, req)
                                // Update database with attempts
                            ];
                        case 14:
                            lockStatus = _d.sent();
                            newFailedAttempts = user.failedLoginAttempts + 1;
                            isLocked = newFailedAttempts >= 5;
                            return [4 /*yield*/, db_1.prisma.user.update({
                                    where: { id: user.id },
                                    data: {
                                        failedLoginAttempts: newFailedAttempts,
                                        lockedAt: isLocked ? new Date(Date.now() + 15 * 60 * 1000) : null, // Lock for 15 min
                                    },
                                })];
                        case 15:
                            _d.sent();
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('LOGIN_FAILED', user.id, req, "Failed attempt ".concat(newFailedAttempts, "/5"))];
                        case 16:
                            _d.sent();
                            if (lockStatus.locked) {
                                return [2 /*return*/, reply.status(429).send({
                                        error: 'Too many failed attempts',
                                        message: 'Account temporarily locked',
                                        retryAfter: lockStatus.waitTime
                                    })];
                            }
                            return [2 /*return*/, reply.status(401).send({ error: 'Invalid credentials' })];
                        case 17: 
                        // Login successful - reset failed attempts
                        return [4 /*yield*/, (0, brute_force_1.onLoginSuccess)(user.email, req)];
                        case 18:
                            // Login successful - reset failed attempts
                            _d.sent();
                            return [4 /*yield*/, db_1.prisma.user.update({
                                    where: { id: user.id },
                                    data: {
                                        failedLoginAttempts: 0,
                                        lockedAt: null,
                                        lastLogin: new Date(),
                                    },
                                })
                                // Generate secure token pair
                            ];
                        case 19:
                            _d.sent();
                            _c = (0, jwt_1.generateTokenPair)({
                                id: user.id,
                                email: user.email,
                                role: user.role,
                            }), accessToken = _c.accessToken, refreshToken = _c.refreshToken;
                            // Store refresh token for revocation tracking
                            return [4 /*yield*/, db_1.prisma.refreshToken.create({
                                    data: {
                                        token: refreshToken,
                                        userId: user.id,
                                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                                    },
                                })
                                // Log successful login
                            ];
                        case 20:
                            // Store refresh token for revocation tracking
                            _d.sent();
                            // Log successful login
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('LOGIN', user.id, req, 'User logged in successfully')];
                        case 21:
                            // Log successful login
                            _d.sent();
                            return [2 /*return*/, {
                                    accessToken: accessToken,
                                    refreshToken: refreshToken,
                                    expiresIn: 15 * 60, // 15 minutes
                                    user: {
                                        id: user.id,
                                        email: user.email,
                                        role: user.role,
                                        firstName: user.firstName || '',
                                        lastName: user.lastName || '',
                                    }
                                }];
                        case 22:
                            error_2 = _d.sent();
                            console.error('Login error:', error_2);
                            return [2 /*return*/, reply.status(500).send({ error: 'Authentication failed' })];
                        case 23: return [2 /*return*/];
                    }
                });
            }); });
            // Refresh token with rotation
            fastify.post('/api/auth/refresh', function (req, reply) { return __awaiter(_this, void 0, void 0, function () {
                var refreshToken, refreshPayload, newTokens, userId, error_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, , 6]);
                            refreshToken = req.body.refreshToken;
                            if (!refreshToken) {
                                return [2 /*return*/, reply.status(400).send({ error: 'Refresh token required' })];
                            }
                            refreshPayload = (0, jwt_1.verifyRefreshToken)(refreshToken);
                            if (!refreshPayload || !refreshPayload.id) {
                                console.warn('Invalid refresh token attempt:', { hasPayload: !!refreshPayload });
                                return [2 /*return*/, reply.status(401).send({ error: 'Invalid or expired refresh token' })];
                            }
                            return [4 /*yield*/, (0, jwt_1.rotateRefreshToken)(refreshToken)];
                        case 1:
                            newTokens = _a.sent();
                            if (!newTokens) {
                                return [2 /*return*/, reply.status(401).send({ error: 'Invalid or expired refresh token' })];
                            }
                            // Revoke the old token
                            return [4 /*yield*/, (0, jwt_1.revokeToken)(refreshToken)
                                // Update in database
                            ];
                        case 2:
                            // Revoke the old token
                            _a.sent();
                            // Update in database
                            return [4 /*yield*/, db_1.prisma.refreshToken.updateMany({
                                    where: { token: refreshToken },
                                    data: { revoked: true }
                                })
                                // Store new refresh token with correct userId from the decoded token
                            ];
                        case 3:
                            // Update in database
                            _a.sent();
                            userId = refreshPayload.id;
                            return [4 /*yield*/, db_1.prisma.refreshToken.create({
                                    data: {
                                        token: newTokens.refreshToken,
                                        userId: userId, // FIX: Use actual userId from token payload
                                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                                    },
                                })];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, {
                                    accessToken: newTokens.accessToken,
                                    refreshToken: newTokens.refreshToken,
                                    expiresIn: newTokens.expiresIn,
                                }];
                        case 5:
                            error_3 = _a.sent();
                            console.error('Token refresh error:', error_3);
                            return [2 /*return*/, reply.status(401).send({ error: 'Token refresh failed' })];
                        case 6: return [2 /*return*/];
                    }
                });
            }); });
            // Logout with token revocation
            fastify.post('/api/auth/logout', function (req, reply) { return __awaiter(_this, void 0, void 0, function () {
                var refreshToken, error_4;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 4, , 5]);
                            refreshToken = req.body.refreshToken;
                            if (!refreshToken) {
                                return [2 /*return*/, reply.status(400).send({ error: 'Refresh token required' })];
                            }
                            // Revoke token
                            return [4 /*yield*/, Promise.all([
                                    (0, jwt_1.revokeToken)(refreshToken),
                                    db_1.prisma.refreshToken.updateMany({
                                        where: { token: refreshToken },
                                        data: { revoked: true }
                                    })
                                ])
                                // Log logout
                            ];
                        case 1:
                            // Revoke token
                            _b.sent();
                            if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) return [3 /*break*/, 3];
                            return [4 /*yield*/, (0, audit_1.logAuthEvent)('LOGOUT', req.user.id, req, 'User logged out')];
                        case 2:
                            _b.sent();
                            _b.label = 3;
                        case 3:
                            // Clear cookies
                            reply.clearCookie('refreshToken', { path: '/api/auth' });
                            return [2 /*return*/, { ok: true, message: 'Logged out successfully' }];
                        case 4:
                            error_4 = _b.sent();
                            console.error('Logout error:', error_4);
                            return [2 /*return*/, reply.status(500).send({ error: 'Logout failed' })];
                        case 5: return [2 /*return*/];
                    }
                });
            }); });
            // Get current user info
            fastify.get('/api/auth/me', function (req, reply) { return __awaiter(_this, void 0, void 0, function () {
                var auth, token, payload, user, error_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            auth = req.headers.authorization;
                            if (!auth) {
                                return [2 /*return*/, reply.status(401).send({ error: 'Authorization header missing' })];
                            }
                            token = auth.replace(/^Bearer\s+/, '');
                            if (!token) {
                                return [2 /*return*/, reply.status(401).send({ error: 'Invalid authorization format' })];
                            }
                            payload = (0, jwt_1.verifyAccessToken)(token);
                            if (!payload || !payload.id) {
                                return [2 /*return*/, reply.status(401).send({ error: 'Invalid or expired token' })];
                            }
                            return [4 /*yield*/, db_1.prisma.user.findUnique({ where: { id: payload.id } })];
                        case 1:
                            user = _a.sent();
                            if (!user) {
                                return [2 /*return*/, reply.status(404).send({ error: 'User not found' })];
                            }
                            if (!user.isActive) {
                                return [2 /*return*/, reply.status(403).send({ error: 'User account is inactive' })];
                            }
                            return [2 /*return*/, {
                                    id: user.id,
                                    email: user.email,
                                    role: user.role,
                                    firstName: user.firstName || '',
                                    lastName: user.lastName || '',
                                }];
                        case 2:
                            error_5 = _a.sent();
                            console.error('Auth me error:', error_5);
                            return [2 /*return*/, reply.status(401).send({ error: 'Token verification failed' })];
                        case 3: return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}
