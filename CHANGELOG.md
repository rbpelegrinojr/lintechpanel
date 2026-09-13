# Changelog

## 0.1.0 — 2026-09-13

Phase: architecture and secure development baseline.

- Added dependency-light panel API/UI, scrypt authentication, sessions, CSRF, login throttle, RBAC, tenant-scoped users/domains/jobs/files, security headers, audit records, and development persistence.
- Added local HMAC-authenticated privileged agent with fixed allowlisted operations and no generic command endpoint.
- Added worker/job state baseline, PostgreSQL conceptual migration, Ubuntu installer/update/safe-uninstall assets, Nginx and hardened systemd templates, and doctor command.
- Added unit/API/security tests and complete architecture, security, deployment, installation, operations, migration, licensing, and readiness documentation.
- Security: path/symlink/archive traversal guards, request limits, constant-time comparisons, safe process spawning, non-root public services.
- Known breaking/production limitations: JSON development storage; incomplete provisioners; no TLS automation, terminal, mail, database manager, backup runner, full quotas, or clean-Ubuntu execution evidence.

