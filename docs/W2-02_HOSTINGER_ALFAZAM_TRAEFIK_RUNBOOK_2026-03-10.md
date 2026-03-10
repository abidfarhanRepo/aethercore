# W2-02 Hostinger Runbook (alfazam.com)

## Scope

This runbook explains how to run the shared Traefik edge stack for Aether using Hostinger and domain `alfazam.com`.

Files used from this repository:
- `deploy/traefik/docker-compose.yml`
- `deploy/traefik/traefik.yml`
- `deploy/traefik/.env.example`
- `deploy/traefik/README.md`

## 1) Hostinger DNS Setup

Create these DNS records in Hostinger DNS Zone:

1. A record:
- Name: `@`
- Value: `<your-server-public-ip>`

2. A record:
- Name: `traefik`
- Value: `<your-server-public-ip>`

Optional for future tenant subdomains:
- A record:
- Name: `*`
- Value: `<your-server-public-ip>`

Verify propagation:

```powershell
Resolve-DnsName alfazam.com
Resolve-DnsName traefik.alfazam.com
```

## 2) Firewall and Network Requirements

Open inbound TCP ports:
- `80` for HTTP and ACME HTTP-01 challenge
- `443` for HTTPS

Create the shared Docker network once:

```powershell
docker network create traefik-public
```

## 3) Prepare Traefik Stack

From project root:

```powershell
Copy-Item deploy/traefik/.env.example deploy/traefik/.env -Force
```

Edit `deploy/traefik/.env` values:
- `TRAEFIK_HOST=alfazam.com`
- `DASHBOARD_HOST=traefik.alfazam.com`
- `ACME_EMAIL=<your-email>`
- `TRAEFIK_DASHBOARD_USERS=<htpasswd-output-with-escaped-$>`

Generate BasicAuth credentials (example with Dockerized httpd):

```powershell
docker run --rm httpd:2.4-alpine htpasswd -nbB admin "<strong-password>"
```

Escape `$` as `$$` before putting the value in `.env`.

Create ACME file:

```powershell
New-Item -ItemType File -Path deploy/traefik/acme.json -Force | Out-Null
```

## 4) Start and Validate

```powershell
docker compose --env-file deploy/traefik/.env -f deploy/traefik/docker-compose.yml up -d
docker compose --env-file deploy/traefik/.env -f deploy/traefik/docker-compose.yml ps
docker compose --env-file deploy/traefik/.env -f deploy/traefik/docker-compose.yml logs --tail 100
```

Validation checks:

1. Local dashboard auth challenge (expected 401 without creds):

```powershell
try { Invoke-WebRequest http://localhost:8080/dashboard/ -UseBasicParsing -TimeoutSec 8 } catch { $_.Exception.Response.StatusCode.value__ }
```

2. HTTP redirects to HTTPS (expected 301):

```powershell
try { Invoke-WebRequest http://alfazam.com -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 8 } catch { $_.Exception.Response.StatusCode.value__ }
```

3. Dashboard domain reachable after DNS + ACME issuance:
- `https://traefik.alfazam.com`

## 5) How Tenant Traffic Works

- Tenant service stacks join `traefik-public` network.
- Routers are discovered from Docker labels in each tenant compose file.
- Backend traffic routes via `PathPrefix(/api)` labels.
- Frontend traffic routes via host-only labels.
- TLS certificates are issued by Traefik using ACME and stored in `acme.json`.

## 6) Common Issues

1. ACME fails:
- Cause: DNS not propagated or port 80 blocked.
- Fix: verify DNS and firewall, then restart Traefik.

2. Dashboard host not resolving:
- Cause: missing `traefik` DNS record.
- Fix: add `traefik.alfazam.com` A record.

3. Port bind failure on 80/443:
- Cause: another service already using ports.
- Fix: stop conflicting service and restart Traefik.

## 7) Operational Checklist

- DNS A records for `@` and `traefik` point to server IP.
- Ports 80/443 open from the internet.
- `traefik-public` network exists.
- `.env` exists with real credentials and ACME email.
- `acme.json` exists.
- `docker compose ... up -d` is healthy.
- `http://alfazam.com` redirects to HTTPS.
- `https://traefik.alfazam.com` prompts for BasicAuth and opens dashboard.
