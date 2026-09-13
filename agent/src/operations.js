import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderStaticSite, sitePaths, validateSite } from './nginx.js';

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

async function ensureManagedSymlink(target, link) {
  try {
    await fs.symlink(target, link);
    return true;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const metadata = await fs.lstat(link);
    if (!metadata.isSymbolicLink()) throw new Error('existing Nginx activation path is not managed by LinTech Panel');
    const currentTarget = await fs.readlink(link);
    const resolved = path.resolve(path.dirname(link), currentTarget);
    if (resolved !== path.resolve(target)) throw new Error('existing Nginx activation path points to another site');
    return false;
  }
}

export const schemas = Object.freeze({
  create_user: args => ({ username: assert(args.username, USER, 'username') }),
  suspend_user: args => ({ username: assert(args.username, USER, 'username') }),
  unsuspend_user: args => ({ username: assert(args.username, USER, 'username') }),
  create_customer_dirs: args => ({ userId: assert(args.userId, ID, 'user id'), username: assert(args.username, USER, 'username') }),
  create_domain: args => validateSite(args),
  delete_domain: args => validateSite(args),
  enable_domain: args => validateSite(args),
  disable_domain: args => validateSite(args),
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
  if (operation === 'create_domain') {
    const documentRoot = path.join('/home', args.username, 'websites', args.domain, 'public');
    await fs.mkdir(documentRoot, { recursive: true, mode: 0o750 });
    await run('/usr/bin/chown', ['-R', `${args.username}:${args.username}`, path.join('/home', args.username, 'websites', args.domain)]);
    const locations = sitePaths(args, config.nginxRoot);
    const temporary = `${locations.available}.${process.pid}.tmp`;
    let previous = null;
    try { previous = await fs.readFile(locations.available, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.writeFile(temporary, renderStaticSite(args), { mode: 0o644, flag: 'wx' });
    await fs.rename(temporary, locations.available);
    let activationCreated = false;
    try {
      activationCreated = await ensureManagedSymlink(locations.available, locations.enabled);
      await run('/usr/sbin/nginx', ['-t']);
      await run('/usr/bin/systemctl', ['reload', 'nginx']);
      return { active: true };
    } catch (error) {
      if (activationCreated) await fs.rm(locations.enabled, { force: true });
      if (previous === null) await fs.rm(locations.available, { force: true }); else await fs.writeFile(locations.available, previous, { mode: 0o644 });
      throw error;
    } finally { await fs.rm(temporary, { force: true }); }
  }
  if (['delete_domain', 'disable_domain'].includes(operation)) {
    const locations = sitePaths(args, config.nginxRoot);
    const disabled = `${locations.enabled}.${process.pid}.disabled`;
    let existed = false;
    try { await fs.rename(locations.enabled, disabled); existed = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await run('/usr/sbin/nginx', ['-t']); await run('/usr/bin/systemctl', ['reload', 'nginx']); }
    catch (error) { if (existed) await fs.rename(disabled, locations.enabled); throw error; }
    await fs.rm(disabled, { force: true });
    if (operation === 'delete_domain') await fs.rm(locations.available, { force: true });
    return { active: false };
  }
  if (operation === 'enable_domain') {
    const locations = sitePaths(args, config.nginxRoot);
    await fs.access(locations.available);
    const activationCreated = await ensureManagedSymlink(locations.available, locations.enabled);
    try { await run('/usr/sbin/nginx', ['-t']); await run('/usr/bin/systemctl', ['reload', 'nginx']); }
    catch (error) { if (activationCreated) await fs.rm(locations.enabled, { force: true }); throw error; }
    return { active: true };
  }
  if (operation === 'nginx_test_reload') {
    await run('/usr/sbin/nginx', ['-t']); await run('/usr/bin/systemctl', ['reload', 'nginx']); return { ok: true };
  }
  throw new Error('operation unavailable');
}
