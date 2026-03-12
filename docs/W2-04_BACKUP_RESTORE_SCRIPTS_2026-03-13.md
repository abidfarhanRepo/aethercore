# W2-04 Backup/Restore/Drill Scripts - 2026-03-13

## Summary

W2-04 implements organization-level disaster-recovery automation in `deploy/scripts` with four production-oriented shell scripts:

- `backup-org.sh` for per-org Postgres+Redis backups
- `backup-all.sh` for fleet-wide backup orchestration and summary notification
- `restore-org.sh` for controlled restore from an org-scoped SQL backup
- `simulate-restore-drill.sh` for automated restore-drill validation per org

The cron scheduling example for daily backups is documented in `deploy/README.md`.

## Implemented Scripts and Usage

### 1) `deploy/scripts/backup-org.sh`

Purpose:
- Validates org name and org stack files.
- Runs Postgres dump via `pg_dump` piped to gzip.
- Triggers Redis `BGSAVE`, waits for completion, and copies `dump.rdb`.
- Stores backups under `/backups/<org>/` when writable, otherwise `deploy/backups/<org>/`.
- Retains the most recent 30 SQL backups (and paired Redis dumps) per org.
- Appends audit entries to `deploy/logs/audit.log`.

Examples:

```bash
./deploy/scripts/backup-org.sh acme-test

# Optional override for backup root
BACKUP_ROOT=/mnt/aether-backups ./deploy/scripts/backup-org.sh acme-test
```

### 2) `deploy/scripts/backup-all.sh`

Purpose:
- Discovers org directories under `deploy/orgs`.
- Executes `backup-org.sh` for each org.
- Builds pass/fail summary log in `deploy/logs/`.
- Attempts summary notification using one of:
  - `mail`
  - `sendmail`
  - SMTP via `curl` when SMTP env vars are provided
- Exits non-zero if any org backup fails.

Examples:

```bash
./deploy/scripts/backup-all.sh

# With email target
ADMIN_EMAIL=ops@example.com ./deploy/scripts/backup-all.sh
```

### 3) `deploy/scripts/restore-org.sh`

Purpose:
- Validates org name and stack files.
- Resolves backup input as:
  - absolute file path, or
  - `/backups/<org>/<file>`, or
  - `deploy/backups/<org>/<file>`.
- Restricts restore scope to org-specific backup directories.
- Stops backend, drops/recreates DB, restores SQL, runs `npx prisma migrate deploy`, restarts backend.
- Appends audit entries to `deploy/logs/audit.log`.

Examples:

```bash
# Relative filename inside /backups/<org>/ or deploy/backups/<org>/
./deploy/scripts/restore-org.sh acme-test 20260313_020000.sql.gz

# Explicit path
./deploy/scripts/restore-org.sh acme-test /backups/acme-test/20260313_020000.sql.gz
```

### 4) `deploy/scripts/simulate-restore-drill.sh`

Purpose:
- Enumerates orgs and selects each org's latest SQL backup.
- Creates temporary per-org drill stacks named `aether-drill-<org>`.
- Restores SQL backups into temporary Postgres.
- Starts backend and runs smoke checks:
  - `GET /health`
  - `GET /api/v1/products`
- Writes restore-drill summary under `deploy/logs/`.
- Cleans up temporary resources.
- Exits non-zero if any org fails.

Example:

```bash
./deploy/scripts/simulate-restore-drill.sh
```

## Verification Performed

Verification completed for W2-04 scope:

- Script-level behavior audit confirms all four required scripts are present and implement the expected control flow.
- `deploy/README.md` includes the required cron example:

```cron
0 2 * * * /path/to/backup-all.sh
```

- Environment health checks executed in local run context:
  - `http://localhost:4000/health` returned `200`
  - `http://localhost:4000/api/v1/health` returned `200`
  - `http://localhost:5173/` returned `200`

## Caveats and Operational Notes

- These scripts assume `docker compose` availability and org-local compose stacks under `deploy/orgs/<org>`.
- `backup-all.sh` email summary requires either:
  - local `mail`/`sendmail`, or
  - SMTP settings (`SMTP_HOST`, optionally `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) and `curl`.
- `restore-org.sh` intentionally blocks restore files outside approved org backup paths.
- `simulate-restore-drill.sh` uses temporary host ports derived from org hash; ensure those ranges are not blocked.
- Drill success for `/api/v1/products` depends on backend readiness plus data/model compatibility in restored snapshots.
- Keep backup storage and retention policy aligned with compliance and recovery objectives (RPO/RTO).
