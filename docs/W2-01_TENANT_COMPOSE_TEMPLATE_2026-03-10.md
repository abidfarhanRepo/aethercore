# W2-01 Tenant Compose Template - 2026-03-10

## Summary
Implemented a per-tenant deployment template under `deploy/template/` with:
- A tenant-scoped Docker Compose stack (`backend`, `frontend`, `postgres`, `redis`) using org-specific names.
- Traefik labels for host-based routing and `/api` path routing.
- A provisioning-oriented `.env.template` for org identity, runtime settings, secrets, and service URLs.
- An Nginx config template for SPA routing and backend API proxying.

Also updated related runtime/build configuration to make the template validation succeed on current images and startup behavior.

## Files Changed
- `AETHER_AGENT_EXECUTION_PLAN.md`
- `deploy/template/docker-compose.yml`
- `deploy/template/.env.template`
- `deploy/template/nginx.conf`
- `backend/Dockerfile`
- `backend/prisma/schema.prisma`
- `frontend/postcss.config.js`
- `frontend/public/.gitkeep`

## Runtime Validation Performed
- Built updated backend and frontend container images used by the tenant compose template.
- Brought up the tenant template stack with Docker Compose using `deploy/template/docker-compose.yml` and a generated `.env`.
- Ran HTTP probes for runtime health/accessibility checks, including:
  - `http://localhost:5173`
  - `http://localhost:5173/health`
  - `http://localhost:4000/health`
  - `http://localhost:3000/health`
  - `http://localhost:4173`
- Performed compose cleanup with:
  - `docker compose -f deploy/template/docker-compose.yml --env-file deploy/template/.env down`

## Important Implementation Adjustments During Validation
- Backend container base image pinned to Alpine 3.18 and runtime package `openssl1.1-compat` added to avoid Prisma/OpenSSL runtime issues.
- Backend container runtime port standardized to `3000` (ENV, EXPOSE, and HEALTHCHECK aligned with service labels).
- Prisma client generation updated with `binaryTargets = ["native", "linux-musl"]` for container compatibility.
- Frontend PostCSS config changed to CommonJS export (`module.exports`) to match the build/runtime toolchain behavior in containerized builds.
- Added `frontend/public/.gitkeep` so Docker build steps expecting `frontend/public` do not fail on missing directory.
- Compose volume naming uses stable keys with per-org `name:` values, avoiding top-level interpolated key issues.
