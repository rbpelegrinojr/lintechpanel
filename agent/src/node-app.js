import path from 'node:path';
import { validateSite } from './nginx.js';

const APP_ID = /^[a-z][a-z0-9_-]{2,63}$/;
const ENTRY = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,126}\.(?:js|mjs|cjs)$/;

export function validateNodeApp(input) {
  const site = validateSite(input); const appId = String(input.appId || ''); const nodeVersion = String(input.nodeVersion || ''); const entrypoint = String(input.entrypoint || 'server.js');
  if (!APP_ID.test(appId)) throw new Error('invalid application id');
  if (nodeVersion !== '18') throw new Error('unsupported Node.js version');
  if (!ENTRY.test(entrypoint) || entrypoint.split('/').includes('..') || path.posix.isAbsolute(entrypoint)) throw new Error('invalid Node.js entrypoint');
  return { ...site, appId, nodeVersion, entrypoint };
}

export function nodeAppPaths(input, unitRoot = '/etc/systemd/system') {
  const { appId, username } = validateNodeApp(input); const root = `/home/${username}/applications/${appId}`;
  return { root, unit: path.posix.join(unitRoot, `lintech-app-${appId}.service`), service: `lintech-app-${appId}.service`, socket: `/run/lintech-app-${appId}/app.sock` };
}

export function renderNodeUnit(input) {
  const app = validateNodeApp(input); const paths = nodeAppPaths(app);
  const memoryMb = Number.isInteger(input.memoryMb) ? Math.min(Math.max(input.memoryMb, 64), 1_000_000) : 512;
  const cpuPercent = Number.isInteger(input.cpuPercent) ? Math.min(Math.max(input.cpuPercent, 1), 10_000) : 100;
  const processes = Number.isInteger(input.processes) ? Math.min(Math.max(input.processes, 4), 100_000) : 64;
  return `[Unit]\nDescription=LinTech Node.js application ${app.appId}\nAfter=network.target\n\n[Service]\nUser=${app.username}\nGroup=www-data\nWorkingDirectory=${paths.root}\nEnvironment=NODE_ENV=production\nEnvironment=LINTECH_SOCKET=${paths.socket}\nExecStart=/usr/bin/node ${paths.root}/${app.entrypoint}\nRestart=on-failure\nRestartSec=3\nRuntimeDirectory=lintech-app-${app.appId}\nRuntimeDirectoryMode=0750\nUMask=0007\nNoNewPrivileges=true\nPrivateTmp=true\nPrivateDevices=true\nProtectSystem=strict\nProtectHome=read-only\nReadWritePaths=${paths.root}\nProtectKernelTunables=true\nProtectKernelModules=true\nProtectControlGroups=true\nRestrictSUIDSGID=true\nRestrictAddressFamilies=AF_UNIX AF_INET AF_INET6\nMemoryMax=${memoryMb}M\nCPUQuota=${cpuPercent}%\nTasksMax=${processes}\n\n[Install]\nWantedBy=multi-user.target\n`;
}

function proxyLocations(appId) {
  return `    location / {\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection "upgrade";\n        proxy_pass http://unix:/run/lintech-app-${appId}/app.sock:;\n    }\n    location ~ /\\. { deny all; }`;
}

export function renderNodeSite(input, options = {}) {
  const { appId, domain, username } = validateNodeApp(input); const logs = `    access_log /home/${username}/logs/${domain}.access.log;\n    error_log /home/${username}/logs/${domain}.error.log warn;`;
  if (!options.tls) return `# Managed by LinTech Panel.\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name ${domain};\n${logs}\n${proxyLocations(appId)}\n}\n`;
  const root = `/home/${username}/websites/${domain}/public`; const challenge = `    root ${root};\n    location ^~ /.well-known/acme-challenge/ { try_files $uri =404; }`;
  const httpContent = options.forceHttps !== false ? `${challenge}\n    location / { return 301 https://$host$request_uri; }` : proxyLocations(appId);
  return `# Managed by LinTech Panel.\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name ${domain};\n${httpContent}\n}\nserver {\n    listen 443 ssl;\n    listen [::]:443 ssl;\n    server_name ${domain};\n    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_session_tickets off;\n    add_header Strict-Transport-Security "max-age=31536000" always;\n${logs}\n${proxyLocations(appId)}\n}\n`;
}

export function nodeStarter() {
  return `import http from 'node:http';\nimport fs from 'node:fs';\nconst socket = process.env.LINTECH_SOCKET;\nif (!socket) throw new Error('LINTECH_SOCKET is required');\ntry { fs.unlinkSync(socket); } catch (error) { if (error.code !== 'ENOENT') throw error; }\nhttp.createServer((request, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ status: 'ok', runtime: 'node' })); }).listen(socket);\n`;
}
