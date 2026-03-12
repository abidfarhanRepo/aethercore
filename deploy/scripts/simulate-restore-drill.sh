#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ORGS_DIR="${DEPLOY_DIR}/orgs"
LOGS_DIR="${DEPLOY_DIR}/logs"
WORK_DIR="${DEPLOY_DIR}/.drill"

usage() {
  cat <<'USAGE'
Usage:
  simulate-restore-drill.sh

For each org in deploy/orgs:
- Finds the latest SQL backup
- Restores into a temporary drill stack named aether-drill-<org>
- Runs smoke tests for /health and /api/v1/products (expect 200)
- Tears down temporary resources

Exit code is 0 only if all orgs pass.
USAGE
}

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

validate_org_name() {
  local org="$1"
  [[ "${org}" =~ ^[a-z0-9-]+$ ]]
}

latest_backup_for_org() {
  local org="$1"
  local candidate=""

  if [[ -d "/backups/${org}" ]]; then
    candidate="$(find "/backups/${org}" -maxdepth 1 -type f -name '*.sql.gz' | sort | tail -n1 || true)"
  fi

  if [[ -z "${candidate}" && -d "${DEPLOY_DIR}/backups/${org}" ]]; then
    candidate="$(find "${DEPLOY_DIR}/backups/${org}" -maxdepth 1 -type f -name '*.sql.gz' | sort | tail -n1 || true)"
  fi

  echo "${candidate}"
}

wait_for_postgres() {
  local compose_file="$1"
  local env_file="$2"
  local attempt

  for attempt in {1..40}; do
    if docker compose -f "${compose_file}" --env-file "${env_file}" exec -T postgres pg_isready -U aether >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

wait_for_http_200() {
  local url="$1"
  local attempt

  for attempt in {1..60}; do
    if curl -fsS -o /dev/null "${url}"; then
      return 0
    fi
    sleep 1
  done

  return 1
}

run_drill_for_org() {
  local org="$1"
  local backup_file="$2"
  local stack_name="aether-drill-${org}"
  local org_work_dir="${WORK_DIR}/${org}"
  local compose_file="${org_work_dir}/docker-compose.yml"
  local env_file="${org_work_dir}/.env"
  local host_port
  local org_hash
  local db_password
  local db_name

  org_hash="$(printf '%s' "${org}" | cksum | awk '{print $1}')"
  host_port="$((20000 + (org_hash % 20000)))"
  db_password="drill_${org}_pw"
  db_name="aether_${org}"

  mkdir -p "${org_work_dir}"

  cat > "${env_file}" <<ENV
POSTGRES_DB=${db_name}
POSTGRES_USER=aether
POSTGRES_PASSWORD=${db_password}
DATABASE_URL=postgresql://aether:${db_password}@postgres:5432/${db_name}
REDIS_URL=redis://redis:6379
NODE_ENV=production
PORT=3000
LOG_LEVEL=warn
JWT_ACCESS_SECRET=drill_access_${org}
JWT_REFRESH_SECRET=drill_refresh_${org}
RATE_LIMIT_GLOBAL=1000
RATE_LIMIT_AUTH=100
ENV

  cat > "${compose_file}" <<'YAML'
name: __STACK_NAME__

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aether"]
      interval: 5s
      timeout: 3s
      retries: 20

  redis:
    image: redis:7-alpine

  backend:
    image: aether-backend:latest
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    ports:
      - "__HOST_PORT__:3000"
YAML

  sed -i "s/__STACK_NAME__/${stack_name}/g; s/__HOST_PORT__/${host_port}/g" "${compose_file}"

  docker compose -f "${compose_file}" --env-file "${env_file}" up -d postgres redis

  if ! wait_for_postgres "${compose_file}" "${env_file}"; then
    log "Drill failed: postgres not ready for org ${org}"
    docker compose -f "${compose_file}" --env-file "${env_file}" down -v >/dev/null 2>&1 || true
    return 1
  fi

  if ! gunzip -c "${backup_file}" | docker compose -f "${compose_file}" --env-file "${env_file}" exec -T postgres sh -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'; then
    log "Drill failed: restore failed for org ${org}"
    docker compose -f "${compose_file}" --env-file "${env_file}" down -v >/dev/null 2>&1 || true
    return 1
  fi

  docker compose -f "${compose_file}" --env-file "${env_file}" up -d backend

  if ! wait_for_http_200 "http://localhost:${host_port}/health"; then
    log "Drill failed: /health did not return 200 for org ${org}"
    docker compose -f "${compose_file}" --env-file "${env_file}" down -v >/dev/null 2>&1 || true
    return 1
  fi

  if ! wait_for_http_200 "http://localhost:${host_port}/api/v1/products"; then
    log "Drill failed: /api/v1/products did not return 200 for org ${org}"
    docker compose -f "${compose_file}" --env-file "${env_file}" down -v >/dev/null 2>&1 || true
    return 1
  fi

  docker compose -f "${compose_file}" --env-file "${env_file}" down -v >/dev/null 2>&1 || true
  rm -rf "${org_work_dir}"
  return 0
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

[[ -d "${ORGS_DIR}" ]] || { echo "Error: orgs directory missing: ${ORGS_DIR}" >&2; exit 1; }
mkdir -p "${LOGS_DIR}" "${WORK_DIR}"

declare -a orgs=()
while IFS= read -r org_dir; do
  orgs+=("$(basename "${org_dir}")")
done < <(find "${ORGS_DIR}" -mindepth 1 -maxdepth 1 -type d | sort)

if (( ${#orgs[@]} == 0 )); then
  log "No organizations found under ${ORGS_DIR}"
  exit 0
fi

declare -a passed=()
declare -a failed=()

for org in "${orgs[@]}"; do
  if ! validate_org_name "${org}"; then
    log "Skipping invalid org directory name: ${org}"
    failed+=("${org}")
    continue
  fi

  backup_file="$(latest_backup_for_org "${org}")"
  if [[ -z "${backup_file}" ]]; then
    log "No backup found for org ${org}; marking as failed"
    failed+=("${org}")
    continue
  fi

  if run_drill_for_org "${org}" "${backup_file}"; then
    passed+=("${org}")
  else
    failed+=("${org}")
  fi
done

summary_file="${LOGS_DIR}/restore-drill-summary-$(date '+%Y%m%d_%H%M%S').log"
{
  echo "Aether restore drill summary"
  echo "Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "Passed (${#passed[@]}): ${passed[*]:-none}"
  echo "Failed (${#failed[@]}): ${failed[*]:-none}"
} > "${summary_file}"

cat "${summary_file}"
rm -rf "${WORK_DIR}"

if (( ${#failed[@]} > 0 )); then
  exit 1
fi

exit 0
