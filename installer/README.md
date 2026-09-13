# Installer

`install.sh` targets a fresh Ubuntu Server 24.04 x86_64 host. Read `docs/INSTALLATION.md` first. The installer refuses known pre-existing hosting panels, creates a non-login service user, installs systemd units, validates Nginx before reload, enables UFW, and runs the implemented health check. It does not issue TLS or install customer runtimes/databases in version 0.1.0.

