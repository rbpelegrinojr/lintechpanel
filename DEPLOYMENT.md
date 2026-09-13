# Deployment

The supported target is a fresh Ubuntu Server 24.04 LTS x86_64 VPS. Version 0.2.0 may be installed for development using `installer/install.sh`; it is not approved for public multi-tenant production. Public ports are 22/TCP, 80/TCP, and 443/TCP. PostgreSQL, MariaDB, the API port 8080, worker, and agent socket must remain private.

DNS must point the panel hostname to the server before TLS issuance. Put a valid certificate on Nginx before entering credentials across a network. Verify services with `systemctl status lintech-api lintech-worker lintech-agent nginx` and run `LINTECH_URL=http://127.0.0.1:8080 node /opt/lintech-panel/scripts/doctor.js`.
