# Changelog

## Unreleased

Phase: transactional static-domain provisioning milestone.

- Connected domain and Linux-user lifecycle requests to the unprivileged worker and HMAC-authenticated Unix-socket agent.
- Added validated static-site Nginx template generation, atomic activation, `nginx -t` before reload, rollback, enable/disable/delete operations, and protection against replacing foreign activation paths.
- Added customer-facing domain lifecycle controls and rejected overlapping operations.
- Added a cross-process state-file lock and reload-before-mutation protocol so API and worker writes do not silently overwrite each other while the PostgreSQL repository remains pending.
- Corrected agent-socket group access in systemd and added tests for Nginx input safety, signed agent requests, domain job scoping, and concurrent state updates.
- Validation: `npm run lint` passed; `npm test` passed 19 tests. Real privileged Nginx activation still requires disposable Ubuntu validation.

## 0.2.0 — 2026-09-13

Phase: core panel management milestone.

- Added a role-aware administrator, reseller, and customer dashboard with working navigation and responsive management screens.
- Added hosting-package CRUD and validated limits with secure-default customer domain quota enforcement.
- Added user create/update/suspend/unsuspend/password-reset/guarded-delete operations and reseller ownership boundaries.
- Added authenticated password changes with other-session revocation, notifications, dashboard summaries, and scoped audit views.
- Added the second PostgreSQL migration and expanded API/security coverage from 10 to 14 passing tests.
- Verified live HTTP login, dashboard, package creation, user creation, safe response serialization, and the hardened API health endpoint.
- Upgrade safety: installer reruns now preserve the existing LinTech Nginx virtual host and operator-managed Certbot TLS configuration.

- Repository: added `.gitignore` and line-ending rules, documented `config/`, `packaging/`, and the cross-component test hierarchy, and corrected the public clone URL.
- Licensing: replaced the abbreviated notice with the complete canonical AGPLv3 license text.
- Installer: fixed administrator bootstrap on Ubuntu's Node.js 18 package by importing `randomUUID` explicitly, corrected the post-clone directory name in installation commands, and made the API service use V8's JIT-less mode so the executable-memory systemd restriction can remain enabled.
- Testing: added a Node.js 18/20/22 CI matrix and a regression test for identifier generation.
- Installer: made health verification tolerate bounded service startup delay and emit service status, recent journals, and the underlying network error on persistent failure.
- Installer: made partial-install recovery idempotent by preserving an existing administrator and agent secret and restarting already-active services after updated units are installed.


## 0.1.0 — 2026-09-13

Phase: architecture and secure development baseline.

- Added dependency-light panel API/UI, scrypt authentication, sessions, CSRF, login throttle, RBAC, tenant-scoped users/domains/jobs/files, security headers, audit records, and development persistence.
- Added local HMAC-authenticated privileged agent with fixed allowlisted operations and no generic command endpoint.
- Added worker/job state baseline, PostgreSQL conceptual migration, Ubuntu installer/update/safe-uninstall assets, Nginx and hardened systemd templates, and doctor command.
- Added unit/API/security tests and complete architecture, security, deployment, installation, operations, migration, licensing, and readiness documentation.
- Security: path/symlink/archive traversal guards, request limits, constant-time comparisons, safe process spawning, non-root public services.
- Known breaking/production limitations: JSON development storage; incomplete provisioners; no TLS automation, terminal, mail, database manager, backup runner, full quotas, or clean-Ubuntu execution evidence.
