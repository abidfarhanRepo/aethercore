# Authentication Investigation Log - March 4, 2026

## Investigation Summary

Deep investigation into 401 Unauthorized errors and missing session persistence in aethercore authentication system.

## Key Findings

### Bug #1: JWT Payload Mismatch (CRITICAL)

**Problem**: Backend generates JWT tokens with payload field `id`, but authentication middleware looks for field `sub`.

**Location**: 
- Generation: [backend/src/routes/auth.ts#176-182](backend/src/routes/auth.ts#L176-L182)
- Verification: [backend/src/plugins/authMiddleware.ts#111](backend/src/plugins/authMiddleware.ts#L111)

**Impact**: Every authenticated request fails with 401 because:
```
payload = { id: "user-123", email: "...", role: "..." }
middleware searches: payload.sub  ← UNDEFINED!
prisma lookup: findUnique({ where: { id: undefined } })
Result: 401 "user not found or inactive"
```

**Fix**: Change line 111 in authMiddleware.ts from `payload.sub` to `payload.id`

### Bug #2: Axios Interceptor on Wrong Instance (CRITICAL)

**Problem**: Interceptors configured on global axios instance, but all API calls use separate `api` instance created with `axios.create()`.

**Location**:
- Interceptors setup: [frontend/src/lib/auth.ts#59](frontend/src/lib/auth.ts#L59)
- API instance: [frontend/src/lib/api.ts#9](frontend/src/lib/api.ts#L9)
- API calls: [frontend/src/lib/api.ts#230-240](frontend/src/lib/api.ts#L230-L240)

**Impact**: Authorization header never added to requests because:
```
axios.interceptors.request.use(...) ← Sets on GLOBAL instance
authAPI.getMe() → Uses 'api' instance (separate!)
No inheritance = No Authorization header
```

**Fix**: Apply interceptors to `api` instance instead of global axios:
```typescript
export const api = axios.create({...})
export function setupAxiosInterceptors() {
  api.interceptors.request.use((config) => { ... })
  api.interceptors.response.use((response) => { ... })
}
```

### Bug #3: No Token Validation on App Reload

**Problem**: When user reloads page, stored token is not properly validated/refreshed.

**Location**: [frontend/src/App.tsx#48-61](frontend/src/App.tsx#L48-L61)

**Issue Chain**:
1. localStorage has valid accessToken from previous session
2. App mounts → attempts authAPI.getMe() to validate token
3. **However, auth header not being sent (Bug #2)**
4. 401 response
5. User logged out
6. Redirected to login screen

**Fix**: Once Bug #2 fixed, this should work. But also need:
- Better error handling to distinguish "invalid token" from "network error"
- Token refresh mechanism for expired tokens (15 min expiry)

### Bug #4: Missing Token Refresh on 401

**Problem**: When access token expires (15 minutes), there's no mechanism to automatically refresh.

**Location**: [frontend/src/lib/auth.ts#67-89](frontend/src/lib/auth.ts#L67-L89)

**Current Issue**: Response interceptor is on global axios, not on api instance.

**Needed**: When 401 received:
1. Check if refreshToken available
2. Call `/api/auth/refresh` with refreshToken
3. Get new accessToken
4. Retry original request with new token

## Detailed Code Analysis

### How Login Currently Works

1. User submits email/password
2. `Login.tsx` calls `authAPI.login()` → `POST /api/auth/login`
3. Backend response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900,
  "user": { "id": "...", "email": "...", "role": "..." }
}
```
4. Frontend stores tokens in localStorage
5. Redirects to `/checkout`

### Why Auth Fails After Login

1. Page load calls `authAPI.getMe()` in App.tsx
2. `api.get('/api/auth/me')` is called
3. Interceptor NOT applied (global instance issue)
4. No Authorization header sent
5. Backend returns 401: "Authorization header missing"
6. Frontend sees 401 → calls `logout()`
7. User back at login screen

### Token Structure

**Generated With**: `generateTokenPair({ id, email, role })`

**Payload Structure**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "ADMIN",
  "type": "access",
  "iat": 1709577600,
  "exp": 1709578500
}
```

**Verified At**: Backend looks for `payload.sub` (which doesn't exist!)

## Testing the Bugs

### Test Case 1: Login Then Get Me

```bash
# 1. Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aether.dev","password":"password123"}'

# Returns: { accessToken: "...", refreshToken: "...", user: {...} }

# 2. Try to get auth info (THIS WILL FAIL with 401)
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"

# FAILS because middleware looks for payload.sub but has payload.id
```

### Test Case 2: Frontend Login Attempt

1. Open http://localhost:5173
2. Login with admin@aether.dev / password123
3. **RESULT**: 401 error, redirected back to login
4. **REASON**: Both bugs prevent it from working

## Stored Data

### localStorage Keys After Login

```javascript
localStorage['accessToken'] = "eyJ..."  // JWT with { id, email, role }
localStorage['refreshToken'] = "eyJ..."
```

### Auth Store State

```typescript
{
  user: { id, email, role, firstName, lastName },
  accessToken: "eyJ...",
  refreshToken: "eyJ...",
  isLoading: false,
  error: null
}
```

## Required Fixes (In Order)

1. **Fix JWT payload field** (5 min)
   - authMiddleware.ts line 111: `payload.sub` → `payload.id`

2. **Fix axios interceptors** (10 min)
   - Move from global axios to api instance
   - Apply to both request and response

3. **Add token refresh logic** (15 min)
   - Response interceptor to handle 401 + refresh

4. **Improve session init** (10 min)
   - Better error handling
   - Don't auto-logout on validation failure

## Files to Modify

- backend/src/plugins/authMiddleware.ts
- frontend/src/lib/auth.ts
- frontend/src/lib/api.ts
- frontend/src/App.tsx (minor)

## Time to Resolution

All bugs should be fixable in ~30-40 minutes total.
