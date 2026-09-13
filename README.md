# LinTech Panel

LinTech Panel is an AGPL-licensed, provider-independent shared-hosting control-plane project for Ubuntu Server 24.04. Version 0.2.0 plus the current development changes provides a role-aware management dashboard/API, secure authentication, backend RBAC, hosting packages and domain quotas, user lifecycle operations, tenant-scoped domains/jobs/files, notifications, audit views, an allowlisted privileged agent, transactional static Nginx provisioning, PostgreSQL schema, installer assets, and automated security tests.

It is **development ready**, not production ready. Static/React, PHP, Python, Node, and customer-site TLS provisioning now have integrated development implementations, but require broader Ubuntu validation. Databases, mail, terminal, IDE, backup/restore, complete operating-system quota enforcement, and full Linux isolation are not complete.

See [`PHASE_STATUS.md`](PHASE_STATUS.md) for the durable Phase 0–36 completion ledger, evidence, remaining work, and resume order.

## Local development

Requires Node.js 18+.

```bash
export LINTECH_ADMIN_PASSWORD='use-a-unique-long-password'
npm run bootstrap -- admin admin@example.com
npm start
```

Open `http://127.0.0.1:8080`. Run `npm test` and `npm run lint` before changes. Development data is stored in `data/` and ignored by Git.

## Ubuntu installation

On a fresh Ubuntu 24.04 x86_64 server after DNS is configured:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install git -y
git clone https://github.com/rbpelegrinojr/lintechpanel.git
cd lintechpanel
sudo bash installer/install.sh
```

The installer deploys the current development release; TLS issuance remains external/manual in 0.2.0. See `docs/INSTALLATION.md` and `FINAL_REPORT.md` before use.
