# Manual Installation and Audit Guide

This describes the components installed by `installer/install.sh` so an administrator can audit or repair them. It is not a shortcut around the preflight checks.

1. Install Ubuntu 24.04 updates plus `nginx nodejs openssl ca-certificates curl git ufw fail2ban`; require Node.js 18+.
2. Create the non-login `lintech` service user and directories: `/opt/lintech-panel` (root-owned), `/etc/lintech-panel` (root:lintech 0750), `/var/lib/lintech-panel` (lintech 0750), `/var/log/lintech-panel`, `/var/backups/lintech-panel`, and `/run/lintech-panel`.
3. Copy the repository to `/opt/lintech-panel`, root-own it, and make it non-world-writable.
4. Create `/etc/lintech-panel/panel.env` with `LINTECH_HOST=127.0.0.1`, `LINTECH_PORT=8080`, and `LINTECH_DATA_FILE=/var/lib/lintech-panel/panel.json`; set root:lintech 0640.
5. Generate a 48-byte agent secret with OpenSSL at `/etc/lintech-panel/agent.secret`, root:lintech 0640.
6. Bootstrap exactly one administrator as the `lintech` user using `LINTECH_ADMIN_PASSWORD` in a protected environment. Never put the password in shell history or a unit file.
7. Install the three units from `deployment/systemd`, run `systemctl daemon-reload`, and inspect their sandbox properties.
8. Render `deployment/nginx/panel.conf` with the real hostname, enable it, run `nginx -t`, then reload only after success.
9. Configure TLS manually, then allow only SSH and Nginx through UFW. Do not expose port 8080, databases, worker, or agent.
10. Enable services and execute `scripts/doctor.js`.

The PostgreSQL migration is architectural in 0.1.0; the runnable API does not yet use it. MariaDB/PostgreSQL customer services, PHP runtimes, Python virtual environments, Node version management, Redis, phpMyAdmin, and pgAdmin are not installed. Any manual deployment claiming otherwise is inconsistent with this release.

