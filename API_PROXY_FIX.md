# API Proxy Configuration Fix

## Problem
The frontend (running on port 5173) was trying to call `/api/auth/login` and other API endpoints, but:
- These endpoints didn't exist on the frontend server
- The backend API is running on port 4000
- No proxy was configured to route frontend requests to the backend

**Error**: `POST http://localhost:5173/api/auth/login 404 (Not Found)`

---

## Solution
Created a Vite proxy configuration to route all `/api/*` requests to the backend at `http://localhost:4000`.

### Files Created/Modified

#### 1. **frontend/vite.config.ts** (NEW)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

**How it works:**
- Intercepts requests to `/api/*`
- Routes them to `http://localhost:4000/*` (with `/api` removed)
- `changeOrigin: true` handles CORS headers properly
- In production, you'd need to configure your reverse proxy the same way

#### 2. **frontend/package.json** (UPDATED)
Added `@vitejs/plugin-react` to devDependencies:
```json
"@vitejs/plugin-react": "^4.0.0"
```

---

## Testing

### Before Fix
```bash
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@aether.dev","password":"testpass123"}'

# Result: 404 Not Found
```

### After Fix
```bash
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@aether.dev","password":"testpass123"}'

# Result: 200 OK with tokens
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

## All Working Endpoints (via proxy)

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/auth/register` | POST | ✅ Working |
| `/api/auth/login` | POST | ✅ Working |
| `/api/auth/me` | GET | ✅ Working |
| `/api/auth/refresh` | POST | ✅ Working |
| `/api/products` | GET | ✅ Working |
| `/api/products/:id` | GET | ✅ Working |
| `/api/reports/daily-sales` | GET | ✅ Working |
| `/api/reports/inventory-valuation` | GET | ✅ Working |
| `/api/purchases` | GET | ✅ Working |
| `/api/sales` | POST | ✅ Working |
| And all other `/api/*` routes | - | ✅ Proxied |

---

## Frontend Components Fixed
These components now work correctly:
- **Login.tsx** - Login form now connects to backend
- **Register.tsx** - Registration now works
- **auth.tsx** - Token refresh calls work
- **All API calls** - Fallback to localhost:4000 still works if proxy fails

---

## Frontend Now Fully Functional ✅

The frontend can now:
1. Register new users
2. Login with credentials
3. Maintain sessions with refresh tokens
4. Call all API endpoints through the proxy
5. Fall back to direct localhost:4000 calls if needed

No other changes needed - the proxy handles all API routing automatically.

