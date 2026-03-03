# RBAC System - Setup & Dependencies Guide

## Prerequisites

### System Requirements
- Node.js 16+ (tested with 18.x)
- PostgreSQL 12+ (database)
- npm or yarn
- Git

### Ports
- Backend: `localhost:4000` (Fastify API)
- Frontend: `localhost:5173` (Vite dev server)
- Database: `localhost:5432` (PostgreSQL default)

---

## Backend Setup

### 1. Install Dependencies

The following packages are critical for RBAC functionality:

```bash
cd backend
npm install
```

Ensure these packages are in `backend/package.json`:

```json
{
  "dependencies": {
    "@prisma/client": "^5.x.x",
    "bcryptjs": "^2.4.3",
    "fastify": "^4.x.x",
    "jsonwebtoken": "^9.x.x"
  },
  "devDependencies": {
    "@types/node": "^20.x.x",
    "@types/jsonwebtoken": "^9.x.x",
    "typescript": "^5.x.x",
    "prisma": "^5.x.x"
  }
}
```

If `bcryptjs` is missing:
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### 2. Database Setup

Create PostgreSQL database and set environment variables:

```bash
# .env file
DATABASE_URL="postgresql://user:password@localhost:5432/aethercore"
JWT_ACCESS_SECRET="your-secret-access-key-here"
JWT_REFRESH_SECRET="your-secret-refresh-key-here"
PORT=4000
NODE_ENV=development
```

### 3. Database Migration

Run Prisma migrations to set up new tables:

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# (Optional) View database
npx prisma studio
```

New tables created:
- `User` - Enhanced with RBAC fields
- `CustomRole` - Custom role definitions
- `UserRole` - Junction table for multi-roles
- `PermissionLog` - Audit logging
- `AuditLog` - Activity tracking (existing, used for user actions)

### 4. Seed Initial Admin User (Optional)

Create an initial admin user:

```bash
npx prisma db seed
```

Or manually via Prisma Studio:
```bash
npx prisma studio
```

Manual SQL:
```sql
INSERT INTO "User" (id, email, password, "firstName", "lastName", role, "isActive", "createdAt", "updatedAt")
VALUES (
  'cuid-here',
  'admin@aether.local',
  '$2a$10$...',  -- bcrypt hash of password
  'Admin',
  'User',
  'ADMIN',
  true,
  NOW(),
  NOW()
);
```

### 5. Build Backend

```bash
npm run build
```

### 6. Run Backend

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

Backend runs on `http://localhost:4000`

Test health check:
```bash
curl http://localhost:4000/health
```

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

All dependencies already included in `package.json`

### 2. Environment Configuration

Frontend uses Vite for dev proxy. Create `.env`:

```
VITE_API_BASE_URL=http://localhost:4000
VITE_APP_NAME=Aether POS
```

### 3. Run Frontend Dev Server

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

### 4. Build Frontend (Production)

```bash
npm run build
npm preview
```

---

## Full Stack Setup (Both Backends)

### Quick Start Script

```bash
#!/bin/bash

# Install backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm start &
BACKEND_PID=$!

# Install frontend
cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

echo "Backend running on PID $BACKEND_PID"
echo "Frontend running on PID $FRONTEND_PID"
echo "Backend: http://localhost:4000"
echo "Frontend: http://localhost:5173"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
```

### Using Docker (Optional)

If Docker environment available:

```bash
# From root directory
docker-compose up -d

# Runs both backend and frontend in containers
# Backend: http://localhost:4000
# Frontend: http://localhost:5173
```

---

## Verification Checklist

After setup, verify everything works:

### Backend Checks

```bash
# 1. Health check
curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"...","uptime":...}

# 2. Test auth endpoint (should fail with no credentials)
curl -X GET http://localhost:4000/api/auth/me
# Expected: {"error":"missing auth"}

# 3. Check database connection
# In backend code, all Prisma queries should work
```

### Frontend Checks

```
1. Open http://localhost:5173 in browser
2. Should see login page
3. No console errors about API connection
```

### Database Checks

```bash
# Connect to PostgreSQL
psql postgresql://user:password@localhost:5432/aethercore

# Check tables
\dt
# Should show: User, CustomRole, UserRole, PermissionLog, AuditLog, etc.

# Check User columns
\d "User"
# Should include: department, managerId, lastLogin, failedLoginAttempts, lockedAt, etc.
```

---

## Common Setup Issues

### Issue: "bcryptjs not found"

```
Error: Cannot find module 'bcryptjs'
```

**Solution:**
```bash
cd backend
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### Issue: Database Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Troubleshooting:**
1. Verify PostgreSQL is running: `psql -U postgres`
2. Check DATABASE_URL in `.env`
3. Verify credentials are correct
4. Create database if not exists: `createdb aethercore`

### Issue: Prisma Migration Error

```
error: Database server version ...
```

**Solution:**
```bash
npx prisma db push --force-reset  # WARNING: Clears database
```

### Issue: Frontend Can't Connect to Backend

```
Error: [CORS error] / Network error
```

**Solutions:**
1. Ensure backend is running: `curl http://localhost:4000/health`
2. Check CORS headers in backend (should allow localhost:5173)
3. Check VITE_API_BASE_URL in frontend .env
4. Restart both servers

### Issue: Account Locked

```
Error: account is locked
```

**Solution:**
1. Use Prisma Studio: `npx prisma studio`
2. Find user and set `lockedAt` to NULL
3. Set `failedLoginAttempts` to 0
4. Or call API: `POST /api/users/:id/unlock` as admin

---

## First Login

### Create Admin User

Option 1: Via Prisma (recommended for first setup)
```bash
npx prisma studio
# Navigate to User table
# Create new record:
# email: admin@aether.local
# password: hash with bcrypt (use online tool or npm script)
# firstName: Admin
# lastName: User
# role: ADMIN (enum value)
# isActive: true
```

Option 2: Via API
```bash
# Note: Register endpoint may allow creation before auth
POST http://localhost:4000/api/auth/register
Content-Type: application/json

{
  "email": "admin@aether.local",
  "password": "Admin@1234"
}
```

### Test Login

1. Open http://localhost:5173
2. Click "Login" (if on register page)
3. Enter credentials:
   - Email: admin@aether.local
   - Password: Admin@1234
4. Should redirect to dashboard
5. Should see role badge "ADMIN" in header

---

## Development Workflow

### Watch Mode (Backend)

```bash
cd backend
npm run dev
# Watches .ts files and restarts on change
```

### Watch Mode (Frontend)

```bash
cd frontend
npm run dev
# Vite automatically hot-reloads
```

### Debug Audit Logs

```bash
npx prisma studio
# Navigate to PermissionLog table
# Should see logs of all permission denials
```

### Debug User Lockouts

```bash
npx prisma studio
# Navigate to User table
# Check lockedAt and failedLoginAttempts fields
```

---

## Environment Variables Reference

### Backend (.env)

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aethercore"

# JWT Secrets (change in production!)
JWT_ACCESS_SECRET="change_me_in_production"
JWT_REFRESH_SECRET="change_me_in_production"

# Server
PORT=4000
NODE_ENV=development
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Frontend (.env / .env.local)

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:4000
VITE_APP_NAME="Aether POS"

# Optional: Analytics, etc.
VITE_SENTRY_DSN=""
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Change JWT secrets in .env
- [ ] Set NODE_ENV=production
- [ ] Set secure CORS origins
- [ ] Use strong passwords for seed admin
- [ ] Enable HTTPS/SSL
- [ ] Set up automated backups
- [ ] Test all endpoints with different user roles
- [ ] Review audit logs for anomalies
- [ ] Set up monitoring/alerting

### Backend Deployment

```bash
cd backend
npm run build
# Upload dist/ folder to production server
npm start
```

### Frontend Deployment

```bash
cd frontend
npm run build
# Upload dist/ folder to static hosting (S3, Netlify, Vercel, etc.)
```

---

## Maintenance

### Regular Tasks

1. **Weekly:** Review audit logs for security issues
2. **Monthly:** Expire old refresh tokens
3. **Quarterly:** Review user permissions and roles
4. **Annually:** Security audit and penetration testing

### Backup Database

```bash
# PostgreSQL backup
pg_dump aethercore > backup-$(date +%Y%m%d).sql

# Restore
psql aethercore < backup-20260303.sql
```

---

## Support & Troubleshooting

### Logs to Check

1. Backend logs: `console output` and `database logs`
2. Frontend logs: Browser console (F12)
3. Audit logs: `PermissionLog` table in database

### Useful Commands

```bash
# View users
SELECT email, role, "isActive", "lockedAt" FROM "User";

# View permission denials
SELECT "userId", action, permission, granted, timestamp FROM "PermissionLog" 
WHERE action = 'DENY' ORDER BY timestamp DESC LIMIT 10;

# View audit trail for user
SELECT action, details, "createdAt" FROM "AuditLog" 
WHERE "actorId" = 'user-id' ORDER BY "createdAt" DESC LIMIT 20;
```

---

Last Updated: March 3, 2026
