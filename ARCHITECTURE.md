# LinTech Panel Architecture

## Status and decision record

Version 0.2.0 is a security-first core-management milestone, not a finished hosting panel. It uses a dependency-light Node.js 18+ API and worker so its security core can be tested without a package supply chain. The browser client is accessible HTML/CSS/JavaScript for the same reason. PostgreSQL is the selected production control-plane database; numbered migrations define the schema, while the runnable development build currently uses an atomic mode-0600 JSON store. PostgreSQL integration is therefore not complete.

MariaDB is the selected MySQL-compatible customer database. Native MySQL is omitted because co-installing it with MariaDB adds conflicts without a core capability benefit. PostgreSQL administration should use pgAdmin behind independent authentication; MariaDB administration may use phpMyAdmin. Neither GUI is installed in 0.2.0.

Systemd is selected over PM2 for application supervision because it provides native cgroup v2 controls, predictable privilege boundaries, journald integration, and no global JavaScript process-manager control plane. Redis/RabbitMQ are deferred: durable PostgreSQL jobs are preferred to reduce exposed services. The current worker uses the development store.

## Trust boundaries

```text
Browser -> Nginx :443 -> API (unprivileged lintech user)
                              |-> control DB / development store
                              |-> durable job records -> worker (unprivileged)
                              `-> HMAC + Unix socket -> agent (root, allowlist only)

Tenant traffic -> Nginx -> per-site PHP-FPM pool / per-app systemd unit / static root
```

The agent has no TCP listener. Requests are framed JSON, authenticated with an HMAC key readable only by root and the service group, validated against an operation-specific schema, and executed with fixed binaries plus argument arrays (`shell:false`). There is no generic command operation. The worker-to-agent client and Linux-user/static-domain provisioners are implemented; runtime, database, TLS, backup, and other provisioners remain outstanding.

## Identity, authorization, and isolation

Sessions are opaque 256-bit bearer tokens stored only as SHA-256 hashes, expire after eight hours, and require a per-session CSRF token for changes. Passwords use scrypt (N=32768, r=8, p=1, 64-byte output). Five failed logins trigger a 15-minute in-memory throttle. Production still needs distributed rate-limit state, password reset, email verification, and TOTP.

RBAC has super administrator, reseller, and customer roles. Resource queries scope by owner; reseller access is limited to customers linked by `resellerId`. Backend checks are authoritative. Linux tenant design uses one system account per customer, mode 0750 roots, per-site PHP-FPM identities, per-app systemd services, database-specific principals, quotas, and cgroup limits. Only the directory/user creation primitives exist today; the complete OS policy and isolation test lab remain outstanding.

## Data and secrets

The PostgreSQL conceptual model covers users, plans, sessions, domains, applications, jobs, notifications, and hash-chained audit events. Customer credentials and environment variables will be envelope-encrypted using a host key outside the database. The current build stores no SMTP, Git, database, or customer environment secrets. Agent secrets live at `/etc/lintech-panel/agent.secret` mode 0640. Logs must contain identifiers and redacted diagnostics, never request bodies or credentials.

## Deployment, backups, observability, updates

Ubuntu 24.04 uses Nginx, three systemd services, `/opt/lintech-panel` read-only application files, `/etc/lintech-panel` secrets/configuration, `/var/lib/lintech-panel` state, `/var/log/lintech-panel` logs, and `/var/backups/lintech-panel` backups. Updates take a pre-update application archive before replacement. A production backup design uses restic with encrypted optional S3-compatible storage plus native `pg_dump`/`mariadb-dump`; restore must be rehearsed on a separate host. Metrics should be collected from cgroup v2 and service health at bounded intervals. These backup and monitoring runners are designed but not implemented.

## Nginx configuration transaction

Static-site configuration is emitted from an owned template to a temporary file, atomically activated, syntax checked with `nginx -t`, reloaded, and rolled back if validation or reload fails. Existing activation paths are accepted only when they are symlinks to the expected panel-owned file. Raw customer Nginx text is never accepted. The SSL job uses Certbot webroot mode with validated fixed arguments, then activates a generated TLS template and records expiration; the Certbot deploy hook validates and reloads Nginx after renewal. Redirect, reverse-proxy, and explicit subdomain workflows remain outstanding, and real ACME issuance is externally unvalidated.

The JSON development store now uses an exclusive cross-process lock plus reload-before-mutation in the API and worker, preventing lost updates between those services. This is a reliability bridge, not the selected production database: PostgreSQL migrations, transactional claiming, persistent throttling, indexing, and operational backup are still required before production.
