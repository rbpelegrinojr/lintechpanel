import path from 'node:path';
import { validateSite } from './nginx.js';

const APP_ID = /^[a-z][a-z0-9_-]{2,63}$/;
const MODULE = /^[A-Za-z_][A-Za-z0-9_.]{0,127}:[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const FRAMEWORKS = new Set(['flask', 'django', 'generic_wsgi']);

export function validatePythonApp(input) {
  const site = validateSite(input);
  const appId = String(input.appId || '');
  const pythonVersion = String(input.pythonVersion || '');
  const framework = String(input.framework || '');
  const startup = String(input.startup || '');
  if (!APP_ID.test(appId)) throw new Error('invalid application id');
  if (pythonVersion !== '3.12') throw new Error('unsupported Python version');
  if (!FRAMEWORKS.has(framework)) throw new Error('unsupported Python framework');
  if (!MODULE.test(startup)) throw new Error('invalid WSGI startup target');
  return { ...site, appId, pythonVersion, framework, startup };
}

export function pythonPaths(input, unitRoot = '/etc/systemd/system') {
  const { appId, username } = validatePythonApp(input);
  const root = `/home/${username}/applications/${appId}`;
  return { root, venv: `${root}/venv`, unit: path.posix.join(unitRoot, `lintech-app-${appId}.service`), service: `lintech-app-${appId}.service`, socket: `/run/lintech-app-${appId}/app.sock` };
}

export function renderPythonUnit(input) {
  const app = validatePythonApp(input); const paths = pythonPaths(app);
  const memoryMb = Number.isInteger(input.memoryMb) ? Math.min(Math.max(input.memoryMb, 64), 1_000_000) : 512;
  const cpuPercent = Number.isInteger(input.cpuPercent) ? Math.min(Math.max(input.cpuPercent, 1), 10_000) : 100;
  const processes = Number.isInteger(input.processes) ? Math.min(Math.max(input.processes, 4), 100_000) : 64;
  return `[Unit]\nDescription=LinTech Python application ${app.appId}\nAfter=network.target\n\n[Service]\nUser=${app.username}\nGroup=www-data\nWorkingDirectory=${paths.root}\nEnvironment=PATH=${paths.venv}/bin:/usr/bin\nExecStart=${paths.venv}/bin/gunicorn --workers 2 --bind unix:${paths.socket} --access-logfile - --error-logfile - ${app.startup}\nRestart=on-failure\nRestartSec=3\nRuntimeDirectory=lintech-app-${app.appId}\nRuntimeDirectoryMode=0750\nUMask=0007\nNoNewPrivileges=true\nPrivateTmp=true\nPrivateDevices=true\nProtectSystem=strict\nProtectHome=read-only\nReadWritePaths=${paths.root}\nProtectKernelTunables=true\nProtectKernelModules=true\nProtectControlGroups=true\nRestrictSUIDSGID=true\nRestrictAddressFamilies=AF_UNIX AF_INET AF_INET6\nMemoryMax=${memoryMb}M\nCPUQuota=${cpuPercent}%\nTasksMax=${processes}\n\n[Install]\nWantedBy=multi-user.target\n`;
}

function proxyLocations(appId) {
  return `    location / {\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_pass http://unix:/run/lintech-app-${appId}/app.sock:;\n    }\n    location ~ /\\. { deny all; }`;
}

export function renderPythonSite(input, options = {}) {
  const { appId, domain, username } = validatePythonApp(input);
  const logs = `    access_log /home/${username}/logs/${domain}.access.log;\n    error_log /home/${username}/logs/${domain}.error.log warn;`;
  if (!options.tls) return `# Managed by LinTech Panel.\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name ${domain};\n${logs}\n${proxyLocations(appId)}\n}\n`;
  const root = `/home/${username}/websites/${domain}/public`;
  const challenge = `    root ${root};\n    location ^~ /.well-known/acme-challenge/ { try_files $uri =404; }`;
  const httpContent = options.forceHttps !== false ? `${challenge}\n    location / { return 301 https://$host$request_uri; }` : proxyLocations(appId);
  return `# Managed by LinTech Panel.\nserver {\n    listen 80;\n    listen [::]:80;\n    server_name ${domain};\n${httpContent}\n}\nserver {\n    listen 443 ssl;\n    listen [::]:443 ssl;\n    server_name ${domain};\n    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_session_tickets off;\n    add_header Strict-Transport-Security "max-age=31536000" always;\n${logs}\n${proxyLocations(appId)}\n}\n`;
}

export function starterSource(framework) {
  if (framework === 'flask') return `from flask import Flask\napp = Flask(__name__)\n\n@app.get("/")\ndef index():\n    return {"status": "ok", "runtime": "flask"}\n`;
  return `def app(environ, start_response):\n    body = b"LinTech Python application is running\\n"\n    start_response("200 OK", [("Content-Type", "text/plain; charset=utf-8"), ("Content-Length", str(len(body)))])\n    return [body]\n`;
}
