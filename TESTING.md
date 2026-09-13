# Testing

Run:

```bash
npm run lint
npm test
```

The current 26-test suite covers password hashing and rotation, session revocation, package validation and quota enforcement, user/application lifecycle safeguards, reseller/customer isolation, dashboard/audit scoping, domain/SSL/PHP/Python job ownership, Nginx HTTP/TLS, PHP-FPM, Gunicorn/systemd template safety, worker-agent HMAC payloads, cross-process state locking, path and archive traversal, agent allowlisting, login/CSRF enforcement, and role escalation denial. It does not execute privileged Nginx/Certbot/PHP-FPM/Gunicorn activation or rollback on Linux, PostgreSQL/MariaDB grants, mail delivery, real framework deployment, cgroups/OS quota enforcement, backup restoration, full browser automation, or a clean-host matrix. Those require disposable Ubuntu 24.04 VMs and are explicitly not claimed.
