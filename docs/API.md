# API 0.2

JSON endpoints are rooted at `/api`. `POST /auth/login` returns an opaque bearer token and CSRF token. Send `Authorization: Bearer TOKEN`; send `X-CSRF-Token` on every non-GET authenticated request. Tokens expire after eight hours. Responses never return password hashes or job inputs.

Implemented endpoints include authentication and account password changes; role-scoped dashboard, users, packages, domains, jobs, audit events, and notifications; and confined file list/read/write operations. User operations include create, update email/package, suspend, unsuspend, administrator password reset, and guarded deletion. Package operations include create, update, guarded delete, and customer domain-quota enforcement.

There is no public arbitrary-command API. Provisioning tokens, OpenAPI output, pagination, forgotten-password email flow, TOTP, and production database transactions are not implemented in 0.2.0.
