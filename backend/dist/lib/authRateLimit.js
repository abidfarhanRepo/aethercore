"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStrictAuthRateLimitedPath = isStrictAuthRateLimitedPath;
const STRICT_AUTH_RATE_LIMIT_PATHS = new Set([
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/v1/auth/mfa/challenge',
    '/api/v1/auth/mfa/verify',
    '/api/v1/auth/verify-pin',
]);
function isStrictAuthRateLimitedPath(path) {
    return STRICT_AUTH_RATE_LIMIT_PATHS.has(path);
}
