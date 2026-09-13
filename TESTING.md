# Testing

Run:

```bash
npm run lint
npm test
```

The current 33-test suite covers password hashing and rotation, session revocation, package validation and quota enforcement, user/application lifecycle and failed-job recovery safeguards, reseller/customer isolation, dashboard/audit scoping, domain/SSL/PHP/Python/Node/React job ownership, Nginx HTTP/TLS, PHP-FPM, Gunicorn/Node systemd template safety, entrypoint/output traversal and build-symlink rejection, worker-agent HMAC payloads, bounded retry for pre-connect agent-socket failures, cross-process state locking, managed Linux-account idempotency, path and archive traversal, agent allowlisting, login/CSRF enforcement, and role escalation denial. It does not execute privileged Nginx/Certbot/PHP-FPM/Gunicorn/Node/React activation or rollback on Linux, PostgreSQL/MariaDB grants, mail delivery, real project deployment, cgroups/OS quota enforcement, backup restoration, full browser automation, or a clean-host matrix. Those require disposable Ubuntu 24.04 VMs and are explicitly not claimed.
