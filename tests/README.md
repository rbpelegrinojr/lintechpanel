# Cross-component Tests

This tree is reserved for tests that cross service boundaries. Component-local tests currently remain beside their implementations:

- `backend/test/` — API, authentication, authorization, and path-isolation tests
- `agent/src/*.test.js` — privileged-operation validation tests

Node's built-in test runner discovers both locations through `npm test`.

