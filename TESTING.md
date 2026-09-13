# Testing

Run:

```bash
npm run lint
npm test
```

The current 19-test suite covers password hashing and rotation, session revocation, package validation and quota enforcement, user lifecycle safeguards, reseller/customer isolation, dashboard/audit scoping, domain lifecycle job ownership, Nginx template/input safety, worker-agent HMAC payloads, cross-process state locking, path and archive traversal, agent allowlisting, login/CSRF enforcement, and role escalation denial. It does not execute privileged Nginx activation/rollback on Linux, PostgreSQL/MariaDB grants, mail delivery, real application deployment, cgroups/OS quotas, backup restoration, full browser automation, or a clean-host matrix. Those require disposable Ubuntu 24.04 VMs and are explicitly not claimed.
