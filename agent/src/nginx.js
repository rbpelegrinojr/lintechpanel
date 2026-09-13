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

function staticLocations(home, domain) {
  return `    root ${home}/websites/${domain}/public;\n    index index.html;\n    access_log ${home}/logs/${domain}.access.log;\n    error_log ${home}/logs/${domain}.error.log warn;\n    location / {\n        try_files $uri $uri/ =404;\n    }\n    location ~ /\\. { deny all; }`;
}

export function renderStaticSite(input, options = {}) {
  const { domain, username } = validateSite(input);
  const home = `/home/${username}`;
  if (!options.tls) return `# Managed by LinTech Panel. Local edits may be replaced.\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name ${domain};\n${staticLocations(home, domain)}\n}\n`;
  const challenge = `    location ^~ /.well-known/acme-challenge/ { try_files $uri =404; }`;
  const httpContent = options.forceHttps !== false
    ? `    root ${home}/websites/${domain}/public;\n${challenge}\n    location / { return 301 https://$host$request_uri; }`
    : `${staticLocations(home, domain)}\n${challenge}`;
  return `# Managed by LinTech Panel. Local edits may be replaced.\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name ${domain};\n${httpContent}\n}\nserver {\n    listen 443 ssl;\n    listen [::]:443 ssl;\n    server_name ${domain};\n    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_session_tickets off;\n    add_header Strict-Transport-Security "max-age=31536000" always;\n${staticLocations(home, domain)}\n}\n`;
}

export function sitePaths(input, configRoot = '/etc/nginx') {
  const { siteId } = validateSite(input);
  const name = `lintech-${siteId}.conf`;
  return { available: path.posix.join(configRoot, 'sites-available', name), enabled: path.posix.join(configRoot, 'sites-enabled', name) };
}
