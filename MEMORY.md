# MEMORY — persistent assistant memory (aether project)

- Project name: aether
- Created: 2026-03-02
- Stack: React + TypeScript, Fastify, Prisma, PostgreSQL (Neon), Redis placeholder
- Current DB: Neon Postgres provided by user (connection stored in workspace/.env)
- Initial admin: admin@aether.dev (seeded)

## Authentication System Issues (2026-03-04)

**CRITICAL BUGS FOUND** preventing user login and session persistence:

1. **JWT Payload Mismatch** (backend/src/plugins/authMiddleware.ts#111)
   - Tokens generated with `payload.id` but middleware looks for `payload.sub`
   - Result: Every /api/auth/me request fails with 401
   - Fix: Change `payload.sub` to `payload.id`

2. **Axios Interceptor Applied to Wrong Instance** (frontend/src/lib/auth.ts#59 + api.ts#9)
   - Interceptors set on global axios but API calls use separate axios.create() instance
   - Result: Authorization header never added to requests
   - Fix: Apply interceptors to the `api` instance instead of global

3. **Session Persistence Broken**
   - No proper token validation on page reload
   - No token refresh mechanism for 15-min expiry
   - Combined with bugs #1 and #2, login doesn't persist across page reload

Full investigation: AUTHENTICATION_INVESTIGATION_REPORT.md
Daily log: memory/auth-investigation-2026-03-04.md

Notes:
- The assistant will append to memory/tasks_log.md for agent events.
- autonomous.md contains agent conventions and should be consulted by spawned agents.
