import path from 'node:path';
import { validateSite } from './nginx.js';

const APP_ID = /^[a-z][a-z0-9_-]{2,63}$/;
const PHP_VERSIONS = new Set(['8.3']);
const FRAMEWORKS = new Set(['generic', 'laravel', 'codeigniter']);

export function validatePhpSite(input) {
  const site = validateSite(input);
  const appId = String(input.appId || '');
  const phpVersion = String(input.phpVersion || '');
  const framework = String(input.framework || 'generic');
  if (!APP_ID.test(appId)) throw new Error('invalid application id');
  if (!PHP_VERSIONS.has(phpVersion)) throw new Error('unsupported PHP version');
  if (!FRAMEWORKS.has(framework)) throw new Error('unsupported PHP framework');
  return { ...site, appId, phpVersion, framework };
}

export function phpPoolPath(input, root = '/etc/php') {
  const { appId, phpVersion } = validatePhpSite(input);
  return path.posix.join(root, phpVersion, 'fpm', 'pool.d', `lintech-${appId}.conf`);
}

export function renderPhpPool(input) {
  const { appId, username } = validatePhpSite(input);
  return `; Managed by LinTech Panel.\n[lintech-${appId}]\nuser = ${username}\ngroup = ${username}\nlisten = /run/php/lintech-${appId}.sock\nlisten.owner = www-data\nlisten.group = www-data\nlisten.mode = 0660\npm = ondemand\npm.max_children = 5\npm.process_idle_timeout = 10s\npm.max_requests = 500\nphp_admin_value[memory_limit] = 256M\nphp_admin_value[upload_max_filesize] = 32M\nphp_admin_value[post_max_size] = 32M\nphp_admin_value[max_execution_time] = 60\nphp_admin_flag[display_errors] = off\nphp_admin_flag[log_errors] = on\nphp_admin_value[error_log] = /home/${username}/logs/php-${appId}.log\n`;
}

function phpLocations(appId, root) {
  return `    root ${root};\n    index index.php index.html;\n    disable_symlinks if_not_owner from=$document_root;\n    location / { try_files $uri $uri/ /index.php?$query_string; }\n    location ~ \\.php$ {\n        try_files $uri =404;\n        include fastcgi_params;\n        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;\n        fastcgi_pass unix:/run/php/lintech-${appId}.sock;\n    }\n    location ~ /\\. { deny all; }`;
}

export function renderPhpSite(input, options = {}) {
  const { appId, domain, username } = validatePhpSite(input);
  const root = `/home/${username}/websites/${domain}/public`;
  const logs = `    access_log /home/${username}/logs/${domain}.access.log;\n    error_log /home/${username}/logs/${domain}.error.log warn;`;
  if (!options.tls) return `# Managed by LinTech Panel. Local edits may be replaced.\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name ${domain};\n${logs}\n${phpLocations(appId, root)}\n}\n`;
  const challenge = `    location ^~ /.well-known/acme-challenge/ { try_files $uri =404; }`;
  const httpContent = options.forceHttps !== false ? `    root ${root};\n${challenge}\n    location / { return 301 https://$host$request_uri; }` : `${phpLocations(appId, root)}\n${challenge}`;
  return `# Managed by LinTech Panel. Local edits may be replaced.\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name ${domain};\n${httpContent}\n}\nserver {\n    listen 443 ssl;\n    listen [::]:443 ssl;\n    server_name ${domain};\n    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_session_tickets off;\n    add_header Strict-Transport-Security "max-age=31536000" always;\n${logs}\n${phpLocations(appId, root)}\n}\n`;
}
