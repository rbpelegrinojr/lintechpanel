import fs from 'node:fs/promises';
import path from 'node:path';
import { cleanDomain, cleanEmail, cleanText, cleanUsername, hashPassword, verifyPassword, token, tokenHash, publicUser, AuthError, ForbiddenError, InputError, NotFoundError } from './security.js';
import { ROLES, canManageUser, requireOwner, requireRole } from './rbac.js';
import { confinedPath } from './path-guard.js';
import { normalizeLimits } from './limits.js';

const json = (status, body, headers = {}) => ({ status, body, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const now = () => Date.now();
const timestamp = () => new Date().toISOString();
const WSGI_TARGET = /^[A-Za-z_][A-Za-z0-9_.]{0,127}:[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function createApplication(store, options = {}) {
  const roots = options.customerRoot || path.resolve('data/customers');
  const attempts = new Map();

  function authenticate(headers) {
    const raw = headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
    if (!raw) throw new AuthError();
    const session = store.data.sessions.find(item => item.tokenHash === tokenHash(raw) && item.expiresAt > now());
    if (!session) throw new AuthError('session expired or invalid');
    const user = store.data.users.find(item => item.id === session.userId && !item.suspended);
    if (!user) throw new AuthError();
    return { user, session };
  }

  function csrf(headers, session) {
    if (!headers['x-csrf-token'] || headers['x-csrf-token'] !== session.csrf) throw new ForbiddenError('invalid CSRF token');
  }

  function visibleUsers(actor) {
    if (actor.role === ROLES.SUPER_ADMIN) return store.data.users;
    if (actor.role === ROLES.RESELLER) return store.data.users.filter(item => item.resellerId === actor.id);
    return store.data.users.filter(item => item.id === actor.id);
  }

  function visibleResources(actor, resources) {
    if (actor.role === ROLES.SUPER_ADMIN) return resources;
    return resources.filter(item => item.ownerId === actor.id || (actor.role === ROLES.RESELLER && item.resellerId === actor.id));
  }

  function packageById(packageId, required = false) {
    const item = store.data.packages.find(candidate => candidate.id === packageId);
    if (required && !item) throw new InputError('hosting package does not exist');
    return item;
  }

  function assertQuota(owner, resource, current) {
    if (owner.role === ROLES.SUPER_ADMIN) return;
    const maximum = packageById(owner.packageId)?.limits?.[resource] ?? 0;
    if (current >= maximum) throw new ForbiddenError(`${resource} package limit reached`);
  }

  function enqueue(ownerId, type, input, resourceId = null, resellerId = null) {
    const job = { id: store.id('job'), ownerId, resellerId, resourceId, type, status: 'queued', progress: 0, input, safeLogs: [], createdAt: timestamp() };
    store.data.jobs.push(job);
    return job;
  }

  return async function handle({ method, pathname, headers = {}, body = {}, ip = 'unknown' }) {
    if (method === 'GET' && pathname === '/api/health') return json(200, { status: 'ok', version: '0.2.0' });
    if (method === 'POST' && pathname === '/api/auth/login') {
      const key = `${ip}:${String(body.username).toLowerCase()}`;
      const state = attempts.get(key) || { count: 0, until: 0 };
      if (state.until > now()) return json(429, { error: 'too many attempts' }, { 'retry-after': String(Math.ceil((state.until - now()) / 1000)) });
      const username = cleanUsername(body.username);
      const user = store.data.users.find(item => item.username === username);
      if (!user || user.suspended || !(await verifyPassword(body.password, user.passwordHash))) {
        state.count += 1;
        state.until = state.count >= 5 ? now() + 15 * 60_000 : 0;
        attempts.set(key, state);
        store.audit(user?.id || null, 'auth.login', username, 'failure', { ip }); await store.save();
        return json(401, { error: 'invalid credentials' });
      }
      attempts.delete(key);
      const accessToken = token();
      const session = { id: store.id('ses'), userId: user.id, tokenHash: tokenHash(accessToken), csrf: token(24), expiresAt: now() + 8 * 60 * 60_000, createdAt: timestamp() };
      store.data.sessions.push(session);
      store.audit(user.id, 'auth.login', user.id, 'success', { ip }); await store.save();
      return json(200, { accessToken, csrfToken: session.csrf, expiresAt: session.expiresAt, user: publicUser(user) }, { 'cache-control': 'no-store' });
    }

    const { user: actor, session } = authenticate(headers);
    if (method !== 'GET') csrf(headers, session);

    if (method === 'POST' && pathname === '/api/auth/logout') {
      store.data.sessions = store.data.sessions.filter(item => item.id !== session.id);
      store.audit(actor.id, 'auth.logout', actor.id); await store.save();
      return json(204, null);
    }
    if (method === 'GET' && pathname === '/api/me') return json(200, publicUser(actor));
    if (method === 'POST' && pathname === '/api/account/password') {
      if (!(await verifyPassword(body.currentPassword, actor.passwordHash))) throw new AuthError('current password is incorrect');
      actor.passwordHash = await hashPassword(body.newPassword);
      actor.mustChangePassword = false;
      store.data.sessions = store.data.sessions.filter(item => item.id === session.id);
      store.audit(actor.id, 'account.password_change', actor.id); await store.save();
      return json(204, null);
    }

    if (method === 'GET' && pathname === '/api/dashboard') {
      const users = visibleUsers(actor);
      const domains = visibleResources(actor, store.data.domains);
      const applications = visibleResources(actor, store.data.applications);
      const jobs = visibleResources(actor, store.data.jobs);
      const notifications = store.data.notifications.filter(item => item.ownerId === actor.id);
      const audit = store.data.audit.filter(item => actor.role === ROLES.SUPER_ADMIN || item.actorId === actor.id);
      return json(200, {
        counts: { users: users.length, suspendedUsers: users.filter(item => item.suspended).length, packages: actor.role === ROLES.SUPER_ADMIN ? store.data.packages.length : null, domains: domains.length, applications: applications.length, jobs: jobs.length, failedJobs: jobs.filter(item => item.status === 'failed').length, unreadNotifications: notifications.filter(item => !item.readAt).length },
        recentActivity: audit.slice(-8).reverse(),
        recentJobs: jobs.slice(-8).reverse().map(({ input, ...safe }) => safe)
      });
    }

    if (method === 'GET' && pathname === '/api/packages') {
      requireRole(actor, ROLES.SUPER_ADMIN, ROLES.RESELLER);
      return json(200, store.data.packages);
    }
    if (method === 'POST' && pathname === '/api/packages') {
      requireRole(actor, ROLES.SUPER_ADMIN);
      const name = cleanText(body.name, 'name', 80);
      if (store.data.packages.some(item => item.name.toLowerCase() === name.toLowerCase())) throw new InputError('package name already exists');
      const item = { id: store.id('pkg'), name, limits: normalizeLimits(body.limits || {}), createdAt: timestamp(), updatedAt: timestamp() };
      store.data.packages.push(item); store.audit(actor.id, 'package.create', item.id, 'success', { name }); await store.save();
      return json(201, item);
    }
    const packageMatch = pathname.match(/^\/api\/packages\/([^/]+)$/);
    if (packageMatch && method === 'PATCH') {
      requireRole(actor, ROLES.SUPER_ADMIN);
      const item = packageById(packageMatch[1], true);
      if (body.name !== undefined) {
        const name = cleanText(body.name, 'name', 80);
        if (store.data.packages.some(candidate => candidate.id !== item.id && candidate.name.toLowerCase() === name.toLowerCase())) throw new InputError('package name already exists');
        item.name = name;
      }
      if (body.limits !== undefined) item.limits = normalizeLimits({ ...item.limits, ...body.limits });
      item.updatedAt = timestamp(); store.audit(actor.id, 'package.update', item.id); await store.save();
      return json(200, item);
    }
    if (packageMatch && method === 'DELETE') {
      requireRole(actor, ROLES.SUPER_ADMIN);
      const item = packageById(packageMatch[1], true);
      if (store.data.users.some(user => user.packageId === item.id)) throw new InputError('package is assigned to users');
      store.data.packages = store.data.packages.filter(candidate => candidate.id !== item.id);
      store.audit(actor.id, 'package.delete', item.id, 'success', { name: item.name }); await store.save();
      return json(204, null);
    }

    if (method === 'GET' && pathname === '/api/users') {
      requireRole(actor, ROLES.SUPER_ADMIN, ROLES.RESELLER);
      return json(200, visibleUsers(actor).map(publicUser));
    }
    if (method === 'POST' && pathname === '/api/users') {
      requireRole(actor, ROLES.SUPER_ADMIN, ROLES.RESELLER);
      const role = body.role || ROLES.CUSTOMER;
      if (!Object.values(ROLES).includes(role) || (actor.role === ROLES.RESELLER && role !== ROLES.CUSTOMER) || role === ROLES.SUPER_ADMIN) throw new ForbiddenError('role assignment denied');
      const username = cleanUsername(body.username);
      const email = cleanEmail(body.email);
      if (store.data.users.some(item => item.username === username || item.email === email)) throw new InputError('username or email already exists');
      const packageId = role === ROLES.CUSTOMER && body.packageId ? packageById(body.packageId, true).id : null;
      const resellerId = actor.role === ROLES.RESELLER ? actor.id : (role === ROLES.CUSTOMER && body.resellerId ? body.resellerId : null);
      if (resellerId) {
        const reseller = store.data.users.find(item => item.id === resellerId && item.role === ROLES.RESELLER);
        if (!reseller || (actor.role !== ROLES.SUPER_ADMIN && reseller.id !== actor.id)) throw new ForbiddenError('reseller assignment denied');
      }
      const id = store.id('usr');
      const systemUsername = role === ROLES.CUSTOMER ? `lt_${id.slice(-12)}` : null;
      const created = { id, username, systemUsername, email, role, resellerId, packageId, suspended: false, mustChangePassword: true, systemStatus: role === ROLES.CUSTOMER ? 'queued' : 'not_required', passwordHash: await hashPassword(body.password), createdAt: timestamp(), updatedAt: timestamp() };
      store.data.users.push(created);
      if (role === ROLES.CUSTOMER) enqueue(created.id, 'provision_user', { userId: created.id, username: created.systemUsername }, created.id, resellerId);
      store.notify(created.id, 'account', 'Account created', 'Your LinTech Panel account is ready. Change the temporary password after signing in.');
      store.audit(actor.id, 'user.create', created.id, 'success', { role }); await store.save();
      return json(201, publicUser(created));
    }
    const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch && method === 'PATCH') {
      const subject = store.data.users.find(item => item.id === userMatch[1]);
      if (!subject) throw new NotFoundError();
      if (!canManageUser(actor, subject)) throw new ForbiddenError();
      if (body.email !== undefined) {
        const email = cleanEmail(body.email);
        if (store.data.users.some(item => item.id !== subject.id && item.email === email)) throw new InputError('email already exists');
        subject.email = email;
      }
      if (body.packageId !== undefined) {
        if (subject.role !== ROLES.CUSTOMER) throw new InputError('packages can only be assigned to customers');
        subject.packageId = body.packageId ? packageById(body.packageId, true).id : null;
      }
      subject.updatedAt = timestamp(); store.audit(actor.id, 'user.update', subject.id); await store.save();
      return json(200, publicUser(subject));
    }
    if (userMatch && method === 'DELETE') {
      const subject = store.data.users.find(item => item.id === userMatch[1]);
      if (!subject) throw new NotFoundError();
      if (!canManageUser(actor, subject) || subject.id === actor.id) throw new ForbiddenError();
      if (store.data.users.some(item => item.resellerId === subject.id)) throw new InputError('reassign reseller customers before deletion');
      if (store.data.domains.some(item => item.ownerId === subject.id) || store.data.jobs.some(item => item.ownerId === subject.id)) throw new InputError('remove owned resources before deleting user');
      store.data.users = store.data.users.filter(item => item.id !== subject.id);
      store.data.sessions = store.data.sessions.filter(item => item.userId !== subject.id);
      store.data.notifications = store.data.notifications.filter(item => item.ownerId !== subject.id);
      store.audit(actor.id, 'user.delete', subject.id, 'success', { username: subject.username }); await store.save();
      return json(204, null);
    }
    const userAction = pathname.match(/^\/api\/users\/([^/]+)\/(suspend|unsuspend|reset-password)$/);
    if (userAction && method === 'POST') {
      const subject = store.data.users.find(item => item.id === userAction[1]);
      if (!subject) throw new NotFoundError();
      if (!canManageUser(actor, subject) || actor.id === subject.id) throw new ForbiddenError();
      if (userAction[2] === 'reset-password') {
        subject.passwordHash = await hashPassword(body.newPassword); subject.mustChangePassword = true;
      } else {
        subject.suspended = userAction[2] === 'suspend';
      }
      subject.updatedAt = timestamp(); store.data.sessions = store.data.sessions.filter(item => item.userId !== subject.id);
      store.notify(subject.id, 'security', userAction[2] === 'reset-password' ? 'Password reset' : 'Account status changed', `An administrator performed ${userAction[2].replace('-', ' ')} on your account.`);
      store.audit(actor.id, `user.${userAction[2]}`, subject.id); await store.save();
      return json(200, publicUser(subject));
    }

    if (method === 'POST' && pathname === '/api/domains') {
      const domain = cleanDomain(body.domain);
      if (store.data.domains.some(item => item.name === domain)) throw new InputError('domain already exists');
      const ownerId = body.ownerId || actor.id;
      const owner = store.data.users.find(item => item.id === ownerId);
      if (!owner) throw new NotFoundError('owner not found');
      if (ownerId !== actor.id && !canManageUser(actor, owner)) throw new ForbiddenError();
      if (owner.role !== ROLES.CUSTOMER) throw new InputError('domains must belong to a customer account');
      assertQuota(owner, 'domains', store.data.domains.filter(item => item.ownerId === ownerId).length);
      const record = { id: store.id('dom'), name: domain, ownerId, resellerId: owner.resellerId || null, type: 'static', enabled: true, status: 'queued', ssl: 'pending', createdAt: timestamp() };
      store.data.domains.push(record);
      enqueue(ownerId, 'create_domain', { siteId: record.id, domain: record.name, username: owner.systemUsername || owner.username }, record.id, record.resellerId);
      store.notify(ownerId, 'domain', 'Domain added', `${domain} was accepted and is awaiting provisioning.`);
      store.audit(actor.id, 'domain.create', record.id, 'success', { domain }); await store.save();
      return json(202, record);
    }
    if (method === 'GET' && pathname === '/api/domains') return json(200, visibleResources(actor, store.data.domains));
    const domainAction = pathname.match(/^\/api\/domains\/([^/]+)\/(enable|disable)$/);
    if (domainAction && method === 'POST') {
      const record = store.data.domains.find(item => item.id === domainAction[1]);
      if (!record) throw new NotFoundError();
      requireOwner(actor, record);
      if (['queued', 'deleting'].includes(record.status)) throw new InputError('domain operation already in progress');
      const owner = store.data.users.find(item => item.id === record.ownerId);
      if (!owner) throw new NotFoundError('owner not found');
      record.status = 'queued'; record.enabled = domainAction[2] === 'enable';
      enqueue(record.ownerId, `${domainAction[2]}_domain`, { siteId: record.id, domain: record.name, username: owner.systemUsername || owner.username }, record.id, record.resellerId);
      store.audit(actor.id, `domain.${domainAction[2]}`, record.id); await store.save();
      return json(202, record);
    }
    const domainMatch = pathname.match(/^\/api\/domains\/([^/]+)$/);
    if (domainMatch && method === 'DELETE') {
      const record = store.data.domains.find(item => item.id === domainMatch[1]);
      if (!record) throw new NotFoundError();
      requireOwner(actor, record);
      if (['queued', 'deleting'].includes(record.status)) throw new InputError('domain operation already in progress');
      if (store.data.applications.some(item => item.domainId === record.id)) throw new InputError('delete the domain application first');
      const owner = store.data.users.find(item => item.id === record.ownerId);
      if (!owner) throw new NotFoundError('owner not found');
      record.status = 'deleting';
      enqueue(record.ownerId, 'delete_domain', { siteId: record.id, domain: record.name, username: owner.systemUsername || owner.username }, record.id, record.resellerId);
      store.audit(actor.id, 'domain.delete_requested', record.id); await store.save();
      return json(202, record);
    }
    const sslAction = pathname.match(/^\/api\/domains\/([^/]+)\/ssl$/);
    if (sslAction && method === 'POST') {
      const record = store.data.domains.find(item => item.id === sslAction[1]);
      if (!record) throw new NotFoundError();
      requireOwner(actor, record);
      if (record.status !== 'active') throw new InputError('domain must be active before issuing SSL');
      if (store.data.jobs.some(item => item.resourceId === record.id && item.type === 'issue_ssl' && ['queued', 'running'].includes(item.status))) throw new InputError('SSL operation already in progress');
      const owner = store.data.users.find(item => item.id === record.ownerId);
      if (!owner) throw new NotFoundError('owner not found');
      const acmeEmail = store.data.users.find(item => item.role === ROLES.SUPER_ADMIN)?.email;
      if (!acmeEmail) throw new InputError('administrator email is required for SSL issuance');
      const application = store.data.applications.find(item => item.domainId === record.id && ['php', 'python', 'node'].includes(item.kind));
      if (application && application.status !== 'active') throw new InputError('application provisioning must finish before issuing SSL');
      record.ssl = 'queued';
      const runtimeInput = application?.kind === 'php' ? { kind: 'php', appId: application.id, phpVersion: application.runtime.replace('php-', ''), framework: application.framework }
        : application?.kind === 'python' ? { kind: 'python', appId: application.id, pythonVersion: application.runtime.replace('python-', ''), framework: application.framework, startup: application.startup }
          : application?.kind === 'node' ? { kind: 'node', appId: application.id, nodeVersion: application.runtime.replace('node-', ''), entrypoint: application.entrypoint } : {};
      enqueue(record.ownerId, 'issue_ssl', { siteId: record.id, domain: record.name, username: owner.systemUsername || owner.username, email: acmeEmail, forceHttps: body.forceHttps !== false, ...runtimeInput }, record.id, record.resellerId);
      store.audit(actor.id, 'domain.ssl_requested', record.id); await store.save();
      return json(202, record);
    }

    if (method === 'GET' && pathname === '/api/applications') return json(200, visibleResources(actor, store.data.applications));
    if (method === 'POST' && pathname === '/api/applications') {
      if (!['php', 'python', 'node'].includes(body.kind)) throw new InputError('unsupported application type');
      const domain = store.data.domains.find(item => item.id === body.domainId);
      if (!domain) throw new NotFoundError('domain not found');
      requireOwner(actor, domain);
      if (domain.status !== 'active') throw new InputError('domain must be active before creating an application');
      if (domain.ssl === 'queued') throw new InputError('SSL provisioning must finish before creating an application');
      if (store.data.applications.some(item => item.domainId === domain.id)) throw new InputError('domain already has an application');
      const owner = store.data.users.find(item => item.id === domain.ownerId);
      if (!owner || owner.role !== ROLES.CUSTOMER) throw new InputError('application owner must be a customer');
      const quota = body.kind === 'php' ? 'phpSites' : body.kind === 'python' ? 'pythonApps' : 'nodeApps';
      assertQuota(owner, quota, store.data.applications.filter(item => item.ownerId === owner.id && item.kind === body.kind).length);
      if (body.kind === 'php' && body.phpVersion !== '8.3') throw new InputError('unsupported PHP version');
      if (body.kind === 'php' && !['generic', 'laravel', 'codeigniter'].includes(body.framework)) throw new InputError('unsupported PHP framework');
      if (body.kind === 'python' && body.pythonVersion !== '3.12') throw new InputError('unsupported Python version');
      if (body.kind === 'python' && !['flask', 'django', 'generic_wsgi'].includes(body.framework)) throw new InputError('unsupported Python framework');
      if (body.kind === 'node' && body.nodeVersion !== '18') throw new InputError('unsupported Node.js version');
      const entrypoint = body.kind === 'node' ? String(body.entrypoint || 'server.js') : null;
      if (entrypoint && (!/^[A-Za-z0-9_][A-Za-z0-9_./-]{0,126}\.(?:js|mjs|cjs)$/.test(entrypoint) || entrypoint.split('/').includes('..'))) throw new InputError('invalid Node.js entrypoint');
      const defaultStartup = body.framework === 'django' ? 'lintech_project.wsgi:application' : 'wsgi:app';
      const startup = body.kind === 'python' ? String(body.startup || defaultStartup) : null;
      if (startup && !WSGI_TARGET.test(startup)) throw new InputError('invalid WSGI startup target');
      const runtime = body.kind === 'php' ? `php-${body.phpVersion}` : body.kind === 'python' ? `python-${body.pythonVersion}` : `node-${body.nodeVersion}`;
      const application = { id: store.id('app'), ownerId: owner.id, resellerId: domain.resellerId, domainId: domain.id, name: domain.name, kind: body.kind, runtime, framework: body.framework || null, startup, entrypoint, status: 'queued', createdAt: timestamp(), updatedAt: timestamp() };
      store.data.applications.push(application);
      const common = { appId: application.id, siteId: domain.id, domain: domain.name, username: owner.systemUsername || owner.username, framework: body.framework, tls: domain.ssl === 'active', forceHttps: domain.forceHttps !== false };
      const resources = { memoryMb: packageById(owner.packageId)?.limits.memoryMb, cpuPercent: packageById(owner.packageId)?.limits.cpuPercent, processes: packageById(owner.packageId)?.limits.processes };
      const jobInput = body.kind === 'php' ? { ...common, phpVersion: body.phpVersion } : body.kind === 'python' ? { ...common, pythonVersion: body.pythonVersion, startup, ...resources } : { ...common, nodeVersion: body.nodeVersion, entrypoint, ...resources };
      enqueue(owner.id, body.kind === 'php' ? 'create_php_site' : body.kind === 'python' ? 'create_python_app' : 'create_node_app', jobInput, application.id, domain.resellerId);
      store.audit(actor.id, 'application.create', application.id, 'success', { kind: body.kind, framework: body.framework }); await store.save();
      return json(202, application);
    }
    const applicationMatch = pathname.match(/^\/api\/applications\/([^/]+)$/);
    if (applicationMatch && method === 'DELETE') {
      const application = store.data.applications.find(item => item.id === applicationMatch[1]);
      if (!application) throw new NotFoundError();
      requireOwner(actor, application);
      if (['queued', 'deleting'].includes(application.status)) throw new InputError('application operation already in progress');
      const domain = store.data.domains.find(item => item.id === application.domainId);
      const owner = store.data.users.find(item => item.id === application.ownerId);
      if (!domain || !owner) throw new NotFoundError('application resources are incomplete');
      application.status = 'deleting'; application.updatedAt = timestamp();
      const common = { appId: application.id, siteId: domain.id, domain: domain.name, username: owner.systemUsername || owner.username, framework: application.framework, tls: domain.ssl === 'active', forceHttps: domain.forceHttps !== false };
      const jobInput = application.kind === 'php' ? { ...common, phpVersion: application.runtime.replace('php-', '') } : application.kind === 'python' ? { ...common, pythonVersion: application.runtime.replace('python-', ''), startup: application.startup } : { ...common, nodeVersion: application.runtime.replace('node-', ''), entrypoint: application.entrypoint };
      enqueue(owner.id, application.kind === 'php' ? 'delete_php_site' : application.kind === 'python' ? 'delete_python_app' : 'delete_node_app', jobInput, application.id, application.resellerId);
      store.audit(actor.id, 'application.delete_requested', application.id); await store.save();
      return json(202, application);
    }
    const applicationAction = pathname.match(/^\/api\/applications\/([^/]+)\/(start|stop|restart)$/);
    if (applicationAction && method === 'POST') {
      const application = store.data.applications.find(item => item.id === applicationAction[1]);
      if (!application) throw new NotFoundError();
      requireOwner(actor, application);
      if (!['python', 'node'].includes(application.kind)) throw new InputError('process controls apply only to Python and Node.js applications');
      if (['queued', 'deleting'].includes(application.status)) throw new InputError('application operation already in progress');
      const domain = store.data.domains.find(item => item.id === application.domainId); const owner = store.data.users.find(item => item.id === application.ownerId);
      if (!domain || !owner) throw new NotFoundError('application resources are incomplete');
      application.status = 'queued'; application.updatedAt = timestamp();
      const common = { appId: application.id, siteId: domain.id, domain: domain.name, username: owner.systemUsername || owner.username, action: applicationAction[2] };
      const jobInput = application.kind === 'python' ? { ...common, pythonVersion: application.runtime.replace('python-', ''), framework: application.framework, startup: application.startup } : { ...common, nodeVersion: application.runtime.replace('node-', ''), entrypoint: application.entrypoint };
      enqueue(owner.id, application.kind === 'python' ? 'control_python_app' : 'control_node_app', jobInput, application.id, application.resellerId);
      store.audit(actor.id, `application.${applicationAction[2]}`, application.id); await store.save(); return json(202, application);
    }

    if (method === 'POST' && pathname === '/api/jobs') {
      const allowed = ['deploy_php', 'deploy_python', 'deploy_node', 'deploy_static', 'issue_ssl', 'backup', 'restore', 'git_pull'];
      if (!allowed.includes(body.type)) throw new InputError('job type is not allowed');
      const job = { id: store.id('job'), ownerId: actor.id, resellerId: actor.resellerId || null, type: body.type, status: 'queued', progress: 0, input: body.input || {}, safeLogs: [], createdAt: timestamp() };
      store.data.jobs.push(job); store.audit(actor.id, 'job.create', job.id, 'success', { type: job.type }); await store.save();
      return json(202, { ...job, input: undefined });
    }
    if (method === 'GET' && pathname === '/api/jobs') return json(200, visibleResources(actor, store.data.jobs).map(({ input, ...safe }) => safe));

    if (method === 'GET' && pathname === '/api/audit') {
      const visible = actor.role === ROLES.SUPER_ADMIN ? store.data.audit : store.data.audit.filter(item => item.actorId === actor.id);
      return json(200, visible.slice(-200).reverse());
    }
    if (method === 'GET' && pathname === '/api/notifications') return json(200, store.data.notifications.filter(item => item.ownerId === actor.id).slice(-100).reverse());
    const notificationMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (notificationMatch && method === 'POST') {
      const item = store.data.notifications.find(candidate => candidate.id === notificationMatch[1] && candidate.ownerId === actor.id);
      if (!item) throw new NotFoundError();
      item.readAt = timestamp(); await store.save(); return json(200, item);
    }

    const fileMatch = pathname.match(/^\/api\/files\/(list|read|write)$/);
    if (fileMatch) {
      const root = path.join(roots, actor.id);
      await fs.mkdir(root, { recursive: true });
      if (fileMatch[1] === 'list' && method === 'GET') {
        const target = await confinedPath(root, body.path || '.', { mustExist: true });
        return json(200, await fs.readdir(target, { withFileTypes: true }).then(items => items.map(item => ({ name: item.name, directory: item.isDirectory() }))));
      }
      if (fileMatch[1] === 'read' && method === 'POST') {
        const target = await confinedPath(root, body.path, { mustExist: true });
        return json(200, { content: await fs.readFile(target, 'utf8') });
      }
      if (fileMatch[1] === 'write' && method === 'POST') {
        if (typeof body.content !== 'string' || Buffer.byteLength(body.content, 'utf8') > 1024 * 1024) throw new InputError('content must be a string no larger than 1 MiB');
        const target = await confinedPath(root, body.path);
        await fs.writeFile(target, body.content, { flag: body.overwrite ? 'w' : 'wx' });
        store.audit(actor.id, 'file.write', body.path); await store.save(); return json(200, { saved: true });
      }
    }
    throw new NotFoundError();
  };
}
