# LinTech Panel 0.1.0 — Final Project Report

## 1. Executive summary

This repository started empty. Version 0.1.0 establishes a runnable, tested, security-first development baseline: browser dashboard, HTTP API, authentication/session/CSRF controls, backend RBAC, tenant-scoped users/domains/jobs/files, a strictly allowlisted local privileged agent, worker, PostgreSQL schema, Ubuntu installer assets, deployment hardening, and operations/security documentation.

It is **DEVELOPMENT READY**, not beta or production ready. The broad hosting feature set requested is represented in the architecture and roadmap, but unfinished functionality is reported as partial or fail—not as implemented merely because an endpoint or document exists.

## 2. Architecture and technology

Nginx proxies to an unprivileged dependency-light Node.js API. Durable operations are represented as jobs consumed by an unprivileged worker. Root-required operations cross an HMAC-authenticated Unix socket to an allowlisted agent with fixed binary/argument execution. Production persistence is designed for PostgreSQL; the executable 0.1 build still uses an atomic permission-restricted JSON store. Tenant workloads are designed around Linux identities, systemd/cgroups, isolated PHP-FPM pools, virtual environments, and database principals. See `ARCHITECTURE.md`.

## 3. Implemented and validated

- Scrypt password hashes; opaque hashed eight-hour sessions; CSRF; five-attempt login throttle; logout; safe error responses.
- Super administrator/reseller/customer roles, server-side authorization, reseller/customer boundaries, user create/list/suspend/unsuspend.
- Tenant-scoped domain records and job records; allowlisted job types; safe returned fields.
- Confined file list/read/write primitives with canonical path and symlink defenses and 1 MiB write/request limits.
- Agent authentication, operation allowlist, strict argument validation, safe spawn without shell interpolation, Linux user state/directory primitives, Nginx test/reload primitive.
- Responsive login/overview UI, security headers/CSP, audit-event baseline, initial PostgreSQL migration.
- Ubuntu preflight/install/update/safe-uninstall scripts, Nginx template, hardened systemd units, UFW defaults, and health command.

## 4. Partial and unimplemented features

Partial: authentication (no reset/email verification/TOTP/password-change UI), RBAC/user management (no delete/update/package enforcement), domains/Nginx/SSL (records and validation primitive only), static deployment (development runner only), file manager (list/read/write only), jobs/audit/notifications (schema/baseline, incomplete durable delivery and UI), provisioning architecture, installer/update/recovery, dashboard/admin/customer/reseller experience, documentation.

Unimplemented: working PHP/Laravel/CodeIgniter deployment; Python/Flask/Django/Gunicorn manager; Node application manager; React build/publish; MariaDB/PostgreSQL customer lifecycle and administration GUIs; Monaco IDE; xterm/PTTY gateway; transactional or hosted mail; cron and Git management; real backup/restore/retention; metrics/log UI; SSL issuance/renewal; encrypted secret vault; API tokens; quotas/cgroups/AppArmor enforcement; webhook/email notifications; signed update channel; hosted-mail stack.

## 5. Phase accounting

| Phase | Result | Evidence/limitation |
|---:|:---:|---|
| 0 | PASS | `ARCHITECTURE.md`, `SECURITY.md`, threat/isolation/deployment decisions |
| 1 | PARTIAL | Auth/RBAC/users/dashboard exist; packages, password lifecycle, OS orchestration incomplete |
| 2–7 | PARTIAL | Domain/job/schema architecture exists; actual Nginx/TLS/runtime/database provisioners absent |
| 8 | PARTIAL | Confined list/read/write; remaining file/archive operations absent |
| 9–15 | FAIL | IDE, terminal, mail, cron, Git, backups, monitoring not implemented |
| 16–19 | PARTIAL | Job/audit/notification structures; production queue/tokens/delivery absent |
| 20 | PARTIAL | Installer and units implemented but not executed on Ubuntu; customer stacks/TLS/DB omitted |
| 21–26 | PARTIAL | Install/manual/update/migration/DR/security docs and scripts; external drills absent |
| 27 | PARTIAL | 9 automated tests pass; complete unit/integration/e2e/security matrix absent |
| 28–32 | NOT TESTED/PARTIAL | No clean Ubuntu/performance lab; minimal role-specific UI only |
| 33–34 | PASS | Core documentation set and open-source audit present; guides disclose missing functions |
| 35 | PASS | Evidence-based review below; does not imply features pass |
| 36 | PASS | This report records exact status and residual risk |

## 6. Test evidence

Executed on Windows with Node.js 24.17.0 on 2026-09-13:

- `npm run lint`: PASS.
- `npm test`: PASS, 9 tests, 0 failures.
- Live `GET http://127.0.0.1:18080/api/health`: PASS, returned `{status:"ok",version:"0.1.0"}`.
- Ubuntu installer/systemd/Nginx/UFW: NOT TESTED (host is Windows).

Covered: scrypt verification, malformed domain rejection, archive traversal, path confinement, tenant ownership, agent allowlist/arguments, login/CSRF, role escalation, and cross-customer domain visibility. Not covered: real Linux users/permissions/cgroups, Nginx rollback, runtimes, databases, SSL, mail, backup restore, websocket terminal, load, browser E2E, or fresh-host installation.

## 7. Security review

| Area | Result | Notes |
|---|:---:|---|
| Authentication/session/CSRF | PARTIAL | Core controls tested; lifecycle, TOTP, persistent throttle absent |
| Authorization and basic object isolation | PASS | Backend checks and cross-customer test for implemented resources |
| File/path/archive safety | PARTIAL | Implemented primitives tested; full upload/archive engine absent |
| Command/agent boundary | PASS | No generic command API; allowlist and validation tested |
| Linux/process/resource/database isolation | NOT TESTED | Design and some unit configuration only |
| Secrets/audit/log safety | PARTIAL | Hashing/redaction principles; encrypted vault and hash chain absent |
| Backup/restore/update recovery | NOT TESTED | Docs/basic code backup only; no data restore drill |

No known critical flaw was left in the tested 0.1 surface. Residual risk remains too high for untrusted multi-tenant deployment.

## 8. Ubuntu installation

Supported target: fresh Ubuntu Server 24.04 LTS x86_64. Exact evaluation flow:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install git -y
git clone https://github.com/rbpelegrinojr/lintechpanel.git
cd lintech-panel
sudo bash installer/install.sh
```

Required public ports: 22/TCP, 80/TCP, 443/TCP. Do not expose 8080, database ports, worker, or the Unix agent socket. DNS must resolve before trusted TLS can be issued. The installer currently produces an HTTP evaluation endpoint and therefore requires manual TLS before remote credential entry.

## 9. VPS capacity guidance

Minimum for evaluation or roughly 10 light accounts: 2 vCPU, 4 GB RAM, 40 GB NVMe. Suggested starting points: 25 light accounts—4 vCPU/8 GB/100 GB; 50—8 vCPU/16 GB/200 GB; 100—12–16 vCPU/32 GB/400 GB; 250—24+ vCPU/64+ GB/1 TB plus separated database/backup capacity. Bandwidth should start around 1–5 TB/month depending on media and traffic. These are planning estimates only; real capacity depends far more on application workload, database intensity, caching, abuse, and latency than account count and must be load-tested.

## 10. Open-source and external validation

The project includes the complete AGPL-3.0-only license text and its planned core uses open-source Node.js, Nginx, PostgreSQL, MariaDB, systemd, PHP, Python/Gunicorn, Monaco, xterm.js, restic, and Certbot. It requires no commercial control-panel, database, or IDE license. Optional VPS, domain, storage, SMTP relay, DNS/CDN, and backup services may cost money.

External validation required: a disposable fresh Ubuntu 24.04 VM matrix; real DNS and Let's Encrypt; Hostinger/provider firewall and port restrictions; PostgreSQL/MariaDB grants; runtime deployments; SMTP delivery, port 25, PTR/rDNS, SPF/DKIM/DMARC, and reputation; off-host backup restore; cgroup/quota/AppArmor isolation; penetration/accessibility/load testing; update rollback and VPS migration drills.

## 11. Production-readiness rating

**DEVELOPMENT READY.** The core demonstrates enforceable security patterns and runs/tests locally, but the control-panel promise depends on numerous missing service integrations and Linux validation. Advancing to beta requires PostgreSQL-backed concurrency, complete tenant/runtime provisioners, TLS, quotas, encrypted secrets, restore drills, comprehensive e2e/security tests, and successful clean-host installation evidence.
