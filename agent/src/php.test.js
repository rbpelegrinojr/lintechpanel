import test from 'node:test';
import assert from 'node:assert/strict';
import { phpPoolPath, renderPhpPool, renderPhpSite, validatePhpSite } from './php.js';

const site = { appId: 'app_abc-123', siteId: 'dom_abc-123', domain: 'php.example.com', username: 'lt_0123456789ab', phpVersion: '8.3', framework: 'laravel' };

test('PHP generator creates isolated pool and fixed FastCGI socket', () => {
  assert.match(renderPhpPool(site), /user = lt_0123456789ab/);
  assert.match(renderPhpPool(site), /php_admin_value\[memory_limit\] = 256M/);
  assert.match(renderPhpSite(site), /fastcgi_pass unix:\/run\/php\/lintech-app_abc-123\.sock/);
  assert.equal(phpPoolPath(site), '/etc/php/8.3/fpm/pool.d/lintech-app_abc-123.conf');
});

test('PHP generator rejects unsupported versions and framework injection', () => {
  assert.throws(() => validatePhpSite({ ...site, phpVersion: '8.4' }), /unsupported PHP version/);
  assert.throws(() => validatePhpSite({ ...site, framework: 'laravel; id' }), /unsupported PHP framework/);
});

test('PHP TLS template keeps FastCGI routing behind HTTPS', () => {
  const config = renderPhpSite(site, { tls: true, forceHttps: true });
  assert.match(config, /listen 443 ssl;/);
  assert.match(config, /return 301 https:\/\/\$host\$request_uri;/);
  assert.match(config, /fastcgi_pass unix:\/run\/php\/lintech-app_abc-123\.sock/);
});
