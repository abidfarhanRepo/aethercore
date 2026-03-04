# Authentication Investigation Report - March 4, 2026

## Executive Summary

Investigation into 401 Unauthorized errors and session persistence issues revealed **TWO CRITICAL BUGS** in the authentication system:

1. **JWT Token Payload Mismatch**: Backend looks for `payload.sub` but tokens are generated with `payload.id`
2. **Axios Interceptor Misconfiguration**: Interceptors attached to global axios instance but API calls use separate instance
3. **Session Persistence Gap**: No initialization of authentication on page reload

These bugs prevent the frontend from maintaining authenticated requests and persisting login across sessions.

---

## Part 1: Login Flow Analysis

### 1.1 Frontend Login Process

**File**: [frontend/src/components/Login.tsx](frontend/src/components/Login.tsx)

```tsx
// Lines 14-30: Login submission
async function submit(e:React.FormEvent){
  e.preventDefault()
  setError(null)
  setIsLoading(true)
  try{
    const res = await authAPI.login(email, password)
    const { accessToken, refreshToken, user } = res.data
    setTokens(accessToken, refreshToken)  // Stores in localStorage
    setUser(user)
    navigate('/checkout')
  }catch(e:any){
    const message = e?.response?.data?.error || e?.message || 'An unexpected error occurred'
    setError(message)
  }finally{
    setIsLoading(false)
  }
}
```

**Flow**:
1. User submits email/password
2. Calls `authAPI.login(email, password)` which is `POST /api/auth/login`
3. Receives `{ accessToken, refreshToken, user }`
4. **Stores tokens using `setTokens()` to localStorage**
5. Stores user object
6. Redirects to `/checkout`

### 1.2 Backend Login Endpoint

**File**: [backend/src/routes/auth.ts](backend/src/routes/auth.ts)

```typescript
// Lines 98-187: POST /auth/login endpoint
fastify.post('/auth/login', { schema: loginSchema }, async (req, reply) => {
  try {
    // ... validation and authentication ...
    
    // Generate secure token pair (Lines 176-182)
    const { accessToken, refreshToken } = generateTokenPair({
      id: user.id,        // <-- USES 'id' FIELD
      email: user.email,
      role: user.role,
    })
    
    // Log successful login
    await logAuthEvent('LOGIN', user.id, req, 'User logged in successfully')
    
    // Return response (Lines 210-221)
    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      }
    }
  }
  ...
})
```

**Token Response Structure**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "user-uuid",
    "email": "admin@aether.dev",
    "role": "ADMIN",
    "firstName": "Admin",
    "lastName": "User"
  }
}
```

### 1.3 Token Storage (Persistence)

**File**: [frontend/src/lib/auth.ts](frontend/src/lib/auth.ts)

```typescript
// Lines 28-48: Zustand Auth Store
export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  accessToken: localStorage.getItem('accessToken'),  // <-- LOADS ON INIT
  refreshToken: localStorage.getItem('refreshToken'), // <-- LOADS ON INIT

  setTokens: (access, refresh) => {
    localStorage.setItem('accessToken', access)      // <-- SAVES TO STORAGE
    localStorage.setItem('refreshToken', refresh)
    set({ accessToken: access, refreshToken: refresh })
  },
  
  logout: () => {
    localStorage.removeItem('accessToken')           // <-- CLEARS ON LOGOUT
    localStorage.removeItem('refreshToken')
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    })
  },
}))
```

**Storage Keys**:
- `localStorage['accessToken']`: JWT access token (15 min expiry)
- `localStorage['refreshToken']`: JWT refresh token (7 day expiry)

---

## Part 2: Critical Bug #1 - JWT Payload Mismatch

### Issue Description

The JWT token is created with `id` field but the authentication middleware looks for `sub` field.

### Backend Token Generation

**File**: [backend/src/lib/jwt.ts](backend/src/lib/jwt.ts) (Lines 145-164)

```typescript
export function generateTokenPair(payload: Record<string, any>): {
  accessToken: string
  refreshToken: string
  expiresIn: number
} {
  return {
    accessToken: generateAccessToken(payload),  // payload = { id, email, role }
    refreshToken: generateRefreshToken(payload),
    expiresIn: 15 * 60,
  }
}

// Lines 36-48: generateAccessToken
export function generateAccessToken(payload: Record<string, any>): string {
  return jwt.sign(
    {
      ...payload,  // SPREADS { id, email, role }
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_ACCESS_SECRET,
    {
      expiresIn: JWT_ACCESS_EXPIRES_IN,
      algorithm: 'HS256',
    }
  )
}
```

**Resulting JWT Payload**:
```json
{
  "id": "user-123",
  "email": "admin@aether.dev",
  "role": "ADMIN",
  "type": "access",
  "iat": 1709577600,
  "exp": 1709578500
}
```

### Backend Token Verification

**File**: [backend/src/plugins/authMiddleware.ts](backend/src/plugins/authMiddleware.ts) (Lines 105-125)

```typescript
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization
  if (!auth) return reply.code(401).send({ error: 'missing auth' })
  
  const token = auth.replace(/^Bearer\s+/, '')
  try {
    const payload: any = jwt.verify(token, JWT_ACCESS_SECRET)
    
    // LOOKS FOR payload.sub - BUT TOKEN HAS payload.id!
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },  // <-- BUG: Should be payload.id
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'user not found or inactive' })
    }

    ;(req as any).user = user
  } catch (e) {
    return reply.code(401).send({ error: 'invalid token' })
  }
}
```

### Impact Chain

```
1. Login successful → tokens generated with { id, ..., email, role }
2. Frontend stores accessToken in localStorage
3. Frontend makes request with: Authorization: Bearer <token>
4. Backend receives request with Bearer token
5. Backend calls requireAuth middleware
6. Middleware tries to find user by: prisma.user.findUnique({ where: { id: payload.sub } })
7. payload.sub is UNDEFINED (token has payload.id instead)
8. Database lookup fails → returns 401 "user not found or inactive"
9. Request fails with 401 Unauthorized ❌
```

---

## Part 3: Critical Bug #2 - Axios Interceptor Misconfiguration

### Issue Description

Request interceptors are attached to the global axios instance, but API calls use a separate instance that doesn't have these interceptors.

### Axios Instance Configuration

**File**: [frontend/src/lib/api.ts](frontend/src/lib/api.ts)

```typescript
// Lines 1-14: CREATE SEPARATE AXIOS INSTANCE
import axios from 'axios'

const API_BASE_URL = import.meta.env.DEV 
  ? '' 
  : (import.meta.env.VITE_API_BASE_URL as string || 'http://localhost:4000')

export const api = axios.create({  // <-- SEPARATE INSTANCE
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})
```

### Interceptor Setup

**File**: [frontend/src/lib/auth.ts](frontend/src/lib/auth.ts)

```typescript
// Lines 57-89: INTERCEPTORS ON GLOBAL INSTANCE
export function setupAxiosInterceptors() {
  axios.interceptors.request.use((config) => {  // <-- GLOBAL AXIOS
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      const { refreshToken } = useAuthStore.getState()

      if (error.response?.status === 401 && refreshToken && !originalRequest._retry) {
        originalRequest._retry = true
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken })  // <-- USES GLOBAL
          const { accessToken, refreshToken: newRefreshToken } = response.data
          useAuthStore.getState().setTokens(accessToken, newRefreshToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return axios(originalRequest)  // <-- USES GLOBAL
        } catch {
          useAuthStore.getState().logout()
          window.location.href = '/login'
        }
      }
      return Promise.reject(error)
    }
  )
}
```

### API Calls Using the api Instance

**File**: [frontend/src/lib/api.ts](frontend/src/lib/api.ts) (Lines 230-240)

```typescript
// Auth API using the separate instance
export const authAPI = {
  register: (email: string, password: string) =>
    api.post('/api/auth/register', { email, password }),  // <-- USES api INSTANCE
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),      // <-- USES api INSTANCE
  refresh: (refreshToken: string) =>
    api.post('/api/auth/refresh', { refreshToken }),       // <-- USES api INSTANCE
  revoke: (refreshToken: string) =>
    api.post('/api/auth/revoke', { refreshToken }),
  getMe: () => api.get('/api/auth/me'),                    // <-- USES api INSTANCE
}

// Products API also uses the separate instance
export const productsAPI = {
  list: () => api.get('/api/products'),    // <-- USES api INSTANCE - NO AUTH HEADERS!
  get: (id: string) => api.get(`/api/products/${id}`),
  create: (data: any) => api.post('/api/products', data),
  update: (id: string, data: any) => api.put(`/api/products/${id}`, data),
  delete: (id: string) => api.delete(`/api/products/${id}`), // <-- DELETE WITH NO AUTH!
  // ...
}
```

### Impact Chain

```
1. User logs in
2. setupAxiosInterceptors() runs → attaches to GLOBAL axios
3. Frontend calls authAPI.getMe() → uses api INSTANCE (not global!)
4. api instance does NOT have the Authorization header interceptor
5. Request sent WITHOUT Authorization header:
   GET /api/auth/me
   (no Authorization header)
6. Backend receives request without auth header
7. requireAuth middleware returns 401 "missing auth" ❌
8. DELETE /api/products/:id also sent without auth ❌
```

### Proof of Issue

When `setupAxiosInterceptors()` is called, it does:
```javascript
axios.interceptors.request.use(...)  // Sets on DEFAULT instance
```

But `authAPI.getMe()` does:
```javascript
api.get('/api/auth/me')  // Uses SEPARATE instance created with axios.create()
```

The `api` instance is a completely separate object that does NOT inherit global interceptors.

---

## Part 4: App Initialization & Session Persistence

### Initial App Load

**File**: [frontend/src/App.tsx](frontend/src/App.tsx) (Lines 43-65)

```tsx
function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const [isLoading, setIsLoading] = React.useState(true)

  useEffect(() => {
    setupAxiosInterceptors()  // Line 45: Sets up interceptors (GLOBAL ONLY)
    
    // Line 48-61: Check if user is already logged in
    if (useAuthStore.getState().accessToken) {
      authAPI
        .getMe()                    // Line 50: Calls api.getMe() - NO AUTH HEADERS!
        .then((res) => {
          useAuthStore.getState().setUser(res.data)
        })
        .catch(() => {              // Line 55: ERROR - 401 response
          logout()                  // Line 56: Clears auth state
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [])  // Empty dependency array - runs once on mount
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!user) {
    return children  // Shows login page
  }
  
  // ... rest of layout ...
}
```

### Session Persistence Walkthrough

**Case 1: User Logs In**
1. User enters credentials → `Login.tsx` → `authAPI.login()`
2. Success → tokens stored in localStorage
3. Page redirects to `/checkout`
4. App mounts → `useAuthStore.getState().accessToken` is loaded from localStorage
5. **BUT** `setupAxiosInterceptors()` has GLOBAL interceptors, while API calls use `api` instance
6. `authAPI.getMe()` fails with 401
7. User is logged out
8. Redirected back to login page ❌

**Case 2: User Reloads Page**
1. App mounts
2. Calls `useAuthStore.getState().accessToken` → reads from localStorage
3. Token exists → tries `authAPI.getMe()` to validate
4. No Authorization header added (interceptor on wrong instance)
5. 401 response
6. User logged out
7. Back to login screen ❌

---

## Part 5: The 401 Errors Explained

### Error 1: `/api/auth/me` Returns 401

**Request**:
```http
GET /api/auth/me
(no Authorization header)
```

**Why**: Interceptors on global axios, but api instance used

**Backend Response** ([auth.ts line 309-314](backend/src/routes/auth.ts#L309-L314)):
```typescript
fastify.get('/auth/me', async (req, reply) => {
  try {
    const auth = req.headers.authorization
    if (!auth) {
      return reply.status(401).send({ error: 'Authorization header missing' })  // <-- 401
    }
    // ...
  }
})
```

### Error 2: `DELETE /api/products/:id` Returns 401

**Request**:
```http
DELETE /api/products/:id
(no Authorization header)
```

**Why**: Same issue - no interceptor on api instance

**Backend Middleware** ([products.ts line 51](backend/src/routes/products.ts#L51)):
```typescript
fastify.delete('/products/:id', {
  preHandler: [
    require('./../plugins/authMiddleware').requireAuth,  // <-- Checks for Authorization header
    require('./../plugins/authMiddleware').requireRole('MANAGER')
  ],
  // ...
})
```

The `requireAuth` middleware looks for `Authorization` header but it's not being sent because the interceptor is on the wrong instance.

---

## Part 6: Session Persistence Issues

### What's Missing

Currently, there is **NO mechanism to:**
1. ✓ Store tokens in localStorage (this works)
2. ✗ **Validate stored tokens when app loads**
3. ✗ **Automatically refresh expired tokens**
4. ✗ **Remember user across page reloads**

### Current Gaps

1. **No Token Validation on Load**: 
   - Attempts to validate with `getMe()` but fails due to missing header
   - Should validate silently in background

2. **No Token Refresh Strategy**:
   - No mechanism to refresh access token before it expires (15 min)
   - No auto-refresh on 401 (interceptor misconfigured)

3. **No Graceful Degradation**:
   - If `getMe()` fails, just logs user out
   - Should distinguish between "token invalid" vs "network error"

---

## Summary of Bugs

| Bug | Severity | Location | Impact |
|-----|----------|----------|--------|
| JWT payload uses `id` but middleware looks for `sub` | CRITICAL | [backend/src/plugins/authMiddleware.ts#L111](backend/src/plugins/authMiddleware.ts#L111) | All authenticated requests fail with 401 |
| Axios interceptors on global instance but API uses separate instance | CRITICAL | [frontend/src/lib/auth.ts#59](frontend/src/lib/auth.ts#59) + [frontend/src/lib/api.ts#9](frontend/src/lib/api.ts#9) | Authorization header never sent, 401 on every request |
| No token validation on app initialization | MAJOR | [frontend/src/App.tsx#48-61](frontend/src/App.tsx#48-61) | Session not restored on page reload |
| No interceptor for token refresh | MAJOR | [frontend/src/lib/auth.ts#67](frontend/src/lib/auth.ts#67) | Access tokens expire after 15 min with no refresh |

---

## Files Involved

### Frontend
- [frontend/src/components/Login.tsx](frontend/src/components/Login.tsx) - Login form (lines 14-30)
- [frontend/src/lib/auth.ts](frontend/src/lib/auth.ts) - Auth store & interceptors (lines 28-89)
- [frontend/src/lib/api.ts](frontend/src/lib/api.ts) - Axios instance (lines 1-14, 230-240)
- [frontend/src/App.tsx](frontend/src/App.tsx) - App initialization (lines 43-65)

### Backend
- [backend/src/routes/auth.ts](backend/src/routes/auth.ts) - Login endpoint (lines 98-187, 309-314)
- [backend/src/lib/jwt.ts](backend/src/lib/jwt.ts) - Token generation (lines 145-164)
- [backend/src/plugins/authMiddleware.ts](backend/src/plugins/authMiddleware.ts) - Auth middleware (lines 105-125)
- [backend/src/routes/products.ts](backend/src/routes/products.ts) - Protected endpoint (line 51)

---

## Next Steps

These bugs must be fixed to restore authentication:

1. **Fix JWT payload mismatch** - Change `payload.sub` to `payload.id` in authMiddleware
2. **Fix axios interceptors** - Apply to `api` instance instead of global
3. **Fix session restoration** - Handle token validation properly on app load
4. **Add token refresh logic** - Auto-refresh before expiry

See AUTHENTICATION_FIXES.md for detailed fix instructions.
