#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
TEMPLATE_DIR="${DEPLOY_DIR}/template"
TRAEFIK_DIR="${DEPLOY_DIR}/traefik"
ORGS_DIR="${DEPLOY_DIR}/orgs"
LOGS_DIR="${DEPLOY_DIR}/logs"

usage() {
  cat <<'USAGE'
Usage:
  provision-org.sh [ORG_NAME TRAEFIK_HOST ADMIN_EMAIL SMTP_HOST SMTP_USER SMTP_PASS]

Arguments are optional. Missing values will be prompted interactively.
USAGE
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command not found: $1" >&2
    exit 1
  fi
}

prompt_if_empty() {
  local var_name="$1"
  local prompt_text="$2"
  local secret="${3:-false}"

  if [[ -z "${!var_name:-}" ]]; then
    if [[ "$secret" == "true" ]]; then
      read -r -s -p "${prompt_text}: " "$var_name"
      echo
    else
      read -r -p "${prompt_text}: " "$var_name"
    fi
  fi
}

resolve_dns_ip() {
  local host="$1"

  if command -v getent >/dev/null 2>&1; then
    getent ahosts "$host" | awk '{print $1}' | head -n1
    return 0
  fi

  if command -v dig >/dev/null 2>&1; then
    dig +short "$host" | head -n1
    return 0
  fi

  if command -v nslookup >/dev/null 2>&1; then
    nslookup "$host" 2>/dev/null | awk '/^Address: / {print $2}' | tail -n1
    return 0
  fi

  return 1
}

check_local_port_bound() {
  local port="$1"
  local uname_s
  uname_s="$(uname -s 2>/dev/null || true)"

  # On Windows shell environments, ss/netstat output is often unavailable or inconsistent.
  # We already validate Traefik container port bindings via docker ps checks.
  if [[ "$uname_s" == MINGW* || "$uname_s" == MSYS* || "$uname_s" == CYGWIN* ]]; then
    return 0
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -E ":${port}$" >/dev/null 2>&1
    return $?
  fi

  if command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -E ":${port}$" >/dev/null 2>&1
    return $?
  fi

  return 1
}

validate_org_name() {
  if [[ ! "$ORG_NAME" =~ ^[a-z0-9-]+$ ]]; then
    echo "Error: ORG_NAME must match ^[a-z0-9-]+$" >&2
    exit 1
  fi
}

preflight_checks() {
  echo "[preflight] Running Hostinger-safe checks..."

  require_command docker
  require_command openssl
  require_command envsubst
  require_command curl

  local dns_ip
  dns_ip="$(resolve_dns_ip "$TRAEFIK_HOST" || true)"
  if [[ -z "$dns_ip" ]]; then
    echo "Error: DNS lookup failed for $TRAEFIK_HOST" >&2
    exit 1
  fi
  echo "[preflight] DNS resolved: $TRAEFIK_HOST -> $dns_ip"

  if ! docker network inspect traefik-public >/dev/null 2>&1; then
    echo "Error: Docker network 'traefik-public' does not exist." >&2
    echo "Run: docker network create traefik-public" >&2
    exit 1
  fi
  echo "[preflight] Docker network present: traefik-public"

  if [[ ! -f "${TRAEFIK_DIR}/acme.json" ]]; then
    echo "Error: Missing ${TRAEFIK_DIR}/acme.json" >&2
    echo "Run: touch deploy/traefik/acme.json && chmod 600 deploy/traefik/acme.json" >&2
    exit 1
  fi

  local acme_perms
  acme_perms="$(stat -c '%a' "${TRAEFIK_DIR}/acme.json" 2>/dev/null || true)"
  local uname_s
  uname_s="$(uname -s 2>/dev/null || true)"
  if [[ "$uname_s" == MINGW* || "$uname_s" == MSYS* || "$uname_s" == CYGWIN* ]]; then
    echo "[preflight] acme.json permission check skipped on Windows shell (current: ${acme_perms:-unknown})"
  else
    if [[ -n "$acme_perms" && "$acme_perms" != "600" ]]; then
      echo "Error: deploy/traefik/acme.json must have permissions 600 (current: $acme_perms)." >&2
      exit 1
    fi
    echo "[preflight] acme.json exists with acceptable permissions"
  fi

  if ! docker ps --format '{{.Names}}' | grep -qx 'aether-traefik'; then
    echo "Error: Traefik container 'aether-traefik' is not running." >&2
    echo "Run: docker compose -f deploy/traefik/docker-compose.yml up -d" >&2
    exit 1
  fi

  local traefik_ports
  traefik_ports="$(docker ps --filter name=^/aether-traefik$ --format '{{.Ports}}')"
  if [[ -z "$traefik_ports" ]]; then
    traefik_ports="$(docker ps --filter name=aether-traefik --format '{{.Ports}}')"
  fi
  if [[ -z "$traefik_ports" ]]; then
    traefik_ports="$(docker ps --format '{{.Names}} {{.Ports}}' | awk '/aether-traefik/ { $1=""; sub(/^ /, ""); print }')"
  fi
  if [[ "$traefik_ports" != *"0.0.0.0:80->80/tcp"* && "$traefik_ports" != *":::80->80/tcp"* ]]; then
    echo "Error: Traefik is not bound to host port 80." >&2
    exit 1
  fi
  if [[ "$traefik_ports" != *"0.0.0.0:443->443/tcp"* && "$traefik_ports" != *":::443->443/tcp"* ]]; then
    echo "Error: Traefik is not bound to host port 443." >&2
    exit 1
  fi

  if ! check_local_port_bound 80; then
    echo "Error: No listener detected on local port 80." >&2
    exit 1
  fi
  if ! check_local_port_bound 443; then
    echo "Error: No listener detected on local port 443." >&2
    exit 1
  fi
  echo "[preflight] Port listeners verified: 80 and 443"

  if [[ ! -f "${TRAEFIK_DIR}/docker-compose.yml" ]]; then
    echo "Error: Missing Traefik compose file at ${TRAEFIK_DIR}/docker-compose.yml" >&2
    exit 1
  fi
  if [[ ! -f "${TRAEFIK_DIR}/.env" ]]; then
    echo "Error: Missing ${TRAEFIK_DIR}/.env (required by traefik compose)." >&2
    exit 1
  fi

  if ! docker compose -f "${TRAEFIK_DIR}/docker-compose.yml" --env-file "${TRAEFIK_DIR}/.env" ps --status running | grep -q 'aether-traefik'; then
    echo "Error: Traefik compose stack is not healthy/running." >&2
    exit 1
  fi

  local dashboard_status
  dashboard_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:8080/api/rawdata" 2>/dev/null || true)"
  if [[ "$dashboard_status" != "200" && "$dashboard_status" != "401" && "$dashboard_status" != "403" ]]; then
    echo "Error: Traefik dashboard API is not reachable on localhost:8080 (health validation failed)." >&2
    exit 1
  fi

  echo "[preflight] Traefik health validation passed"
}

wait_for_postgres() {
  local compose_file="$1"
  local retries=60

  echo "[wait] Waiting for Postgres readiness..."
  for ((i=1; i<=retries; i+=1)); do
    if docker compose -f "$compose_file" exec -T postgres pg_isready -U aether >/dev/null 2>&1; then
      echo "[wait] Postgres is ready"
      return 0
    fi
    sleep 2
  done

  echo "Error: Postgres did not become ready in time." >&2
  return 1
}

wait_for_backend_health() {
  local compose_file="$1"
  local retries=60

  echo "[wait] Waiting for backend /health..."
  for ((i=1; i<=retries; i+=1)); do
    if docker compose -f "$compose_file" exec -T backend curl -fsS "http://localhost:3000/health" >/dev/null 2>&1; then
      echo "[wait] Backend health check passed"
      return 0
    fi
    sleep 2
  done

  echo "Error: backend /health did not return success in time." >&2
  return 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ORG_NAME="${1:-${ORG_NAME:-}}"
TRAEFIK_HOST="${2:-${TRAEFIK_HOST:-}}"
ADMIN_EMAIL="${3:-${ADMIN_EMAIL:-}}"
SMTP_HOST="${4:-${SMTP_HOST:-}}"
SMTP_USER="${5:-${SMTP_USER:-}}"
SMTP_PASS="${6:-${SMTP_PASS:-}}"

prompt_if_empty ORG_NAME "ORG_NAME (lowercase slug)"
prompt_if_empty TRAEFIK_HOST "TRAEFIK_HOST (domain)"
prompt_if_empty ADMIN_EMAIL "ADMIN_EMAIL"
prompt_if_empty SMTP_HOST "SMTP_HOST"
prompt_if_empty SMTP_USER "SMTP_USER"
prompt_if_empty SMTP_PASS "SMTP_PASS" true

validate_org_name

mkdir -p "$ORGS_DIR" "$LOGS_DIR"
ORG_DIR="${ORGS_DIR}/${ORG_NAME}"
if [[ -d "$ORG_DIR" ]]; then
  echo "Error: Organization already exists at ${ORG_DIR}" >&2
  exit 1
fi

if [[ ! -f "${TEMPLATE_DIR}/docker-compose.yml" || ! -f "${TEMPLATE_DIR}/.env.template" ]]; then
  echo "Error: deploy/template is incomplete. Expected docker-compose.yml and .env.template" >&2
  exit 1
fi

preflight_checks

JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
DATABASE_PASSWORD="$(openssl rand -hex 16)"
TEMP_ADMIN_PASSWORD="$(openssl rand -hex 8)"
SMTP_FROM="${ADMIN_EMAIL}"

mkdir -p "$ORG_DIR"
cp "${TEMPLATE_DIR}/nginx.conf" "$ORG_DIR/nginx.conf"

export ORG_NAME TRAEFIK_HOST SMTP_HOST SMTP_USER SMTP_PASS SMTP_FROM DATABASE_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET
envsubst < "${TEMPLATE_DIR}/docker-compose.yml" > "${ORG_DIR}/docker-compose.yml"
envsubst < "${TEMPLATE_DIR}/.env.template" > "${ORG_DIR}/.env"

compose_file="${ORG_DIR}/docker-compose.yml"

if ! docker compose -f "$compose_file" --env-file "${ORG_DIR}/.env" config >/dev/null; then
  echo "Error: generated docker-compose.yml is invalid." >&2
  exit 1
fi

echo "[deploy] Starting org stack for ${ORG_NAME}..."
docker compose -f "$compose_file" --env-file "${ORG_DIR}/.env" up -d

wait_for_postgres "$compose_file"

echo "[deploy] Running Prisma migrations..."
if ! docker compose -f "$compose_file" --env-file "${ORG_DIR}/.env" run --rm backend npx prisma migrate deploy; then
  echo "[deploy] Prisma migrate deploy failed. Falling back to Prisma db push..."
  if ! docker compose -f "$compose_file" --env-file "${ORG_DIR}/.env" run --rm backend npx prisma db push --accept-data-loss; then
    echo "Error: Prisma db push fallback failed after migrate deploy error." >&2
    exit 1
  fi
fi

if ! wait_for_backend_health "$compose_file"; then
  echo "[deploy] Backend health failed after migrations. Attempting Prisma db push fallback..."
  if ! docker compose -f "$compose_file" --env-file "${ORG_DIR}/.env" run --rm backend npx prisma db push --accept-data-loss; then
    echo "Error: Prisma db push fallback failed." >&2
    exit 1
  fi
  wait_for_backend_health "$compose_file"
fi

echo "[deploy] Seeding first admin user..."
seeded_admin="false"
if seed_result="$(docker compose -f "$compose_file" --env-file "${ORG_DIR}/.env" run --rm backend node scripts/seed-admin.js --email "$ADMIN_EMAIL" --org "$ORG_NAME" --password "$TEMP_ADMIN_PASSWORD" 2>&1)"; then
  echo "${seed_result}" | tail -n1 > "${ORG_DIR}/seed-admin.result.json"
  seeded_admin="true"
else
  echo "[warn] Admin seeding failed; stack is deployed but initial admin was not created automatically." >&2
  echo "[warn] This is non-fatal. Admin portal API now runs an API-side ensure-admin upsert step." >&2
  printf '{"status":"seed_skipped","reason":"seed-admin.js unavailable or failed"}\n' > "${ORG_DIR}/seed-admin.result.json"
fi

echo ""
echo "Provisioning completed successfully"
echo "Login URL: https://${TRAEFIK_HOST}"
echo "Admin email: ${ADMIN_EMAIL}"
if [[ "$seeded_admin" == "true" ]]; then
  echo "Temporary admin password: ${TEMP_ADMIN_PASSWORD}"
else
  echo "Temporary admin password: not generated by script (API-side admin ensure is expected)"
fi
echo "Org directory: ${ORG_DIR}"
