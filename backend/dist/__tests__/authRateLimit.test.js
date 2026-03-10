"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const authRateLimit_1 = require("../lib/authRateLimit");
describe('isStrictAuthRateLimitedPath', () => {
    test('keeps strict limiting on brute-force-sensitive auth endpoints', () => {
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/login')).toBe(true);
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/register')).toBe(true);
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/refresh')).toBe(true);
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/mfa/challenge')).toBe(true);
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/mfa/verify')).toBe(true);
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/verify-pin')).toBe(true);
    });
    test('does not strict-limit read/status auth endpoints used by settings screens', () => {
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/mfa/status')).toBe(false);
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/mfa/recovery-codes')).toBe(false);
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/me')).toBe(false);
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/mfa/enroll')).toBe(false);
        expect((0, authRateLimit_1.isStrictAuthRateLimitedPath)('/api/v1/auth/mfa/reset')).toBe(false);
    });
});
