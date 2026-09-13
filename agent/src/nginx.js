import path from 'node:path';

const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const USER = /^[a-z][a-z0-9_-]{2,31}$/;
const ID = /^[a-z][a-z0-9_-]{2,63}$/;

export function validateSite(input) {
  if (!input || typeof input !== 'object') throw new Error('site arguments must be an object');
  const siteId = String(input.siteId || '');
  const domain = String(input.domain || '').toLowerCase();
  const username = String(input.username || '');
  if (!ID.test(siteId)) throw new Error('invalid site id');
  if (!DOMAIN.test(domain)) throw new Error('invalid domain');
  if (!USER.test(username)) throw new Error('invalid username');
  return { siteId, domain, username };
}

export function renderStaticSite(input) {
  const { domain, username } = validateSite(input);
  const home = `/home/${username}`;
  return `# Managed by LinTech Panel. Local edits may be replaced.\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name ${domain};\n    root ${home}/websites/${domain}/public;\n    index index.html;\n    access_log ${home}/logs/${domain}.access.log;\n    error_log ${home}/logs/${domain}.error.log warn;\n    location / {\n        try_files $uri $uri/ =404;\n    }\n    location ~ /\\. { deny all; }\n}\n`;
}

export function sitePaths(input, configRoot = '/etc/nginx') {
  const { siteId } = validateSite(input);
  const name = `lintech-${siteId}.conf`;
  return { available: path.posix.join(configRoot, 'sites-available', name), enabled: path.posix.join(configRoot, 'sites-enabled', name) };
}
