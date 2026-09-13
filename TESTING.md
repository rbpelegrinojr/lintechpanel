# Testing

Run:

```bash
npm run lint
npm test
```

The current suite covers password hashing and rotation, session revocation, package validation and quota enforcement, user lifecycle safeguards, reseller/customer isolation, dashboard/audit scoping, domain validation, path and archive traversal, agent allowlisting/argument validation, login/CSRF enforcement, role escalation denial, and cross-customer domain visibility. It does not validate Nginx activation/rollback, PostgreSQL/MariaDB grants, mail delivery, real application deployment, cgroups/OS quotas, backup restoration, full browser automation, or a clean-host matrix. Those require disposable Ubuntu 24.04 VMs and are explicitly not claimed.
