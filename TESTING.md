# Testing

Run:

```bash
npm run lint
npm test
```

The current suite covers password hashing, domain validation, path and archive traversal, tenant ownership, agent allowlisting/argument validation, login/CSRF enforcement, role escalation denial, and cross-customer domain visibility. It does not validate Ubuntu services, Nginx activation/rollback, PostgreSQL/MariaDB grants, TLS, mail delivery, real application deployment, cgroups/quotas, backup restoration, browsers, or clean-host installation. Those require disposable Ubuntu 24.04 VMs and are explicitly not claimed.

