# API Versioning Policy

## Current Version
- The active API version is `v1`.
- All application API endpoints must be exposed under `/api/v1/*`.
- The operational health endpoint remains unversioned at `/health`.

## Backward Compatibility
- Legacy `GET /api/*` endpoints are redirected to `/api/v1/*` with HTTP `301`.
- Redirected responses include:
- `X-API-Deprecation: Deprecated endpoint. Use /api/v1/*`
- `Warning: 299 - "Deprecated API version. Use /api/v1 endpoints"`

## Breaking Change Policy
- Any backward-incompatible API change must be released under a new major API path (for example, `/api/v2`).
- Existing major versions continue to receive security and stability fixes during their support window.

## Support Window
- `v1` is the supported version for all current clients.
- After a new major version is released, the previous major version is supported for at least 6 months before removal.
- Deprecation notices must be documented in release notes and changelog entries before end-of-support.
