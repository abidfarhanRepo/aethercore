"use strict";
/**
 * Brute force protection middleware
 * Tracks failed login attempts by IP and username
 * Uses Redis for high performance and distributed support
 */
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
exports.recordFailedAttempt = recordFailedAttempt;
exports.isLockedOut = isLockedOut;
exports.resetFailedAttempts = resetFailedAttempts;
exports.getAttemptCount = getAttemptCount;
exports.bruteForceProtection = bruteForceProtection;
exports.onLoginSuccess = onLoginSuccess;
exports.onLoginFailure = onLoginFailure;
exports.getExponentialBackoff = getExponentialBackoff;
exports.clearAllBruteForceRecords = clearAllBruteForceRecords;
exports.getBruteForceStats = getBruteForceStats;
var ioredis_1 = require("ioredis");
// Allow Redis to be disabled for development
var REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
var redis = null;
// Only initialize Redis if not disabled and not in development
if (!REDIS_DISABLED && process.env.NODE_ENV !== 'development') {
    redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
    redis.on('error', function (err) {
        console.warn('Redis client error:', err);
        // Gracefully degrade if Redis fails
    });
}
var MAX_ATTEMPTS = 5;
var LOCKOUT_DURATION = 15 * 60; // 15 minutes
var RESET_AFTER = 24 * 60 * 60; // 24 hours
/**
 * Get brute force key for tracking
 */
function getBruteForceKey(identifier, type) {
    var prefix = type === 'ip' ? 'bruteforce:ip' : 'bruteforce:user';
    return "".concat(prefix, ":").concat(identifier);
}
/**
 * Record a failed attempt
 */
function recordFailedAttempt(identifier_1) {
    return __awaiter(this, arguments, void 0, function (identifier, type, config) {
        var maxAttempts, lockoutDuration, key, attempts, locked, lockKey, ttl, error_1;
        if (type === void 0) { type = 'ip'; }
        if (config === void 0) { config = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Skip Redis operations if disabled
                    if (!redis) {
                        return [2 /*return*/, {
                                attempts: 1,
                                locked: false,
                            }];
                    }
                    maxAttempts = config.maxAttempts || MAX_ATTEMPTS;
                    lockoutDuration = config.lockoutDuration || LOCKOUT_DURATION;
                    key = getBruteForceKey(identifier, type);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    return [4 /*yield*/, redis.incr(key)
                        // Set expiration if first attempt
                    ];
                case 2:
                    attempts = _a.sent();
                    if (!(attempts === 1)) return [3 /*break*/, 4];
                    return [4 /*yield*/, redis.expire(key, config.resetAfter || RESET_AFTER)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    locked = attempts >= maxAttempts;
                    if (!locked) return [3 /*break*/, 7];
                    lockKey = "".concat(key, ":locked");
                    return [4 /*yield*/, redis.setex(lockKey, lockoutDuration, '1')
                        // Return wait time in seconds
                    ];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, redis.ttl(lockKey)];
                case 6:
                    ttl = _a.sent();
                    return [2 /*return*/, {
                            attempts: attempts,
                            locked: true,
                            waitTime: ttl > 0 ? ttl : lockoutDuration,
                        }];
                case 7: return [2 /*return*/, {
                        attempts: attempts,
                        locked: false,
                    }];
                case 8:
                    error_1 = _a.sent();
                    console.error('Failed to record failed attempt:', error_1);
                    // Fail open - don't block on Redis errors
                    return [2 /*return*/, {
                            attempts: 1,
                            locked: false,
                        }];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check if an identifier is locked out
 */
function isLockedOut(identifier_1) {
    return __awaiter(this, arguments, void 0, function (identifier, type) {
        var key, lockKey, locked, ttl, error_2;
        if (type === void 0) { type = 'ip'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Skip Redis operations if disabled
                    if (!redis) {
                        return [2 /*return*/, { locked: false }];
                    }
                    key = getBruteForceKey(identifier, type);
                    lockKey = "".concat(key, ":locked");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, redis.exists(lockKey)];
                case 2:
                    locked = _a.sent();
                    if (!locked) return [3 /*break*/, 4];
                    return [4 /*yield*/, redis.ttl(lockKey)];
                case 3:
                    ttl = _a.sent();
                    return [2 /*return*/, {
                            locked: true,
                            waitTime: ttl > 0 ? ttl : 0,
                        }];
                case 4: return [2 /*return*/, { locked: false }];
                case 5:
                    error_2 = _a.sent();
                    console.error('Failed to check lockout status:', error_2);
                    // Fail open - don't block on Redis errors
                    return [2 /*return*/, { locked: false }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Reset failed attempts for an identifier
 */
function resetFailedAttempts(identifier_1) {
    return __awaiter(this, arguments, void 0, function (identifier, type) {
        var key, lockKey, error_3;
        if (type === void 0) { type = 'ip'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Skip Redis operations if disabled
                    if (!redis) {
                        return [2 /*return*/];
                    }
                    key = getBruteForceKey(identifier, type);
                    lockKey = "".concat(key, ":locked");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redis.del(key, lockKey)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.error('Failed to reset failed attempts:', error_3);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get current failed attempts count
 */
function getAttemptCount(identifier_1) {
    return __awaiter(this, arguments, void 0, function (identifier, type) {
        var key, count, error_4;
        if (type === void 0) { type = 'ip'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Skip Redis operations if disabled
                    if (!redis) {
                        return [2 /*return*/, 0];
                    }
                    key = getBruteForceKey(identifier, type);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, redis.get(key)];
                case 2:
                    count = _a.sent();
                    return [2 /*return*/, parseInt(count || '0', 10)];
                case 3:
                    error_4 = _a.sent();
                    console.error('Failed to get attempt count:', error_4);
                    return [2 /*return*/, 0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * Brute force protection middleware for login endpoints
 */
function bruteForceProtection(request_1, reply_1) {
    return __awaiter(this, arguments, void 0, function (request, reply, config) {
        var ip, ipLockout;
        var _a;
        if (config === void 0) { config = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ip = request.ip || ((_a = request.socket) === null || _a === void 0 ? void 0 : _a.remoteAddress) || 'unknown';
                    return [4 /*yield*/, isLockedOut(ip, 'ip')];
                case 1:
                    ipLockout = _b.sent();
                    if (ipLockout.locked) {
                        reply.code(429).send({
                            error: 'Too many failed attempts',
                            message: "Please wait ".concat(ipLockout.waitTime, " seconds before trying again"),
                            retryAfter: ipLockout.waitTime,
                        });
                        return [2 /*return*/];
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Middleware to handle login success (reset counter)
 */
function onLoginSuccess(identifier, request) {
    return __awaiter(this, void 0, void 0, function () {
        var ip;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ip = request.ip || ((_a = request.socket) === null || _a === void 0 ? void 0 : _a.remoteAddress) || 'unknown';
                    // Reset failed attempts for both IP and user
                    return [4 /*yield*/, resetFailedAttempts(ip, 'ip')];
                case 1:
                    // Reset failed attempts for both IP and user
                    _b.sent();
                    return [4 /*yield*/, resetFailedAttempts(identifier, 'user')];
                case 2:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Middleware to handle login failure (track attempt)
 */
function onLoginFailure(identifier, request) {
    return __awaiter(this, void 0, void 0, function () {
        var ip, ipResult, userResult;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    ip = request.ip || ((_a = request.socket) === null || _a === void 0 ? void 0 : _a.remoteAddress) || 'unknown';
                    return [4 /*yield*/, recordFailedAttempt(ip, 'ip')];
                case 1:
                    ipResult = _b.sent();
                    return [4 /*yield*/, recordFailedAttempt(identifier, 'user')
                        // Return lock status based on whichever is more restrictive
                    ];
                case 2:
                    userResult = _b.sent();
                    // Return lock status based on whichever is more restrictive
                    if (ipResult.locked || userResult.locked) {
                        return [2 /*return*/, {
                                locked: true,
                                waitTime: Math.max(ipResult.waitTime || 0, userResult.waitTime || 0),
                            }];
                    }
                    return [2 /*return*/, {
                            locked: false,
                        }];
            }
        });
    });
}
/**
 * Exponential backoff calculation for retry
 */
function getExponentialBackoff(attemptNumber) {
    // backoff = min(maxWait, initialDelay * 2^attemptNumber) + random jitter
    var initialDelay = 1; // 1 second
    var maxWait = 3600; // 1 hour max
    var jitter = Math.random() * 1000; // 0-1 second jitter
    var waitTime = Math.min(maxWait, initialDelay * Math.pow(2, attemptNumber - 1)) * 1000;
    return (waitTime + jitter) / 1000; // Return in seconds
}
/**
 * Clear all brute force records (admin function)
 */
function clearAllBruteForceRecords() {
    return __awaiter(this, void 0, void 0, function () {
        var keys, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, redis.keys('bruteforce:*')];
                case 1:
                    keys = _a.sent();
                    if (!(keys.length > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, redis.del.apply(redis, keys)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    error_5 = _a.sent();
                    console.error('Failed to clear brute force records:', error_5);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * Get brute force statistics for monitoring
 */
function getBruteForceStats() {
    return __awaiter(this, void 0, void 0, function () {
        var lockedIPs, lockedUsers, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, redis.keys('bruteforce:ip:*:locked')];
                case 1:
                    lockedIPs = _a.sent();
                    return [4 /*yield*/, redis.keys('bruteforce:user:*:locked')];
                case 2:
                    lockedUsers = _a.sent();
                    return [2 /*return*/, {
                            totalLockedIPs: lockedIPs.length,
                            totalLockedUsers: lockedUsers.length,
                            timestamp: Date.now(),
                        }];
                case 3:
                    error_6 = _a.sent();
                    console.error('Failed to get brute force stats:', error_6);
                    return [2 /*return*/, {
                            totalLockedIPs: 0,
                            totalLockedUsers: 0,
                            timestamp: Date.now(),
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
