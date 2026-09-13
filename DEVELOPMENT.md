# Development

Use Node.js 18+ and do not place credentials in the repository. Modules are ES modules and the core deliberately has no third-party runtime dependency. Start with `npm run bootstrap -- <user> <email>`, then `npm start`; run the worker separately with `npm run worker`.

Every new privileged capability requires: a narrowly named operation, strict argument schema, fixed executable, argument-array invocation, authorization in the API, audit event, negative security test, and documentation. Never add a generic command runner. Every tenant resource must carry an owner and be filtered before serialization.

Database changes are append-only numbered SQL migrations. The JSON development adapter must not be presented as production storage. Keep `ARCHITECTURE.md`, `SECURITY.md`, `TESTING.md`, `ROADMAP.md`, `CHANGELOG.md`, and `FINAL_REPORT.md` synchronized.

