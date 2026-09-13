import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const USER = /^[a-z][a-z0-9_-]{2,31}$/;
const ID = /^[a-z][a-z0-9_-]{2,63}$/;

function assert(value, pattern, label) { if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`invalid ${label}`); return value; }
function run(binary, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { ...options, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', x => { if (stdout.length < 16_384) stdout += x; });
    child.stderr.on('data', x => { if (stderr.length < 16_384) stderr += x; });
    child.on('error', reject); child.on('close', code => code === 0 ? resolve({ stdout }) : reject(new Error(`${path.basename(binary)} failed (${code}): ${stderr.slice(0, 1000)}`)));
  });
}

export const schemas = Object.freeze({
  create_user: args => ({ username: assert(args.username, USER, 'username') }),
  suspend_user: args => ({ username: assert(args.username, USER, 'username') }),
  unsuspend_user: args => ({ username: assert(args.username, USER, 'username') }),
  create_customer_dirs: args => ({ userId: assert(args.userId, ID, 'user id'), username: assert(args.username, USER, 'username') }),
  nginx_test_reload: args => ({ siteId: assert(args.siteId, ID, 'site id') })
});

export function validateOperation(operation, args) {
  if (!Object.hasOwn(schemas, operation)) throw new Error('operation is not allowlisted');
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('arguments must be an object');
  return schemas[operation](args);
}

export async function executeOperation(operation, rawArgs, config = {}) {
  const args = validateOperation(operation, rawArgs);
  if (process.platform !== 'linux') throw new Error('privileged operations require Linux');
  if (operation === 'create_user') return run('/usr/sbin/useradd', ['--create-home', '--shell', '/bin/bash', '--user-group', args.username]);
  if (operation === 'suspend_user') return run('/usr/sbin/usermod', ['--lock', '--expiredate', '1', args.username]);
  if (operation === 'unsuspend_user') { await run('/usr/sbin/usermod', ['--unlock', '--expiredate', '-1', args.username]); return { ok: true }; }
  if (operation === 'create_customer_dirs') {
    const root = path.join(config.customerRoot || '/home', args.username);
    for (const name of ['websites', 'applications', 'logs', 'backups', 'tmp']) await fs.mkdir(path.join(root, name), { recursive: true, mode: 0o750 });
    await run('/usr/bin/chown', ['-R', `${args.username}:${args.username}`, root]); return { ok: true };
  }
  if (operation === 'nginx_test_reload') {
    await run('/usr/sbin/nginx', ['-t']); await run('/usr/bin/systemctl', ['reload', 'nginx']); return { ok: true };
  }
  throw new Error('operation unavailable');
}

