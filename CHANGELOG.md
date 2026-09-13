# Changelog

## Unreleased

- Repository: added `.gitignore` and line-ending rules, documented `config/`, `packaging/`, and the cross-component test hierarchy, and corrected the public clone URL.
- Licensing: replaced the abbreviated notice with the complete canonical AGPLv3 license text.
- Installer: fixed administrator bootstrap on Ubuntu's Node.js 18 package by importing `randomUUID` explicitly, and corrected the post-clone directory name in installation commands.
- Testing: added a Node.js 18/20/22 CI matrix and a regression test for identifier generation.


## 0.1.0 — 2026-09-13

Phase: architecture and secure development baseline.

- Added dependency-light panel API/UI, scrypt authentication, sessions, CSRF, login throttle, RBAC, tenant-scoped users/domains/jobs/files, security headers, audit records, and development persistence.
- Added local HMAC-authenticated privileged agent with fixed allowlisted operations and no generic command endpoint.
- Added worker/job state baseline, PostgreSQL conceptual migration, Ubuntu installer/update/safe-uninstall assets, Nginx and hardened systemd templates, and doctor command.
- Added unit/API/security tests and complete architecture, security, deployment, installation, operations, migration, licensing, and readiness documentation.
- Security: path/symlink/archive traversal guards, request limits, constant-time comparisons, safe process spawning, non-root public services.
- Known breaking/production limitations: JSON development storage; incomplete provisioners; no TLS automation, terminal, mail, database manager, backup runner, full quotas, or clean-Ubuntu execution evidence.
