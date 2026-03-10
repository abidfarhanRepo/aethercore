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
  deprovision-org.sh [ORG_NAME]

If ORG_NAME is omitted, the script will prompt for it.
USAGE
}

ORG_NAME="${1:-${ORG_NAME:-}}"
if [[ "${ORG_NAME}" == "-h" || "${ORG_NAME}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${ORG_NAME}" ]]; then
  read -r -p "ORG_NAME to deprovision: " ORG_NAME
fi

if [[ ! "${ORG_NAME}" =~ ^[a-z0-9-]+$ ]]; then
  echo "Error: ORG_NAME must match ^[a-z0-9-]+$" >&2
  exit 1
fi

ORG_DIR="${ORGS_DIR}/${ORG_NAME}"
if [[ ! -d "${ORG_DIR}" ]]; then
  echo "Error: organization directory does not exist: ${ORG_DIR}" >&2
  exit 1
fi

read -r -p "Type the org name (${ORG_NAME}) to confirm deprovisioning: " CONFIRM
if [[ "${CONFIRM}" != "${ORG_NAME}" ]]; then
  echo "Confirmation mismatch. Aborting."
  exit 1
fi

compose_file="${ORG_DIR}/docker-compose.yml"
if [[ ! -f "${compose_file}" ]]; then
  echo "Error: compose file missing: ${compose_file}" >&2
  exit 1
fi

echo "[deprovision] Stopping stack and removing volumes for ${ORG_NAME}..."
docker compose -f "${compose_file}" --env-file "${ORG_DIR}/.env" down -v

echo "[deprovision] Removing ${ORG_DIR}..."
rm -rf "${ORG_DIR}"

mkdir -p "${LOGS_DIR}"
touch "${AUDIT_LOG}"

ts="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
actor="${SUDO_USER:-${USER:-unknown}}"
echo "${ts} action=deprovision org=${ORG_NAME} actor=${actor}" >> "${AUDIT_LOG}"

echo "Deprovision complete for org: ${ORG_NAME}"
