# Installation on Ubuntu 24.04

> Version 0.1.0 is an evaluation build. Do not expose it to untrusted hosting customers.

## Requirements

- Fresh Ubuntu Server 24.04 LTS x86_64 with root/sudo and internet access
- Minimum 2 CPU cores, 4 GB RAM, and 40 GB SSD/NVMe; 4 cores and 8 GB RAM recommended
- A public IPv4/IPv6 address and an A/AAAA record for the panel hostname
- Public 22/TCP, 80/TCP, and 443/TCP; keep 8080 and all databases private

Prepare the host and DNS:

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
sudo hostnamectl set-hostname panel.example.com
```

Create `A panel VPS_PUBLIC_IP` at the DNS provider and wait for resolution. Then:

```bash
sudo apt install git -y
git clone https://github.com/rbpelegrinojr/lintechpanel.git
cd lintechpanel
sudo bash installer/install.sh
```

The installer asks for hostname, administrator email, username, and a non-echoed password. Non-interactive metadata is supported, but the password is intentionally not accepted as a command argument:

```bash
sudo bash installer/install.sh --hostname panel.example.com --admin-email admin@example.com --admin-user paneladmin --non-interactive
```

Set `LINTECH_ADMIN_PASSWORD` only from a protected automation environment if no TTY is available; remove it immediately afterward.

The installer is safe to rerun after a partial installation: it preserves an existing super administrator and agent secret, replaces application files, reloads units, and restarts panel services. The entered administrator password is ignored when an administrator already exists.

## Verification and first login

```bash
systemctl status nginx lintech-api lintech-worker lintech-agent
LINTECH_URL=http://127.0.0.1:8080 sudo node /opt/lintech-panel/scripts/doctor.js
sudo nginx -t
```

Before entering credentials remotely, install a trusted TLS certificate and configure the Nginx 443 listener. TLS automation is not implemented in 0.1.0. On first login, replace the bootstrap password when the password-change workflow becomes available; in this release, recreate the development data on a clean evaluation host instead. Do not use the bootstrap account for production.

## Initial security checklist

Confirm UFW exposes only intended ports, SSH uses keys, port 8080 binds to loopback, `/etc/lintech-panel` is not world-readable, agent has no TCP socket, backups are encrypted/off-host, and system time is synchronized. Enable provider snapshots but do not treat them as the only backup.

## Troubleshooting

Review `/var/log/lintech-panel/install.log`, `journalctl -u lintech-api -u lintech-worker -u lintech-agent`, and `/var/log/nginx/error.log`. The installer intentionally stops when it detects another control panel, insufficient resources, the wrong OS, or invalid Nginx configuration. See `docs/TROUBLESHOOTING.md`.
