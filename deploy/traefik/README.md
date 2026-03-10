# Traefik Reverse Proxy Stack (W2-02)

This stack is the shared edge proxy for all provisioned Aether tenant stacks.

Hostinger deployment guide for `alfazam.com`:
- `docs/W2-02_HOSTINGER_ALFAZAM_TRAEFIK_RUNBOOK_2026-03-10.md`

## What it does

- Terminates TLS on ports 80/443
- Redirects all HTTP traffic to HTTPS
- Discovers tenant services from Docker labels
- Issues and renews certificates with Let's Encrypt (HTTP-01)
- Exposes Traefik dashboard behind BasicAuth

## 1) Prerequisites

- Docker and Docker Compose installed
- Public DNS records pointing at this server:
  - `alfazam.com` (or tenant hostnames) -> server public IP
  - `traefik.alfazam.com` -> server public IP
- Open inbound ports 80 and 443 on router/firewall

Create the shared Docker network once:

```bash
docker network create traefik-public
```

## 2) Prepare local files

From `deploy/traefik`:

1. Copy environment file:

```bash
cp .env.example .env
```

2. Set a strong dashboard password hash:

```bash
htpasswd -nb admin "your-strong-password"
```

Paste output into `TRAEFIK_DASHBOARD_USERS` in `.env` and escape `$` as `$$`.

3. Create ACME storage with restricted permissions:

```bash
touch acme.json
chmod 600 acme.json
```

On Windows PowerShell, use:

```powershell
New-Item -ItemType File -Path .\acme.json -Force | Out-Null
```

## 3) Start Traefik

```bash
docker compose up -d
```

Check status:

```bash
docker compose ps
docker compose logs -f traefik
```

## 4) Verify routing

- Dashboard via domain: `https://traefik.alfazam.com`
- Local dashboard fallback: `http://localhost:8080/dashboard/` (BasicAuth required)
- HTTP requests should redirect to HTTPS automatically

## 5) Local-only certificate alternative (mkcert)

If your server is local-network only, you can avoid Let's Encrypt and use mkcert:

1. Install mkcert and trust local CA.
2. Generate certs for local hosts.
3. Add a dynamic TLS config file and mount cert/key paths into Traefik.
4. Disable ACME resolver usage on local routers.

This is useful for offline demos where public DNS and ports 80/443 are unavailable.
