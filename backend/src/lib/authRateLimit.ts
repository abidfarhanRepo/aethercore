const STRICT_AUTH_RATE_LIMIT_PATHS = new Set<string>([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/mfa/challenge',
  '/api/v1/auth/mfa/verify',
  '/api/v1/auth/verify-pin',
])

export function isStrictAuthRateLimitedPath(path: string): boolean {
  return STRICT_AUTH_RATE_LIMIT_PATHS.has(path)
}
