#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ORGS_DIR="${DEPLOY_DIR}/orgs"
LOGS_DIR="${DEPLOY_DIR}/logs"
UPDATE_LOG="${LOGS_DIR}/updates.log"
UPDATE_ORG_SCRIPT="${SCRIPT_DIR}/update-org.sh"

usage() {
  cat <<'USAGE'
Usage:
  update-all.sh [--continue-on-error]

Iterates every org directory under deploy/orgs and runs update-org.sh.
Default behavior stops on first failure.
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

CONTINUE_ON_ERROR=false

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--continue-on-error" ]]; then
  CONTINUE_ON_ERROR=true
elif [[ -n "${1:-}" ]]; then
  echo "Error: unknown option ${1}" >&2
  usage
  exit 1
fi

[[ -x "${UPDATE_ORG_SCRIPT}" ]] || { echo "Error: missing executable ${UPDATE_ORG_SCRIPT}" >&2; exit 1; }
[[ -d "${ORGS_DIR}" ]] || { echo "Error: orgs directory missing: ${ORGS_DIR}" >&2; exit 1; }
mkdir -p "${LOGS_DIR}"

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
  log "Updating org=${org}"
  if "${UPDATE_ORG_SCRIPT}" "${org}"; then
    passed+=("${org}")
  else
    failed+=("${org}")
    if [[ "${CONTINUE_ON_ERROR}" != "true" ]]; then
      log "Stopped on first failure org=${org}"
      break
    fi
  fi
done

log "Update summary success=${#passed[@]} failed=${#failed[@]}"
if (( ${#passed[@]} > 0 )); then
  log "Successful orgs: ${passed[*]}"
fi
if (( ${#failed[@]} > 0 )); then
  log "Failed orgs: ${failed[*]}"
  exit 1
fi

log "update-all completed successfully"