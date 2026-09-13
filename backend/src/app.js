import fs from 'node:fs/promises';
import path from 'node:path';
import { cleanDomain, cleanEmail, cleanText, cleanUsername, hashPassword, verifyPassword, token, tokenHash, publicUser, AuthError, ForbiddenError, InputError, NotFoundError } from './security.js';
import { ROLES, canManageUser, requireOwner, requireRole } from './rbac.js';
import { confinedPath } from './path-guard.js';

const json = (status, body, headers = {}) => ({ status, body, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const now = () => Date.now();

export function createApplication(store, options = {}) {
  const roots = options.customerRoot || path.resolve('data/customers');
  const attempts = new Map();

  function authenticate(headers) {
    const raw = headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
    if (!raw) throw new AuthError();
    const session = store.data.sessions.find(x => x.tokenHash === tokenHash(raw) && x.expiresAt > now());
    if (!session) throw new AuthError('session expired or invalid');
    const user = store.data.users.find(x => x.id === session.userId && !x.suspended);
    if (!user) throw new AuthError();
    return { user, session };
  }

  function csrf(headers, session) {
    if (!headers['x-csrf-token'] || headers['x-csrf-token'] !== session.csrf) throw new ForbiddenError('invalid CSRF token');
  }

  return async function handle({ method, pathname, headers = {}, body = {}, ip = 'unknown' }) {
    if (method === 'GET' && pathname === '/api/health') return json(200, { status: 'ok', version: '0.1.0' });
    if (method === 'POST' && pathname === '/api/auth/login') {
      const key = `${ip}:${String(body.username).toLowerCase()}`;
      const state = attempts.get(key) || { count: 0, until: 0 };
      if (state.until > now()) return json(429, { error: 'too many attempts' }, { 'retry-after': String(Math.ceil((state.until - now()) / 1000)) });
      const username = cleanUsername(body.username);
      const user = store.data.users.find(x => x.username === username);
      if (!user || user.suspended || !(await verifyPassword(body.password, user.passwordHash))) {
        state.count += 1; state.until = state.count >= 5 ? now() + 15 * 60_000 : 0; attempts.set(key, state);
        store.audit(user?.id || null, 'auth.login', username, 'failure', { ip }); await store.save();
        return json(401, { error: 'invalid credentials' });
      }
      attempts.delete(key);
      const accessToken = token();
      const session = { id: store.id('ses'), userId: user.id, tokenHash: tokenHash(accessToken), csrf: token(24), expiresAt: now() + 8 * 60 * 60_000, createdAt: new Date().toISOString() };
      store.data.sessions.push(session); store.audit(user.id, 'auth.login', user.id, 'success', { ip }); await store.save();
      return json(200, { accessToken, csrfToken: session.csrf, expiresAt: session.expiresAt, user: publicUser(user) }, { 'cache-control': 'no-store' });
    }

    const { user: actor, session } = authenticate(headers);
    if (method !== 'GET') csrf(headers, session);
    if (method === 'POST' && pathname === '/api/auth/logout') {
      store.data.sessions = store.data.sessions.filter(x => x.id !== session.id); store.audit(actor.id, 'auth.logout', actor.id); await store.save();
      return json(204, null);
    }
    if (method === 'GET' && pathname === '/api/me') return json(200, publicUser(actor));

    if (method === 'GET' && pathname === '/api/users') {
      requireRole(actor, ROLES.SUPER_ADMIN, ROLES.RESELLER);
      const users = actor.role === ROLES.SUPER_ADMIN ? store.data.users : store.data.users.filter(x => x.resellerId === actor.id);
      return json(200, users.map(publicUser));
    }
    if (method === 'POST' && pathname === '/api/users') {
      requireRole(actor, ROLES.SUPER_ADMIN, ROLES.RESELLER);
      const role = body.role || ROLES.CUSTOMER;
      if (!Object.values(ROLES).includes(role) || (actor.role === ROLES.RESELLER && role !== ROLES.CUSTOMER)) throw new ForbiddenError('role assignment denied');
      const username = cleanUsername(body.username); const email = cleanEmail(body.email);
      if (store.data.users.some(x => x.username === username || x.email === email)) throw new InputError('username or email already exists');
      const created = { id: store.id('usr'), username, email, role, resellerId: actor.role === ROLES.RESELLER ? actor.id : (body.resellerId || null), packageId: body.packageId || null, suspended: false, passwordHash: await hashPassword(body.password), createdAt: new Date().toISOString() };
      store.data.users.push(created); store.audit(actor.id, 'user.create', created.id, 'success', { role }); await store.save();
      return json(201, publicUser(created));
    }
    const userMatch = pathname.match(/^\/api\/users\/([^/]+)\/(suspend|unsuspend)$/);
    if (method === 'POST' && userMatch) {
      const subject = store.data.users.find(x => x.id === userMatch[1]);
      if (!subject) throw new NotFoundError();
      if (!canManageUser(actor, subject) || actor.id === subject.id) throw new ForbiddenError();
      subject.suspended = userMatch[2] === 'suspend';
      store.data.sessions = store.data.sessions.filter(x => x.userId !== subject.id);
      store.audit(actor.id, `user.${userMatch[2]}`, subject.id); await store.save();
      return json(200, publicUser(subject));
    }

    if (method === 'POST' && pathname === '/api/domains') {
      const domain = cleanDomain(body.domain);
      if (store.data.domains.some(x => x.name === domain)) throw new InputError('domain already exists');
      const ownerId = body.ownerId || actor.id;
      if (ownerId !== actor.id) {
        const owner = store.data.users.find(x => x.id === ownerId); if (!owner || !canManageUser(actor, owner)) throw new ForbiddenError();
      }
      const record = { id: store.id('dom'), name: domain, ownerId, resellerId: actor.role === ROLES.RESELLER ? actor.id : null, type: 'static', enabled: true, ssl: 'pending', createdAt: new Date().toISOString() };
      store.data.domains.push(record); store.audit(actor.id, 'domain.create', record.id, 'success', { domain }); await store.save();
      return json(202, record);
    }
    if (method === 'GET' && pathname === '/api/domains') {
      const items = store.data.domains.filter(x => { try { requireOwner(actor, x); return true; } catch { return false; } });
      return json(200, items);
    }
    if (method === 'POST' && pathname === '/api/jobs') {
      const allowed = ['deploy_php', 'deploy_python', 'deploy_node', 'deploy_static', 'issue_ssl', 'backup', 'restore', 'git_pull'];
      if (!allowed.includes(body.type)) throw new InputError('job type is not allowed');
      const job = { id: store.id('job'), ownerId: actor.id, type: body.type, status: 'queued', progress: 0, input: body.input || {}, safeLogs: [], createdAt: new Date().toISOString() };
      store.data.jobs.push(job); store.audit(actor.id, 'job.create', job.id, 'success', { type: job.type }); await store.save();
      return json(202, { ...job, input: undefined });
    }
    if (method === 'GET' && pathname === '/api/jobs') return json(200, store.data.jobs.filter(x => actor.role === ROLES.SUPER_ADMIN || x.ownerId === actor.id).map(({ input, ...safe }) => safe));

    const fileMatch = pathname.match(/^\/api\/files\/(list|read|write)$/);
    if (fileMatch) {
      const root = path.join(roots, actor.id);
      await fs.mkdir(root, { recursive: true });
      if (fileMatch[1] === 'list' && method === 'GET') {
        const target = await confinedPath(root, body.path || '.', { mustExist: true });
        return json(200, await fs.readdir(target, { withFileTypes: true }).then(items => items.map(x => ({ name: x.name, directory: x.isDirectory() }))));
      }
      if (fileMatch[1] === 'read' && method === 'POST') {
        const target = await confinedPath(root, body.path, { mustExist: true });
        return json(200, { content: await fs.readFile(target, 'utf8') });
      }
      if (fileMatch[1] === 'write' && method === 'POST') {
        if (typeof body.content !== 'string' || Buffer.byteLength(body.content, 'utf8') > 1024 * 1024) throw new InputError('content must be a string no larger than 1 MiB');
        const content = body.content;
        const target = await confinedPath(root, body.path); await fs.writeFile(target, content, { flag: body.overwrite ? 'w' : 'wx' });
        store.audit(actor.id, 'file.write', body.path); await store.save(); return json(200, { saved: true });
      }
    }
    throw new NotFoundError();
  };
}
