# Authentication Bugs - Quick Fix Reference

## Bug #1: JWT Payload Field Mismatch

### Current Code (BROKEN)
**File**: [backend/src/plugins/authMiddleware.ts](backend/src/plugins/authMiddleware.ts)
**Lines**: 105-125

```typescript
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization
  if (!auth) return reply.code(401).send({ error: 'missing auth' })
  const token = auth.replace(/^Bearer\s+/, '')
  try {
    const payload: any = jwt.verify(token, JWT_ACCESS_SECRET)
    // FETCH user by payload.sub - BUT TOKEN HAS payload.id!
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },  // ❌ WRONG - should be payload.id
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

### Why It Fails
Token payload structure (from auth.ts login):
```typescript
generateTokenPair({
  id: user.id,      // ← This field
  email: user.email,
  role: user.role,
})
```

Results in JWT with: `{ id: "...", email: "...", role: "...", type: "access", iat: ..., exp: ... }`

But middleware looks for: `payload.sub` which is **undefined**

### Fix
**Change line 111**:
```typescript
// BEFORE:
where: { id: payload.sub },

// AFTER:
where: { id: payload.id },
```

---

## Bug #2: Axios Interceptors on Wrong Instance

### Problem Overview
```
frontend/src/lib/api.ts creates:
  const api = axios.create({...})
  
frontend/src/lib/auth.ts sets up:
  axios.interceptors.request.use(...)  ← Global instance
  axios.interceptors.response.use(...) ← Global instance

But all API calls use:
  api.post() / api.get() / etc.  ← Separate instance!
  
Result: Interceptors never run on API calls
```

### Current Code (BROKEN)

**File**: [frontend/src/lib/api.ts](frontend/src/lib/api.ts)
**Lines**: 1-14

```typescript
import axios from 'axios'
import { networkMonitor } from './offline/network'
import { syncEngine } from './offline/offline/sync'
import { offlineDB } from './offline/db'

// Use relative path in dev to leverage Vite proxy
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL as string || 'http://localhost:4000')

export const api = axios.create({  // ← SEPARATE INSTANCE
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})
```

**File**: [frontend/src/lib/auth.ts](frontend/src/lib/auth.ts)
**Lines**: 57-89

```typescript
export function setupAxiosInterceptors() {
  axios.interceptors.request.use((config) => {  // ❌ GLOBAL axios
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
          const response = await axios.post('/api/auth/refresh', { refreshToken })  // ❌ GLOBAL
          const { accessToken, refreshToken: newRefreshToken } = response.data
          useAuthStore.getState().setTokens(accessToken, newRefreshToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return axios(originalRequest)  // ❌ GLOBAL
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

### How API Calls Are Made (BROKEN)

**File**: [frontend/src/lib/api.ts](frontend/src/lib/api.ts)
**Lines**: 230-250

```typescript
// All these use the 'api' instance (no interceptors!)
export const authAPI = {
  register: (email: string, password: string) =>
    api.post('/api/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  refresh: (refreshToken: string) =>
    api.post('/api/auth/refresh', { refreshToken }),
  revoke: (refreshToken: string) =>
    api.post('/api/auth/revoke', { refreshToken }),
  getMe: () => api.get('/api/auth/me'),  // ← Gets 401 (no auth header)
}

export const productsAPI = {
  list: () => api.get('/api/products'),
  get: (id: string) => api.get(`/api/products/${id}`),
  create: (data: any) => api.post('/api/products', data),
  update: (id: string, data: any) => api.put(`/api/products/${id}`, data),
  delete: (id: string) => api.delete(`/api/products/${id}`),  // ← DELETE 401 (no auth header)
  // ...
}
```

### Fix

**In frontend/src/lib/auth.ts**, change the interceptor setup:

```typescript
// IMPORT the api instance
import { api } from './api'

// APPLY interceptors to the api instance, NOT global axios
export function setupAxiosInterceptors() {
  api.interceptors.request.use((config) => {  // ← Changed: api instead of axios
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  api.interceptors.response.use(  // ← Changed: api instead of axios
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      const { refreshToken } = useAuthStore.getState()

      if (error.response?.status === 401 && refreshToken && !originalRequest._retry) {
        originalRequest._retry = true
        try {
          const response = await api.post('/api/auth/refresh', { refreshToken })  // ← api instead of axios
          const { accessToken, refreshToken: newRefreshToken } = response.data
          useAuthStore.getState().setTokens(accessToken, newRefreshToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)  // ← api instead of axios
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

---

## Bug #3: Session Not Restored on Page Reload

### Current Code (PARTIALLY BROKEN)

**File**: [frontend/src/App.tsx](frontend/src/App.tsx)
**Lines**: 43-65

```tsx
function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const [isLoading, setIsLoading] = React.useState(true)

  useEffect(() => {
    setupAxiosInterceptors()  // Line 45 - This won't work properly until Bug #2 is fixed
    
    // Line 48: Check if user is already logged in
    if (useAuthStore.getState().accessToken) {
      authAPI
        .getMe()  // ← Line 50: This will fail with 401 due to Bug #2
        .then((res) => {
          useAuthStore.getState().setUser(res.data)  // Never reaches here
        })
        .catch(() => {  // Always catches due to Bug #2
          logout()  // User gets logged out!
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [])  // Empty dependency array means runs once on mount
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!user) {
    return children  // Shows login page
  }
  
  // ... rest of layout ...
}
```

### Why It's Broken

1. ✓ Line 48: `useAuthStore.getState().accessToken` correctly reads from localStorage
2. ✓ Line 50: Calls `authAPI.getMe()`
3. ✗ Due to **Bug #2**: No Authorization header is added
4. ✗ Backend returns 401
5. ✗ Catch block (line 55) calls `logout()` which clears the token
6. ✗ User forced back to login screen

### How It'll Work After Fixes

1. User logs in with credentials
2. tokens + user stored in state + localStorage
3. Page reload → app mounts
4. useAuthStore loads accessToken from localStorage
5. App calls getMe() with proper Authorization header (after Bug #2 fix)
6. Backend returns user info (after Bug #1 fix)
7. User remains logged in ✓
8. Session persists across reloads ✓

---

## Files Needing Changes

| File | Lines | Change | Priority |
|------|-------|--------|----------|
| backend/src/plugins/authMiddleware.ts | 111 | Change `payload.sub` to `payload.id` | CRITICAL |
| frontend/src/lib/auth.ts | 57-89 | Apply interceptors to `api` instance, not global axios | CRITICAL |
| frontend/src/lib/api.ts | (import section) | Add import for api instance in auth.ts | CRITICAL |

---

## Testing After Fixes

### Test 1: Login Flow
```bash
# 1. Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aether.dev","password":"password123"}'
# Should return: { accessToken, refreshToken, user }

# 2. Get auth info
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer <token>"
# Should return: { id, email, role, ... }
```

### Test 2: Frontend Login
1. Open http://localhost:5173
2. Login with admin@aether.dev / password123
3. Should redirect to /checkout
4. Refresh page
5. Should remain logged in (not redirect to login)

### Test 3: Delete Product
1. Login as ADMIN or MANAGER
2. Navigate to Products
3. Delete a product
4. Should succeed with 200 OK (not 401)

---

## Expected Impact After Fixes

| Feature | Before | After |
|---------|--------|-------|
| Valid credentials login | ✗ 401 | ✓ Works |
| GET /api/auth/me | ✗ 401 | ✓ Works |
| DELETE /api/products/:id | ✗ 401 | ✓ Works |
| Session persistence on reload | ✗ Logout | ✓ Stays logged in |
| Token refresh after 15 min | ✗ Manual re-login | ✓ Auto-refresh |

---

## Implementation Steps

1. Fix backend JWT field (2 min)
   - Edit authMiddleware.ts line 111
   - Test with curl

2. Fix axios interceptors (10 min)
   - Edit auth.ts setupAxiosInterceptors()
   - Apply to api instance
   - Test with curl

3. Test frontend login (5 min)
   - Clear localStorage
   - Login in UI
   - Verify session persists on reload

4. Test protected endpoints (5 min)
   - Verify DELETE /api/products works
   - Verify other endpoints protected

**Total time: ~20-25 minutes**
