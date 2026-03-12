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
  backup-org.sh <ORG_NAME>

Creates a timestamped Postgres SQL gzip dump and Redis dump.rdb snapshot.
Backups are stored under /backups/<org>/ by default, or deploy/backups/<org>/ if /backups is unavailable.
USAGE
}

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

error_exit() {
  local msg="$1"
  mkdir -p "${LOGS_DIR}"
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR backup org=${ORG_NAME:-unknown} message=${msg}" >> "${AUDIT_LOG}"
  echo "Error: ${msg}" >&2
  exit 1
}

validate_org_name() {
  if [[ ! "${ORG_NAME}" =~ ^[a-z0-9-]+$ ]]; then
    error_exit "ORG_NAME must match ^[a-z0-9-]+$"
  fi
}

require_compose_stack() {
  ORG_DIR="${ORGS_DIR}/${ORG_NAME}"
  COMPOSE_FILE="${ORG_DIR}/docker-compose.yml"
  ENV_FILE="${ORG_DIR}/.env"

  [[ -d "${ORG_DIR}" ]] || error_exit "organization directory does not exist: ${ORG_DIR}"
  [[ -f "${COMPOSE_FILE}" ]] || error_exit "compose file missing: ${COMPOSE_FILE}"
  [[ -f "${ENV_FILE}" ]] || error_exit "env file missing: ${ENV_FILE}"
}

resolve_backup_root() {
  if [[ -n "${BACKUP_ROOT:-}" ]]; then
    BACKUP_ROOT_RESOLVED="${BACKUP_ROOT}"
    mkdir -p "${BACKUP_ROOT_RESOLVED}" || error_exit "unable to create BACKUP_ROOT: ${BACKUP_ROOT_RESOLVED}"
    return 0
  fi

  if mkdir -p "/backups" 2>/dev/null; then
    BACKUP_ROOT_RESOLVED="/backups"
  else
    BACKUP_ROOT_RESOLVED="${DEPLOY_DIR}/backups"
    mkdir -p "${BACKUP_ROOT_RESOLVED}" || error_exit "unable to create fallback backup directory: ${BACKUP_ROOT_RESOLVED}"
  fi
}

prune_old_backups() {
  local backup_dir="$1"
  local keep_count=30
  local old_sql

  mapfile -t sql_files < <(find "${backup_dir}" -maxdepth 1 -type f -name '*.sql.gz' -print | sort -r)
  if (( ${#sql_files[@]} <= keep_count )); then
    return 0
  fi

  for old_sql in "${sql_files[@]:keep_count}"; do
    rm -f "${old_sql}"
    rm -f "${old_sql%.sql.gz}.dump.rdb"
  done
}

backup_postgres() {
  local sql_backup="$1"

  log "Starting Postgres dump for org ${ORG_NAME}"
  if ! docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres sh -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -c > "${sql_backup}"; then
    rm -f "${sql_backup}"
    error_exit "Postgres dump failed for org ${ORG_NAME}"
  fi
}

backup_redis() {
  local redis_backup="$1"
  local before_lastsave
  local bgsave_output
  local attempt

  log "Triggering Redis BGSAVE for org ${ORG_NAME}"
  before_lastsave="$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T redis redis-cli LASTSAVE | tr -d '\r')"

  bgsave_output="$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T redis redis-cli BGSAVE | tr -d '\r' || true)"
  if [[ "${bgsave_output}" != OK && "${bgsave_output}" != *"Background save already in progress"* ]]; then
    error_exit "Redis BGSAVE failed for org ${ORG_NAME}: ${bgsave_output}"
  fi

  for attempt in {1..30}; do
    local in_progress
    local current_lastsave
    in_progress="$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T redis redis-cli INFO persistence | awk -F: '/rdb_bgsave_in_progress/ {print $2}' | tr -d '\r')"
    current_lastsave="$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T redis redis-cli LASTSAVE | tr -d '\r')"

    if [[ "${in_progress}" == "0" && "${current_lastsave}" != "${before_lastsave}" ]]; then
      break
    fi
    sleep 1
  done

  if [[ "${current_lastsave}" == "${before_lastsave}" ]]; then
    error_exit "Redis BGSAVE did not complete in time for org ${ORG_NAME}"
  fi

  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" cp redis:/data/dump.rdb "${redis_backup}" >/dev/null
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ORG_NAME="${1:-}"
[[ -n "${ORG_NAME}" ]] || { usage; exit 1; }

validate_org_name
require_compose_stack
resolve_backup_root

TS="$(date '+%Y%m%d_%H%M%S')"
BACKUP_DIR="${BACKUP_ROOT_RESOLVED}/${ORG_NAME}"
SQL_BACKUP="${BACKUP_DIR}/${TS}.sql.gz"
REDIS_BACKUP="${BACKUP_DIR}/${TS}.dump.rdb"

mkdir -p "${BACKUP_DIR}" "${LOGS_DIR}"

backup_postgres "${SQL_BACKUP}"
backup_redis "${REDIS_BACKUP}"
prune_old_backups "${BACKUP_DIR}"

log "Backup complete: org=${ORG_NAME} sql=${SQL_BACKUP} redis=${REDIS_BACKUP}"
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] action=backup org=${ORG_NAME} sql=${SQL_BACKUP} redis=${REDIS_BACKUP}" >> "${AUDIT_LOG}"
