# W2-06 Admin Portal Provisioning: POS Admin Credentials (2026-03-14)

## Scope
- Added POS admin credential capture directly in the admin portal provisioning form.
- Added API-side admin user ensure step after org stack provisioning.
- Kept provisioning script behavior backward-compatible.

## UI Changes (admin-portal)
- Provision form now includes:
  - POS Admin Email
  - POS Admin Password
- Minimal client validation:
  - Email format check
  - Password length >= 8
- Payload sent to `POST /api/orgs` now includes `adminPassword`.

## API Changes (admin-portal server)
- `POST /api/orgs` now accepts and validates `adminPassword`.
- Validation added:
  - `adminEmail` must match a basic email regex
  - `adminPassword` length must be at least 8
- After `deploy/scripts/provision-org.sh` completes, API runs a one-off command in the org backend container:
  - `docker compose run --rm -T backend node -e ...`
  - Uses Prisma `user.upsert` + `bcryptjs.hash(..., 10)`
  - Ensures user has:
    - role `ADMIN`
    - `isActive: true`
    - `mfaRecoveryCodes: []`
- If this ensure-admin step fails, API returns a clear error (`Provision succeeded but admin user ensure step failed`).

## Security Notes (Phase-Level)
- Secrets are not interpolated into shell strings.
- Command execution uses argument arrays via `execFile` helper.
- Admin email/password are passed through process environment to Docker Compose (`-e VAR`), avoiding plaintext password embedding in command arguments.
- API responses do not echo `adminPassword`.

## Provision Script Compatibility
- `deploy/scripts/provision-org.sh` still performs best-effort legacy `seed-admin.js`.
- Missing/failing `seed-admin.js` no longer blocks provisioning (existing non-fatal behavior retained).
- Script output now clarifies API-side admin ensure expectation when script seed is skipped.

## Troubleshooting
- `POST /api/orgs` returns `Invalid admin email`:
  - Verify `adminEmail` is a valid email string.
- `POST /api/orgs` returns `adminPassword must be at least 8 characters`:
  - Use a password with at least 8 characters.
- `POST /api/orgs` returns `Provision succeeded but admin user ensure step failed`:
  - Confirm org compose files exist in `deploy/orgs/<org>/`.
  - Check backend service can run one-off commands:
    - `docker compose -f deploy/orgs/<org>/docker-compose.yml --env-file deploy/orgs/<org>/.env run --rm -T backend node -e "console.log('ok')"`
  - Inspect backend image dependencies (`@prisma/client`, `bcryptjs`) and org DB connectivity.
