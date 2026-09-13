# Free/Open-Source Audit

| Component | Purpose | License | Open source | Status | Commercial dependency | Alternative |
|---|---|---:|:---:|---|---|---|
| LinTech Panel | Control plane | AGPL-3.0-only | Yes | Required | None | — |
| Node.js | API/worker/agent runtime | MIT | Yes | Required | None | Deno/Go |
| Nginx | Reverse proxy/static hosting | BSD-2-Clause | Yes | Required | None | Apache/Caddy |
| PostgreSQL | Production panel/customer DB target | PostgreSQL | Yes | Planned | None | MariaDB |
| MariaDB | MySQL-compatible customer DB target | GPL-2.0 | Yes | Planned | None | PostgreSQL |
| systemd | Service/cgroup management | LGPL-2.1-or-later | Yes | Required | None | OpenRC (unsupported) |
| PHP-FPM/Composer | PHP hosting | PHP/MIT | Yes | Planned | None | — |
| Gunicorn/Python | Python hosting | MIT/PSF | Yes | Planned | None | uWSGI |
| Monaco/xterm.js | IDE/terminal UI | MIT | Yes | Planned | None | CodeMirror/hterm |
| restic | Encrypted backups | BSD-2-Clause | Yes | Planned | Remote storage optional | rsync/Borg |
| Let's Encrypt/Certbot | TLS | ISRG/Apache-2.0 | Yes | Planned | None | acme.sh |

Core operation has no cPanel, Plesk, CloudLinux, LiteSpeed Enterprise, DirectAdmin, paid database, or paid IDE requirement. VPS, domains, object storage, SMTP relays, and DNS/CDN services can incur optional external charges.

