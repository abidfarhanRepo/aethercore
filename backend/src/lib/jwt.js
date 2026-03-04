"use strict";
/**
 * JWT security utilities with token rotation and revocation support
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.revokeToken = revokeToken;
exports.isTokenRevoked = isTokenRevoked;
exports.generateTokenPair = generateTokenPair;
exports.rotateRefreshToken = rotateRefreshToken;
exports.validateTokenClaims = validateTokenClaims;
exports.extractUserId = extractUserId;
exports.decodeTokenWithoutVerification = decodeTokenWithoutVerification;
var jsonwebtoken_1 = require("jsonwebtoken");
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
var JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'default_access_secret_change_me';
var JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_change_me';
var JWT_ACCESS_EXPIRES_IN = '15m'; // Short expiration for access tokens
var JWT_REFRESH_EXPIRES_IN = '7d';
/**
 * Validates JWT secret length (minimum 32 characters)
 */
function validateSecretLength(secret, name) {
    if (secret.length < 32) {
        throw new Error("".concat(name, " must be at least 32 characters. Set in environment variables."));
    }
}
/**
 * Generate access token (short-lived)
 */
function generateAccessToken(payload) {
    validateSecretLength(JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
    return jsonwebtoken_1.default.sign(__assign(__assign({}, payload), { type: 'access', iat: Math.floor(Date.now() / 1000) }), JWT_ACCESS_SECRET, {
        expiresIn: JWT_ACCESS_EXPIRES_IN,
        algorithm: 'HS256',
    });
}
/**
 * Generate refresh token (long-lived, rotatable)
 */
function generateRefreshToken(payload) {
    validateSecretLength(JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
    return jsonwebtoken_1.default.sign(__assign(__assign({}, payload), { type: 'refresh', iat: Math.floor(Date.now() / 1000) }), JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        algorithm: 'HS256',
    });
}
/**
 * Verify access token
 */
function verifyAccessToken(token) {
    try {
        validateSecretLength(JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
        var decoded = jsonwebtoken_1.default.verify(token, JWT_ACCESS_SECRET, {
            algorithms: ['HS256'],
        });
        if (decoded.type !== 'access') {
            return null;
        }
        return decoded;
    }
    catch (error) {
        return null;
    }
}
/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
    try {
        validateSecretLength(JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
        var decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET, {
            algorithms: ['HS256'],
        });
        if (decoded.type !== 'refresh') {
            return null;
        }
        return decoded;
    }
    catch (error) {
        return null;
    }
}
/**
 * Revoke a token by adding it to a blacklist in Redis
 */
function revokeToken(token_1) {
    return __awaiter(this, arguments, void 0, function (token, expiresIn) {
        var jti, error_1;
        if (expiresIn === void 0) { expiresIn = 900; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    jti = "revoked:".concat(token);
                    return [4 /*yield*/, redis.setex(jti, expiresIn, '1')];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error('Failed to revoke token:', error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Check if token has been revoked
 */
function isTokenRevoked(token) {
    return __awaiter(this, void 0, void 0, function () {
        var jti, revoked, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    jti = "revoked:".concat(token);
                    return [4 /*yield*/, redis.get(jti)];
                case 1:
                    revoked = _a.sent();
                    return [2 /*return*/, revoked !== null];
                case 2:
                    error_2 = _a.sent();
                    console.error('Failed to check token revocation:', error_2);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Generate token pair (access + refresh)
 */
function generateTokenPair(payload) {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
        expiresIn: 15 * 60, // 15 minutes in seconds
    };
}
/**
 * Rotate refresh token
 * Issues a new access+refresh token pair, revokes the old refresh token
 */
function rotateRefreshToken(oldRefreshToken) {
    return __awaiter(this, void 0, void 0, function () {
        var decoded, id, email, role;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    decoded = verifyRefreshToken(oldRefreshToken);
                    if (!decoded) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, isTokenRevoked(oldRefreshToken)];
                case 1:
                    // Check if token was revoked
                    if (_a.sent()) {
                        return [2 /*return*/, null];
                    }
                    // Revoke old token
                    return [4 /*yield*/, revokeToken(oldRefreshToken)
                        // Generate new token pair
                    ];
                case 2:
                    // Revoke old token
                    _a.sent();
                    id = decoded.id, email = decoded.email, role = decoded.role;
                    return [2 /*return*/, generateTokenPair({ id: id, email: email, role: role })];
            }
        });
    });
}
/**
 * Validate JWT claims
 */
function validateTokenClaims(decoded, requiredClaims) {
    if (requiredClaims === void 0) { requiredClaims = ['id', 'email', 'role']; }
    for (var _i = 0, requiredClaims_1 = requiredClaims; _i < requiredClaims_1.length; _i++) {
        var claim = requiredClaims_1[_i];
        if (!(claim in decoded)) {
            return false;
        }
    }
    return true;
}
/**
 * Extract user ID from token safely
 */
function extractUserId(token) {
    var decoded = verifyAccessToken(token);
    return (decoded === null || decoded === void 0 ? void 0 : decoded.id) || null;
}
/**
 * Decode token without verification (use with caution)
 * Only for reading claims before verification in specific scenarios
 */
function decodeTokenWithoutVerification(token) {
    try {
        var decoded = jsonwebtoken_1.default.decode(token);
        return decoded;
    }
    catch (_a) {
        return null;
    }
}
