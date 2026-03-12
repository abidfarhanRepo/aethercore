#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ORGS_DIR="${DEPLOY_DIR}/orgs"
LOGS_DIR="${DEPLOY_DIR}/logs"
BACKUP_ORG_SCRIPT="${SCRIPT_DIR}/backup-org.sh"

usage() {
  cat <<'USAGE'
Usage:
  backup-all.sh

Iterates every org directory under deploy/orgs and runs backup-org.sh.
Notification target can be provided with ADMIN_EMAIL environment variable.
USAGE
}

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

send_summary() {
  local summary_file="$1"
  local subject="Aether backup-all summary $(date -u '+%Y-%m-%d %H:%M:%SZ')"
  local to_email="${ADMIN_EMAIL:-}"
  local from_email="${SMTP_FROM:-aether-backups@localhost}"

  if [[ -z "${to_email}" ]]; then
    log "ADMIN_EMAIL not set; summary written to logs only"
    cat "${summary_file}"
    return 0
  fi

  if command -v mail >/dev/null 2>&1; then
    mail -s "${subject}" "${to_email}" < "${summary_file}" && return 0
  fi

  if command -v sendmail >/dev/null 2>&1; then
    {
      echo "To: ${to_email}"
      echo "From: ${from_email}"
      echo "Subject: ${subject}"
      echo
      cat "${summary_file}"
    } | sendmail -t && return 0
  fi

  if [[ -n "${SMTP_HOST:-}" ]] && command -v curl >/dev/null 2>&1; then
    local smtp_port="${SMTP_PORT:-587}"
    local smtp_url="smtp://${SMTP_HOST}:${smtp_port}"
    local auth_args=()

    if [[ -n "${SMTP_USER:-}" ]]; then
      auth_args+=(--user "${SMTP_USER}:${SMTP_PASS:-}")
    fi

    curl --silent --show-error --fail \
      --url "${smtp_url}" \
      --mail-from "${from_email}" \
      --mail-rcpt "${to_email}" \
      "${auth_args[@]}" \
      --upload-file <(
        {
          echo "To: ${to_email}"
          echo "From: ${from_email}"
          echo "Subject: ${subject}"
          echo
          cat "${summary_file}"
        }
      ) && return 0
  fi

  log "Summary notification fallback exhausted; unable to send email to ${to_email}"
  cat "${summary_file}"
  return 0
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

[[ -x "${BACKUP_ORG_SCRIPT}" ]] || { echo "Error: missing executable ${BACKUP_ORG_SCRIPT}" >&2; exit 1; }
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
  if "${BACKUP_ORG_SCRIPT}" "${org}"; then
    passed+=("${org}")
  else
    failed+=("${org}")
  fi
done

summary_file="${LOGS_DIR}/backup-summary-$(date '+%Y%m%d_%H%M%S').log"
{
  echo "Aether backup-all summary"
  echo "Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo ""
  echo "Passed (${#passed[@]}): ${passed[*]:-none}"
  echo "Failed (${#failed[@]}): ${failed[*]:-none}"
} > "${summary_file}"

send_summary "${summary_file}"

if (( ${#failed[@]} > 0 )); then
  log "backup-all completed with failures"
  exit 1
fi

log "backup-all completed successfully"
