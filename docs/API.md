# API 0.1

JSON endpoints are rooted at `/api`. `POST /auth/login` returns an opaque bearer token and CSRF token. Send `Authorization: Bearer TOKEN`; send `X-CSRF-Token` on every non-GET authenticated request. Tokens expire after eight hours. Responses never return password hashes or job inputs.

Implemented endpoints: `GET /health`, `POST /auth/login`, `POST /auth/logout`, `GET /me`, `GET|POST /users`, `POST /users/:id/suspend`, `POST /users/:id/unsuspend`, `GET|POST /domains`, `GET|POST /jobs`, `GET /files/list?path=...`, `POST /files/read`, and `POST /files/write`.

There is no public arbitrary-command API. Provisioning tokens, OpenAPI output, pagination, delete/update endpoints, idempotency keys, password reset/TOTP, and production database transactions are not implemented in 0.1.0.

