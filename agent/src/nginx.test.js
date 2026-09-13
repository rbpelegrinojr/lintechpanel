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

test('TLS template uses fixed certificate paths and preserves ACME challenge access', () => {
  const config = renderStaticSite({ siteId: 'dom_tls', domain: 'secure.example.com', username: 'lt_0123456789ab' }, { tls: true, forceHttps: true });
  assert.match(config, /listen 443 ssl;/);
  assert.match(config, /\/etc\/letsencrypt\/live\/secure\.example\.com\/fullchain\.pem/);
  assert.match(config, /location \^~ \/\.well-known\/acme-challenge\//);
  assert.match(config, /return 301 https:\/\/\$host\$request_uri;/);
});
