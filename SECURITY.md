# Security

## Implemented controls

- Server-side RBAC and tenant ownership checks; cross-tenant domain tests.
- Scrypt password hashing, opaque hashed sessions, expiration, CSRF checks, login throttling, constant-time password/token comparisons.
- Strict input validation for usernames/domains and one-megabyte API request cap.
- Path confinement using canonical roots and real paths; symlink and archive traversal defenses with tests.
- Local-only HMAC-authenticated agent; explicit allowlist; no shell interpolation or arbitrary command API.
- CSP, clickjacking, MIME-sniffing, referrer, and permissions headers; customer-facing 500 responses omit stack traces.
- Non-login service user, restrictive file modes, systemd sandboxing, UFW public ports limited to SSH/HTTP/HTTPS.

## Threat model and residual risk

Primary threats are credential stuffing, broken object authorization, malicious tenant code, path/symlink/archive traversal, command injection, dependency compromise, resource exhaustion, secret/log leakage, SSRF, WebSocket hijacking, and privileged-agent abuse. Critical production gaps remain: persistent/distributed throttling, TOTP and recovery codes, secret encryption, complete audit hash chaining, API token scopes/idempotency, per-tenant cgroups/quotas/AppArmor, malware scanning, websocket terminal isolation, database grants, backup restoration tests, and a Linux adversarial test environment.

Do not expose version 0.1.0 to untrusted tenants. Report vulnerabilities privately to the repository owner; include reproduction, impact, and affected version, but never include live credentials or customer data.

