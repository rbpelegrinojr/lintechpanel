# API 0.2

JSON endpoints are rooted at `/api`. `POST /auth/login` returns an opaque bearer token and CSRF token. Send `Authorization: Bearer TOKEN`; send `X-CSRF-Token` on every non-GET authenticated request. Tokens expire after eight hours. Responses never return password hashes or job inputs.

Implemented endpoints include authentication and account password changes; role-scoped dashboard, users, packages, domains, jobs, audit events, and notifications; and confined file list/read/write operations. User operations include create, update email/package, suspend, unsuspend, administrator password reset, and guarded deletion. Package operations include create, update, guarded delete, and customer domain-quota enforcement. Domain operations include create, enable, disable, delete, and `POST /domains/:id/ssl` for owner-authorized queued Certbot issuance with forced HTTPS by default.

Jobs are created only by resource-specific operations. `POST /jobs/:id/retry` requeues an owner-authorized failed job, clears its prior execution state, restores the resource's provisioning state, and refuses more than five total attempts. Job inputs remain excluded from API responses; safe error details are returned for diagnosis.

There is no public arbitrary-command API. Provisioning tokens, OpenAPI output, pagination, forgotten-password email flow, TOTP, and production database transactions are not implemented in 0.2.0.
