# LinTech Panel

LinTech Panel is an AGPL-licensed, provider-independent shared-hosting control-plane project for Ubuntu Server 24.04. Version 0.1.0 provides a runnable development dashboard/API, secure authentication primitives, backend RBAC, tenant-scoped domains/jobs/files, an allowlisted privileged agent, a basic worker, PostgreSQL schema, installer assets, and automated security tests.

It is **development ready**, not production ready. PHP/Python/Node deployment runners, databases, TLS automation, mail, terminal, IDE, backup/restore, quotas, and full Linux isolation are not complete.

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
cd lintech-panel
sudo bash installer/install.sh
```

The current installer results in an HTTP development deployment; TLS issuance and production hardening are external/manual in 0.1.0. See `docs/INSTALLATION.md` and `FINAL_REPORT.md` before use.
