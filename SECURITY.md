# Security

## Implemented controls

- Server-side RBAC and tenant ownership checks; cross-tenant domain tests.
- Scrypt password hashing, opaque hashed sessions, expiration, CSRF checks, login throttling, constant-time password/token comparisons.
- Strict input validation for usernames/domains and one-megabyte API request cap.
- Path confinement using canonical roots and real paths; symlink and archive traversal defenses with tests.
- Local-only HMAC-authenticated agent; explicit allowlist; no shell interpolation or arbitrary command API.
- CSP, clickjacking, MIME-sniffing, referrer, and permissions headers; customer-facing 500 responses omit stack traces.
- Non-login service user, restrictive file modes, systemd sandboxing, UFW public ports limited to SSH/HTTP/HTTPS.

The root agent's systemd sandbox allows `/etc` writes because Ubuntu `useradd` performs locked, temporary-file account-database transactions and the same agent manages Nginx, PHP-FPM, systemd, and Certbot configuration. This makes the small HMAC-authenticated operation allowlist, fixed binaries, argument validation, read-only application installation, and absence of a generic command endpoint critical controls. A future split into narrower privileged helpers would further reduce impact if the agent process were compromised.

The Node.js API runs with V8's `--jitless` option so systemd's `MemoryDenyWriteExecute` protection remains compatible with the runtime. This reduces API execution performance but avoids executable JIT memory in the public control-plane service. The service also retains `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem`, `ProtectHome`, `RestrictSUIDSGID`, and `LockPersonality`.

## Threat model and residual risk

Primary threats are credential stuffing, broken object authorization, malicious tenant code, path/symlink/archive traversal, command injection, dependency compromise, resource exhaustion, secret/log leakage, SSRF, WebSocket hijacking, and privileged-agent abuse. Critical production gaps remain: persistent/distributed throttling, TOTP and recovery codes, secret encryption, complete audit hash chaining, API token scopes/idempotency, per-tenant cgroups/quotas/AppArmor, malware scanning, websocket terminal isolation, database grants, backup restoration tests, and a Linux adversarial test environment.

Do not expose version 0.2.0 to untrusted tenants. Report vulnerabilities privately to the repository owner; include reproduction, impact, and affected version, but never include live credentials or customer data.
