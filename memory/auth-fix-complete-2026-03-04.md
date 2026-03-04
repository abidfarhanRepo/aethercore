# Authentication & Product Operations Fix - March 4, 2026

## Problem
User reported 401 Unauthorized errors when:
1. Trying to delete products
2. Getting auth/me endpoint
3. Accessing any authenticated API endpoint

Also reported: Persistent login not working (session lost on page reload)

## Investigation (Subagent #1)
Found 3 critical bugs:

### Bug #1: Backend Token Verification
- **File:** `backend/src/plugins/authMiddleware.ts:111`
- **Issue:** Looking for `payload.sub` but token has `payload.id`
- **Cause:** Mismatch between token generation and verification
- **Impact:** Every authenticated request returns 401

### Bug #2: Frontend Axios Interceptors
- **File:** `frontend/src/lib/auth.ts:59`
- **Issue:** Global `axios.interceptors.request.use()` but API calls use `axios.create()`
- **Cause:** Interceptors on wrong instance
- **Impact:** Auth headers never added to requests

### Bug #3: Session Persistence
- **Result of:** Bugs #1 and #2 combined
- **Impact:** Tokens not stored, session lost on reload

## Solution

### Fix #1: Backend (1 line change)
```typescript
// backend/src/plugins/authMiddleware.ts:111
where: { id: payload.id }  // Changed from payload.sub
```

### Fix #2 & #3: Frontend (3 file changes)

**File 1:** `frontend/src/lib/auth.ts`
- Remove: `import axios from 'axios'`
- Change: `setupAxiosInterceptors()` to `setupAxiosInterceptors(apiInstance)`
- Use passed instance instead of global

**File 2:** `frontend/src/App.tsx`
- Add: `import { api }` from lib/api
- Change: `setupAxiosInterceptors()` → `setupAxiosInterceptors(api)`

## Testing (Subagent #2)
✅ All tests passed:
- Login works with valid credentials
- Tokens stored in localStorage
- Persistent login works (survives page reload)
- Product operations work without 401
- API endpoints respond correctly
- Authorization headers properly sent

## Result
✅ 401 errors FIXED  
✅ Persistent login WORKING  
✅ Product management OPERATIONAL  
✅ All authenticated endpoints accessible  

## Files Changed
- `backend/src/plugins/authMiddleware.ts` (1 line)
- `frontend/src/lib/auth.ts` (3 changes)
- `frontend/src/App.tsx` (2 changes)

## Verification
- Backend: http://localhost:4000 ✓
- Frontend: http://localhost:5173 ✓
- Tests: All passed ✓
- Servers: Both running ✓
