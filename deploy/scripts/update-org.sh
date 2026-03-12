#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
ORGS_DIR="${DEPLOY_DIR}/orgs"
LOGS_DIR="${DEPLOY_DIR}/logs"
UPDATE_LOG="${LOGS_DIR}/updates.log"
BACKUP_ORG_SCRIPT="${SCRIPT_DIR}/backup-org.sh"

usage() {
  cat <<'USAGE'
Usage:
  update-org.sh <ORG_NAME>

Runs backup, release gates, rolling service update, migrations, health check, and post-release evidence gate.
USAGE
}

timestamp() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

log() {
  local line="[$(timestamp)] $*"
  mkdir -p "${LOGS_DIR}"
  printf '%s\n' "${line}" | tee -a "${UPDATE_LOG}"
}

error_exit() {
  local msg="$1"
  log "ERROR update org=${ORG_NAME:-unknown} message=${msg}"
  exit 1
}

validate_org_name() {
  if [[ ! "${ORG_NAME}" =~ ^[a-z0-9-]+$ ]]; then
    error_exit "ORG_NAME must match ^[a-z0-9-]+$"
  fi
}

require_stack() {
  ORG_DIR="${ORGS_DIR}/${ORG_NAME}"
  COMPOSE_FILE="${ORG_DIR}/docker-compose.yml"
  ENV_FILE="${ORG_DIR}/.env"

  [[ -x "${BACKUP_ORG_SCRIPT}" ]] || error_exit "missing executable ${BACKUP_ORG_SCRIPT}"
  [[ -d "${ORG_DIR}" ]] || error_exit "organization directory does not exist: ${ORG_DIR}"
  [[ -f "${COMPOSE_FILE}" ]] || error_exit "compose file missing: ${COMPOSE_FILE}"
  [[ -f "${ENV_FILE}" ]] || error_exit "env file missing: ${ENV_FILE}"
}

capture_previous_state() {
  BACKEND_CONTAINER_ID="$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps -q backend | tr -d '\r')"
  FRONTEND_CONTAINER_ID="$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps -q frontend | tr -d '\r')"

  [[ -n "${BACKEND_CONTAINER_ID}" ]] || error_exit "backend container not found; cannot capture rollback state"
  [[ -n "${FRONTEND_CONTAINER_ID}" ]] || error_exit "frontend container not found; cannot capture rollback state"

  BACKEND_PREV_IMAGE_ID="$(docker inspect -f '{{.Image}}' "${BACKEND_CONTAINER_ID}" | tr -d '\r')"
  FRONTEND_PREV_IMAGE_ID="$(docker inspect -f '{{.Image}}' "${FRONTEND_CONTAINER_ID}" | tr -d '\r')"
  BACKEND_IMAGE_REF="$(docker inspect -f '{{.Config.Image}}' "${BACKEND_CONTAINER_ID}" | tr -d '\r')"
  FRONTEND_IMAGE_REF="$(docker inspect -f '{{.Config.Image}}' "${FRONTEND_CONTAINER_ID}" | tr -d '\r')"

  [[ -n "${BACKEND_PREV_IMAGE_ID}" && -n "${BACKEND_IMAGE_REF}" ]] || error_exit "unable to capture backend rollback details"
  [[ -n "${FRONTEND_PREV_IMAGE_ID}" && -n "${FRONTEND_IMAGE_REF}" ]] || error_exit "unable to capture frontend rollback details"
}

run_pre_gates() {
  log "Running pre gates for org=${ORG_NAME}"
  (
    cd "${ROOT_DIR}"
    node backend/scripts/gate-migration-drift.js
  )
  (
    cd "${ROOT_DIR}"
    node backend/scripts/gate-pre-release-evidence.js
  )
}

poll_health_200() {
  local attempt
  local status

  for ((attempt=1; attempt<=60; attempt+=1)); do
    status="$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T backend sh -lc 'curl -sS -o /dev/null -w "%{http_code}" "http://localhost:3000/health"' 2>/dev/null || true)"
    if [[ "${status}" == "200" ]]; then
      return 0
    fi
    sleep 1
  done

  return 1
}

rollback_previous_state() {
  log "Health check failed; rolling back org=${ORG_NAME}"

  if ! docker image inspect "${BACKEND_PREV_IMAGE_ID}" >/dev/null 2>&1; then
    log "ERROR rollback org=${ORG_NAME} message=missing backend image id ${BACKEND_PREV_IMAGE_ID}"
    return 1
  fi
  if ! docker image inspect "${FRONTEND_PREV_IMAGE_ID}" >/dev/null 2>&1; then
    log "ERROR rollback org=${ORG_NAME} message=missing frontend image id ${FRONTEND_PREV_IMAGE_ID}"
    return 1
  fi

  if ! docker image tag "${BACKEND_PREV_IMAGE_ID}" "${BACKEND_IMAGE_REF}"; then
    log "ERROR rollback org=${ORG_NAME} message=failed to retag backend image ${BACKEND_IMAGE_REF}"
    return 1
  fi
  if ! docker image tag "${FRONTEND_PREV_IMAGE_ID}" "${FRONTEND_IMAGE_REF}"; then
    log "ERROR rollback org=${ORG_NAME} message=failed to retag frontend image ${FRONTEND_IMAGE_REF}"
    return 1
  fi

  if ! docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --no-deps backend frontend; then
    log "ERROR rollback org=${ORG_NAME} message=failed to restart backend/frontend"
    return 1
  fi

  log "Rollback completed for org=${ORG_NAME}"
  return 0
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ORG_NAME="${1:-}"
[[ -n "${ORG_NAME}" ]] || {
  usage
  exit 1
}

validate_org_name
require_stack
mkdir -p "${LOGS_DIR}"

capture_previous_state

log "Starting update for org=${ORG_NAME}"
log "Running backup for org=${ORG_NAME}"
"${BACKUP_ORG_SCRIPT}" "${ORG_NAME}" || error_exit "backup failed"

run_pre_gates || error_exit "pre gates failed"

log "Pulling images for org=${ORG_NAME}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull

log "Rolling restart for org=${ORG_NAME} services=backend,frontend"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --no-deps backend frontend

log "Applying Prisma migrations for org=${ORG_NAME}"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T backend sh -lc 'npx prisma migrate deploy'

log "Polling backend health for org=${ORG_NAME} timeout=60s"
if ! poll_health_200; then
  if rollback_previous_state; then
    error_exit "health check failed after update; rollback applied"
  fi
  error_exit "health check failed after update; rollback failed"
fi

log "Running post gate for org=${ORG_NAME}"
(
  cd "${ROOT_DIR}"
  node backend/scripts/gate-post-release-evidence.js
) || error_exit "post gate failed"

log "Update completed successfully for org=${ORG_NAME}"