import { isStrictAuthRateLimitedPath } from '../lib/authRateLimit'

describe('isStrictAuthRateLimitedPath', () => {
  test('keeps strict limiting on brute-force-sensitive auth endpoints', () => {
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/login')).toBe(true)
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/register')).toBe(true)
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/refresh')).toBe(true)
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/mfa/challenge')).toBe(true)
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/mfa/verify')).toBe(true)
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/verify-pin')).toBe(true)
  })

  test('does not strict-limit read/status auth endpoints used by settings screens', () => {
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/mfa/status')).toBe(false)
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/mfa/recovery-codes')).toBe(false)
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/me')).toBe(false)
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/mfa/enroll')).toBe(false)
    expect(isStrictAuthRateLimitedPath('/api/v1/auth/mfa/reset')).toBe(false)
  })
})
