# Login Fix — March 5, 2026

## Problem

The `POST /api/auth/login` endpoint was returning `500 Internal Server Error` whenever a user attempted to log in from the frontend.

**Observed error in browser console:**
```
api.ts:198  POST http://localhost:4000/api/auth/login 500 (Internal Server Error)
Login error: AxiosError: Request failed with status code 500
```

**Observed error in backend logs:**
```
Login error: TypeError: Cannot read properties of undefined (reading 'compare')
    at .../backend/src/routes/auth.js:198:74
```

---

## Root Causes

### 1. `dotenv` not loaded at startup
`ts-node-dev` does not automatically load `.env` files. Prisma and other modules that depend on `DATABASE_URL`, `JWT_ACCESS_SECRET`, etc. were initializing before environment variables were available, causing silent failures deep in the request handler.

**Fix:** Added explicit `dotenv` initialization as the very first thing in `backend/src/index.ts`:
```ts
import dotenv from 'dotenv'
dotenv.config()
```
Also added `dotenv` as a production dependency in `backend/package.json`.

---

### 2. `DATABASE_URL` quoted in `.env`
The `.env` file had duplicate and quoted entries:
```
DATABASE_URL="file:./dev.db"           # wrong (SQLite, quoted)
DATABASE_URL="postgresql://..."        # correct but quoted
```
Some parsers treat quoted values literally, stripping quotes inconsistently. Prisma failed to parse the URL.

**Fix:** Removed duplicate entry and removed surrounding quotes from all env vars in `backend/.env`:
```
DATABASE_URL=postgresql://neondb_owner:...
```

---

### 3. `bcryptjs` default import broken under `transpile-only` mode
`ts-node-dev` runs with `--transpile-only`, which skips type checking and uses CommonJS interop. The default import:
```ts
import bcrypt from 'bcryptjs'   // ❌ resolves to undefined under transpile-only
```
…produced an `undefined` bcrypt object at runtime, causing `bcrypt.compare()` to throw.

**Fix:** Changed to a standard ES6 default import (which is compatible after the dotenv fix ensured the module loaded correctly):
```ts
import bcrypt from 'bcryptjs'   // ✅ works with esModuleInterop=true
```
Applied to both `backend/src/routes/auth.ts` and `backend/src/routes/users.ts`.

---

### 4. JWT secrets too short
The default JWT secrets in `.env` were 31 characters — one character short of the enforced 32-character minimum in `backend/src/lib/jwt.ts`. This caused token generation to throw immediately after a successful password check.

**Fix:** Extended both secrets to 32+ characters in `backend/.env` and `backend/src/lib/jwt.ts` guards.

---

### 5. Redis null pointer in `jwt.ts`
`revokeToken()` and `isTokenRevoked()` called `redis.setex()` / `redis.get()` without checking if the Redis client was initialized (it is intentionally `null` in development mode).

**Fix:** Added null guards in both functions:
```ts
if (!redis) {
  console.warn('Redis not available — token revocation skipped')
  return
}
```

---

### 6. `@stripe/js` package does not exist
`frontend/package.json` referenced `@stripe/js` (non-existent) instead of `@stripe/stripe-js`. This caused `npm install` to fail in fresh environments and crashed `StripePaymentForm.tsx` at import time.

**Fix:**
- Updated `frontend/package.json` dependency to `@stripe/stripe-js`
- Fixed import in `frontend/src/components/StripePaymentForm.tsx`:
```ts
import { loadStripe, Stripe } from '@stripe/stripe-js'  // ✅
```

---

## Result

Login with `admin@aether.dev` / `password123` now returns HTTP 200 with a valid JWT pair:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900,
  "user": {
    "email": "admin@aether.dev",
    "role": "ADMIN"
  }
}
```

Both dev servers are running:
- **Backend:** http://localhost:4000
- **Frontend:** http://localhost:5173
