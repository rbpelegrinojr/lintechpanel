import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStaticSite, sitePaths, validateSite } from './nginx.js';

test('Nginx generator emits only validated owned paths', () => {
  const input = { siteId: 'dom_abc-123', domain: 'www.example.com', username: 'alice_1' };
  const config = renderStaticSite(input);
  assert.match(config, /server_name www\.example\.com;/);
  assert.match(config, /root \/home\/alice_1\/websites\/www\.example\.com\/public;/);
  assert.deepEqual(sitePaths(input), { available: '/etc/nginx/sites-available/lintech-dom_abc-123.conf', enabled: '/etc/nginx/sites-enabled/lintech-dom_abc-123.conf' });
});

test('Nginx generator rejects injection and traversal', () => {
  assert.throws(() => validateSite({ siteId: '../x', domain: 'example.com', username: 'alice' }));
  assert.throws(() => validateSite({ siteId: 'dom_ok', domain: 'example.com; include /etc/passwd', username: 'alice' }));
  assert.throws(() => validateSite({ siteId: 'dom_ok', domain: 'example.com', username: '../root' }));
});
