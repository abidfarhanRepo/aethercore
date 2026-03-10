"use strict";
/**
 * JWT security utilities with token rotation and revocation support
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
// Allow Redis to be disabled for development
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
let redis = null;
// Only initialize Redis if not disabled and not in development
if (!REDIS_DISABLED && process.env.NODE_ENV !== 'development') {
    redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
    redis.on('error', (err) => {
        logger_1.logger.warn({ err }, 'Redis client error');
        // Gracefully degrade if Redis fails
    });
}
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'default_access_secret_change_me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_change_me';
const JWT_ACCESS_EXPIRES_IN = '8h'; // Max lifetime for interactive sessions
const JWT_REFRESH_EXPIRES_IN = '7d';
/**
 * Validates JWT secret length (minimum 32 characters)
 */
function validateSecretLength(secret, name) {
    if (secret.length < 32) {
        throw new Error(`${name} must be at least 32 characters. Set in environment variables.`);
    }
}
/**
 * Generate access token (short-lived)
 */
function generateAccessToken(payload) {
    validateSecretLength(JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
    return jsonwebtoken_1.default.sign({
        ...payload,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
    }, JWT_ACCESS_SECRET, {
        expiresIn: JWT_ACCESS_EXPIRES_IN,
        algorithm: 'HS256',
    });
}
/**
 * Generate refresh token (long-lived, rotatable)
 */
function generateRefreshToken(payload) {
    validateSecretLength(JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
    return jsonwebtoken_1.default.sign({
        ...payload,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
    }, JWT_REFRESH_SECRET, {
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
        const decoded = jsonwebtoken_1.default.verify(token, JWT_ACCESS_SECRET, {
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
        const decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET, {
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
async function revokeToken(token, expiresIn = 900) {
    try {
        if (!redis) {
            logger_1.logger.warn('Redis not available - token revocation skipped');
            return;
        }
        const jti = `revoked:${token}`;
        await redis.setex(jti, expiresIn, '1');
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to revoke token');
        // Don't throw - token revocation failure shouldn't break auth
    }
}
/**
 * Check if token has been revoked
 */
async function isTokenRevoked(token) {
    try {
        if (!redis) {
            return false; // Redis unavailable, assume token not revoked
        }
        const jti = `revoked:${token}`;
        const revoked = await redis.get(jti);
        return revoked !== null;
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to check token revocation');
        return false;
    }
}
/**
 * Generate token pair (access + refresh)
 */
function generateTokenPair(payload) {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
        expiresIn: 8 * 60 * 60, // 8 hours in seconds
    };
}
/**
 * Rotate refresh token
 * Issues a new access+refresh token pair, revokes the old refresh token
 */
async function rotateRefreshToken(oldRefreshToken) {
    const decoded = verifyRefreshToken(oldRefreshToken);
    if (!decoded) {
        return null;
    }
    // Check if token was revoked
    if (await isTokenRevoked(oldRefreshToken)) {
        return null;
    }
    // Revoke old token
    await revokeToken(oldRefreshToken);
    // Generate new token pair
    const { id, email, role } = decoded;
    return generateTokenPair({ id, email, role });
}
/**
 * Validate JWT claims
 */
function validateTokenClaims(decoded, requiredClaims = ['id', 'email', 'role']) {
    for (const claim of requiredClaims) {
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
    const decoded = verifyAccessToken(token);
    return decoded?.id || null;
}
/**
 * Decode token without verification (use with caution)
 * Only for reading claims before verification in specific scenarios
 */
function decodeTokenWithoutVerification(token) {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        return decoded;
    }
    catch {
        return null;
    }
}
