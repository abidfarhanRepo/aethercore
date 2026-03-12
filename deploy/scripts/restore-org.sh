#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ORGS_DIR="${DEPLOY_DIR}/orgs"
LOGS_DIR="${DEPLOY_DIR}/logs"
AUDIT_LOG="${LOGS_DIR}/audit.log"

usage() {
  cat <<'USAGE'
Usage:
  restore-org.sh <ORG_NAME> <backup-file>

Restores an org Postgres DB from a .sql.gz backup file and runs prisma migrate deploy.
backup-file can be absolute or relative to backup roots.
USAGE
}

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

error_exit() {
  local msg="$1"
  mkdir -p "${LOGS_DIR}"
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR restore org=${ORG_NAME:-unknown} message=${msg}" >> "${AUDIT_LOG}"
  echo "Error: ${msg}" >&2
  exit 1
}

canonical_path() {
  local p="$1"
  if command -v realpath >/dev/null 2>&1; then
    realpath "$p"
  else
    echo "$(cd "$(dirname "$p")" && pwd)/$(basename "$p")"
  fi
}

validate_org_name() {
  if [[ ! "${ORG_NAME}" =~ ^[a-z0-9-]+$ ]]; then
    error_exit "ORG_NAME must match ^[a-z0-9-]+$"
  fi
}

resolve_backup_file() {
  local candidate="$1"

  if [[ -f "${candidate}" ]]; then
    BACKUP_FILE_PATH="$(canonical_path "${candidate}")"
    return 0
  fi

  if [[ -f "/backups/${ORG_NAME}/${candidate}" ]]; then
    BACKUP_FILE_PATH="$(canonical_path "/backups/${ORG_NAME}/${candidate}")"
    return 0
  fi

  if [[ -f "${DEPLOY_DIR}/backups/${ORG_NAME}/${candidate}" ]]; then
    BACKUP_FILE_PATH="$(canonical_path "${DEPLOY_DIR}/backups/${ORG_NAME}/${candidate}")"
    return 0
  fi

  error_exit "backup file not found: ${candidate}"
}

ensure_backup_scope_safe() {
  case "${BACKUP_FILE_PATH}" in
    /backups/${ORG_NAME}/*|"${DEPLOY_DIR}/backups/${ORG_NAME}"/*)
      ;;
    *)
      error_exit "backup file path is outside allowed org-specific backup locations: ${BACKUP_FILE_PATH}"
      ;;
  esac

  if [[ "${BACKUP_FILE_PATH}" != *.sql.gz ]]; then
    error_exit "backup file must end with .sql.gz"
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ORG_NAME="${1:-}"
BACKUP_INPUT="${2:-}"

[[ -n "${ORG_NAME}" && -n "${BACKUP_INPUT}" ]] || { usage; exit 1; }

validate_org_name

ORG_DIR="${ORGS_DIR}/${ORG_NAME}"
COMPOSE_FILE="${ORG_DIR}/docker-compose.yml"
ENV_FILE="${ORG_DIR}/.env"
[[ -d "${ORG_DIR}" ]] || error_exit "organization directory does not exist: ${ORG_DIR}"
[[ -f "${COMPOSE_FILE}" ]] || error_exit "compose file missing: ${COMPOSE_FILE}"
[[ -f "${ENV_FILE}" ]] || error_exit "env file missing: ${ENV_FILE}"

resolve_backup_file "${BACKUP_INPUT}"
ensure_backup_scope_safe

mkdir -p "${LOGS_DIR}"

log "Stopping backend for org ${ORG_NAME}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" stop backend

log "Dropping and recreating Postgres DB for org ${ORG_NAME}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres sh -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '\''${POSTGRES_DB}'\'' AND pid <> pg_backend_pid();" -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";" -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"'

log "Restoring backup ${BACKUP_FILE_PATH}"
gunzip -c "${BACKUP_FILE_PATH}" | docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres sh -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

log "Applying Prisma migrations"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T backend sh -lc 'npx prisma migrate deploy'

log "Starting backend"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" start backend

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] action=restore org=${ORG_NAME} backup=${BACKUP_FILE_PATH}" >> "${AUDIT_LOG}"
log "Restore completed for org ${ORG_NAME}"
