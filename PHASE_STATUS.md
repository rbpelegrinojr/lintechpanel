# LinTech Panel Phase Status

Last updated: 2026-09-13. This is the resume ledger for the Phase 0–36 master specification. Update it after every stable checkpoint. `PASS` means the phase's implemented scope has direct evidence; `PARTIAL` means useful integrated work exists but at least one explicit requirement remains; `FAIL` means no functional implementation; `NOT TESTED` means implementation may exist but required execution evidence does not.

## Stable checkpoints

| Commit | Milestone | Evidence |
|---|---|---|
| `51ef42b` | Idempotent Ubuntu installer recovery | Administrator-provided Ubuntu 24.04 install transcript: API health, Nginx validation, services, UFW |
| `d8d9794` | Role-aware core management | Local HTTP workflow and 14 tests |
| `0dcd8ec` | Transactional static-domain provisioning | Template/signing/authorization/concurrency tests; Ubuntu operation not yet validated |
| `264c443` | Customer Certbot/TLS automation | Template and API tests; real customer-domain ACME issuance not yet validated |
| `edd0c8d` | Isolated PHP-FPM sites | Generator/API tests; Ubuntu PHP-FPM provisioning not yet validated |
| `8d3f974` | Python WSGI manager | Generator/API tests; Ubuntu pip/Gunicorn/systemd provisioning not yet validated |
| `d0eb6d5` | Node.js manager | Generator/API tests; Ubuntu npm/systemd provisioning not yet validated |
| `da85794` | React/static atomic publishing | Build-tree/API tests; Ubuntu npm build/publication not yet validated |
| `d60f9b3` | Login, socket race, job diagnosis/retry | 33 local tests pass; Ubuntu retry required after installation |

## Requirement ledger

| Phase | Area | Status | Implemented evidence | Remaining work / proof required |
|---:|---|:---:|---|---|
| 0 | Architecture and threat model | PASS | `ARCHITECTURE.md`, `SECURITY.md`, trust boundaries, technology and isolation decisions | Revisit decisions as PostgreSQL and service split land |
| 1 | Core panel | PARTIAL | Authentication, hashed sessions, CSRF, RBAC, packages, user lifecycle, dashboard, randomized Linux identities | Forgotten-password/email verification, TOTP/recovery codes, persistent throttle, complete OS quotas and live Linux isolation tests |
| 2 | Domain, Nginx, SSL | PARTIAL | Owner-scoped create/enable/disable/delete, generated static/PHP/app configs, rollback, Certbot webroot, forced HTTPS, renewal hook | Explicit subdomain workflow, redirects, safe registered reverse proxies, certificate refresh monitoring, live Nginx/ACME rollback tests |
| 3 | PHP hosting | PARTIAL | PHP 8.3 install, isolated pools, safe limits, Nginx routing, generic/Laravel/CodeIgniter metadata | Multiple maintained versions, upload/Git/ZIP, Composer workflow, `.env`, Artisan/CodeIgniter actions, real framework tests |
| 4 | Python manager | PARTIAL | Python 3.12 venvs, Flask/Django/generic WSGI starters, Gunicorn units, resource limits, controls and health check | requirements/pyproject ingestion, upload/Git, encrypted environment variables, redeploy/history/log UI, live Flask/Django tests |
| 5 | Node.js manager | PARTIAL | Node 18 entrypoint validation, tenant npm install/build, systemd, Unix proxy, controls and health check | Supported non-EOL runtime strategy, environment variables, source deployment/history/logs and live tests |
| 6 | React/static hosting | PARTIAL | Static roots, real React/Vite starter, configured output, symlink/size checks, atomic publish/rollback | Upload/Git source, redeploy history, live build/publication/SSL test |
| 7 | Database management | FAIL | Conceptual PostgreSQL migration only | MariaDB/PostgreSQL lifecycle, users/password changes/grants, ownership tests, safe connection UI, protected phpMyAdmin/pgAdmin decision |
| 8 | File manager | PARTIAL | Confined list/read/write API and traversal tests | UI, upload/download/create/rename/move/copy/delete/search/permissions/archive operations, quotas and attack tests |
| 9 | Web IDE | FAIL | Secure file API can be reused | Monaco integration, tabs/search/replace/themes/shortcuts/save/autocomplete |
| 10 | Web terminal | FAIL | Architecture only | Authenticated WebSocket/PTTY gateway, tenant UID/cgroups, expiration/audit and adversarial tests |
| 11 | Email | FAIL | Documentation/architecture only | Encrypted SMTP configuration and delivery; hosted-mail decision/stack and external deliverability validation |
| 12 | Cron jobs | FAIL | Limit field only | CRUD UI/API, validated schedules, tenant crontab/systemd timers and resource restrictions |
| 13 | Git | FAIL | Git package installed | Clone/pull/branch/redeploy/history, encrypted credentials/SSH keys and redacted logs |
| 14 | Backups and restore | FAIL | Update code archive and DR design only | Tenant/database/account backup jobs, restic/retention/download, restore implementation and drills |
| 15 | Logs and monitoring | FAIL | Journald/Nginx paths designed | Tenant-scoped log UI, rotation/retention/redaction, CPU/RAM/disk/bandwidth/process/SSL metrics |
| 16 | Job queue | PARTIAL | Worker, statuses, progress, safe errors, cross-process lock, bounded retry and resource state updates | PostgreSQL transactional claiming, idempotency keys, cancellation, stale-running recovery, concurrency and long-job tests |
| 17 | Audit/security events | PARTIAL | Role-scoped audit events | Hash chaining, immutable persistence, dedicated security events, retention/export and tamper tests |
| 18 | Provisioning API | PARTIAL | Authenticated resource-specific JSON API and server-side authorization | Scoped API tokens, idempotency, pagination, OpenAPI, revocation and integration tests |
| 19 | Notifications | PARTIAL | Owner-scoped in-app notifications/read state | Job/security notifications, email/webhook channels, preferences, retry/redaction |
| 20 | Ubuntu installer | PARTIAL | Preflight, packages, accounts, services, Nginx, UFW, Fail2ban, admin, health and failure logs; one user-provided install success | Validate current socket/PHP/Python/Node/React build on fresh Ubuntu; database/runtime additions and full health checks |
| 21 | Installation documentation | PARTIAL | `docs/INSTALLATION.md` | Keep aligned with current install and capture clean-host evidence |
| 22 | Manual installation guide | PARTIAL | `docs/MANUAL_INSTALLATION.md` | Expand for newly added runtimes and future databases/migrations |
| 23 | Uninstaller | PARTIAL | Safe/default and strongly confirmed destructive modes | Validate runtime units/sites/cert hooks cleanup and preservation on Ubuntu |
| 24 | Update system | PARTIAL | Pre-update archive, service stop/start and doctor | Dependency/unit/hook installation, migrations, maintenance mode, automatic rollback and update tests |
| 25 | Disaster recovery/migration | PARTIAL | `docs/DISASTER_RECOVERY.md`, `docs/MIGRATION.md` | Implement complete backups/restores and rehearse cross-VPS migration |
| 26 | Security hardening | PARTIAL | CSP/headers, HMAC agent, fixed commands, validation, path defenses, service sandboxes, RBAC tests | Secret encryption, TOTP, quotas/AppArmor, SSRF/terminal/upload/database/backup review, Linux penetration testing |
| 27 | Automated tests | PARTIAL | Unit/API/security tests run with Node test runner | Worker/agent Linux integration, browser E2E, service rollback, databases, uploads, restore, terminal, load and installer matrix |
| 28 | Installation testing | PARTIAL | Administrator-provided Ubuntu install/reinstall evidence for earlier commits | Fresh Ubuntu matrix: conflicts, low resources, interruption, current dependencies and all service integrations |
| 29 | Performance/scaling | PARTIAL | Capacity estimates in `FINAL_REPORT.md` | Repeatable benchmarks, concurrency/load results and measured sizing |
| 30 | Admin experience | PARTIAL | Role-aware dashboard, users/packages/domains/apps/jobs/audit | Server/service/DB/backup/SSL/security health, usage charts, confirmations and sensitive-action reauthentication |
| 31 | Customer experience | PARTIAL | Responsive dashboard and implemented resource screens | Full requested navigation/features, accessibility audit and browser/mobile E2E |
| 32 | Reseller experience | PARTIAL | Linked-customer creation/management and authorization tests | Approved-plan assignment policy, aggregate usage and complete reseller E2E |
| 33 | Complete documentation | PARTIAL | Core manuals and application/security/operations documents exist | Synchronize every added feature; complete runtime, database, mail, backup, IDE and terminal guides |
| 34 | Free/open-source audit | PARTIAL | `docs/OPEN_SOURCE_AUDIT.md`, AGPLv3 project license | Add exact versions/licenses for newly introduced runtime dependencies and re-audit final stack |
| 35 | Production-readiness review | PARTIAL | Evidence-based table in `FINAL_REPORT.md` | Repeat after all implementations and external tests; never promote unverified areas |
| 36 | Final project report | PARTIAL | `FINAL_REPORT.md` exists with limitations and rating | Final synchronization and requirement-by-requirement evidence after remaining phases |

## Resume order

1. Validate the current hotfix on Ubuntu: agent socket ownership, retry `provision_user`, then retry `create_domain`.
2. Record the exact Ubuntu results and any job diagnostics here.
3. Implement Phase 7 database management with encrypted credentials and ownership isolation.
4. Continue Phases 8–19 in order, checkpointing code, tests, security findings, and documents.
5. Complete installer/update/uninstall/DR changes, then run the Phase 27–35 validation matrix.
6. Update `FINAL_REPORT.md`; mark the goal complete only when every explicit requirement has defensible evidence or is accurately classified with unavoidable external validation.
