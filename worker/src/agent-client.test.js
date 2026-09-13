import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { retryableConnectionError, signedRequest } from './agent-client.js';

test('worker signs the exact agent payload', () => {
  const request = signedRequest('a'.repeat(48), 'create_user', { username: 'alice' }, 'request-1');
  const expected = createHmac('sha256', 'a'.repeat(48)).update(JSON.stringify({ id: 'request-1', operation: 'create_user', args: { username: 'alice' } })).digest('hex');
  assert.equal(request.mac, expected);
});

test('worker retries only pre-connect socket startup failures', () => {
  assert.equal(retryableConnectionError({ code: 'EACCES' }, false), true);
  assert.equal(retryableConnectionError({ code: 'ENOENT' }, false), true);
  assert.equal(retryableConnectionError({ code: 'ECONNRESET' }, false), false);
  assert.equal(retryableConnectionError({ code: 'EACCES' }, true), false);
});
