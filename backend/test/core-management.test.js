import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Store } from '../src/store.js';
import { createApplication } from '../src/app.js';
import { hashPassword } from '../src/security.js';
import { ROLES } from '../src/rbac.js';

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lintech-core-'));
  const store = await new Store(path.join(dir, 'data.json')).load();
  store.data.users.push(
    { id: 'admin', username: 'admin', email: 'admin@example.com', role: ROLES.SUPER_ADMIN, suspended: false, passwordHash: await hashPassword('SecureAdminPass7') },
    { id: 'reseller', username: 'reseller', email: 'reseller@example.com', role: ROLES.RESELLER, suspended: false, passwordHash: await hashPassword('SecureReseller7') },
    { id: 'outside', username: 'outside', email: 'outside@example.com', role: ROLES.CUSTOMER, suspended: false, passwordHash: await hashPassword('SecureOutside77') }
  );
  return { dir, store, app: createApplication(store, { customerRoot: path.join(dir, 'customers') }) };
}

async function login(app, username, password) {
  const response = await app({ method: 'POST', pathname: '/api/auth/login', body: { username, password }, headers: {}, ip: username });
  return response.body;
}

const headers = auth => ({ authorization: `Bearer ${auth.accessToken}`, 'x-csrf-token': auth.csrfToken });

test('administrator creates packages and package quotas are enforced', async () => {
  const f = await fixture();
  const admin = await login(f.app, 'admin', 'SecureAdminPass7');
  const packageResponse = await f.app({ method: 'POST', pathname: '/api/packages', headers: headers(admin), body: { name: 'Starter', limits: { domains: 1, diskMb: 2048 } } });
  assert.equal(packageResponse.status, 201);
  const userResponse = await f.app({ method: 'POST', pathname: '/api/users', headers: headers(admin), body: { username: 'customer', email: 'customer@example.com', password: 'SecureCustomer7', packageId: packageResponse.body.id } });
  assert.equal(userResponse.body.systemUsername, undefined);
  assert.match(f.store.data.jobs.find(item => item.resourceId === userResponse.body.id).input.username, /^lt_[a-f0-9]{12}$/);
  const customer = await login(f.app, 'customer', 'SecureCustomer7');
  await f.app({ method: 'POST', pathname: '/api/domains', headers: headers(customer), body: { domain: 'one.example.com' } });
  await assert.rejects(f.app({ method: 'POST', pathname: '/api/domains', headers: headers(customer), body: { domain: 'two.example.com' } }), /limit reached/);
  assert.equal(userResponse.body.passwordHash, undefined);
  await fs.rm(f.dir, { recursive: true });
});

test('reseller can manage only linked customers', async () => {
  const f = await fixture();
  const admin = await login(f.app, 'admin', 'SecureAdminPass7');
  const reseller = await login(f.app, 'reseller', 'SecureReseller7');
  const created = await f.app({ method: 'POST', pathname: '/api/users', headers: headers(reseller), body: { username: 'linked', email: 'linked@example.com', password: 'SecureLinkedPass7' } });
  const suspended = await f.app({ method: 'POST', pathname: `/api/users/${created.body.id}/suspend`, headers: headers(reseller), body: {} });
  assert.equal(suspended.body.suspended, true);
  await assert.rejects(f.app({ method: 'POST', pathname: '/api/users/outside/suspend', headers: headers(reseller), body: {} }), /forbidden/);
  const users = await f.app({ method: 'GET', pathname: '/api/users', headers: { authorization: `Bearer ${reseller.accessToken}` } });
  assert.deepEqual(users.body.map(item => item.username), ['linked']);
  assert.ok(admin.accessToken);
  await fs.rm(f.dir, { recursive: true });
});

test('password changes revoke other sessions and notifications are owner scoped', async () => {
  const f = await fixture();
  const first = await login(f.app, 'outside', 'SecureOutside77');
  const second = await login(f.app, 'outside', 'SecureOutside77');
  const response = await f.app({ method: 'POST', pathname: '/api/account/password', headers: headers(first), body: { currentPassword: 'SecureOutside77', newPassword: 'ChangedOutside88' } });
  assert.equal(response.status, 204);
  await assert.rejects(f.app({ method: 'GET', pathname: '/api/me', headers: { authorization: `Bearer ${second.accessToken}` } }), /session expired/);
  assert.ok((await login(f.app, 'outside', 'ChangedOutside88')).accessToken);
  await fs.rm(f.dir, { recursive: true });
});

test('dashboard and audit responses are role scoped', async () => {
  const f = await fixture();
  const admin = await login(f.app, 'admin', 'SecureAdminPass7');
  const outsider = await login(f.app, 'outside', 'SecureOutside77');
  const dashboard = await f.app({ method: 'GET', pathname: '/api/dashboard', headers: { authorization: `Bearer ${admin.accessToken}` } });
  assert.equal(dashboard.body.counts.users, 3);
  const audit = await f.app({ method: 'GET', pathname: '/api/audit', headers: { authorization: `Bearer ${outsider.accessToken}` } });
  assert.ok(audit.body.every(item => item.actorId === 'outside'));
  await fs.rm(f.dir, { recursive: true });
});

test('domain lifecycle queues scoped privileged jobs and prevents overlap', async () => {
  const f = await fixture();
  const admin = await login(f.app, 'admin', 'SecureAdminPass7');
  const reseller = await login(f.app, 'reseller', 'SecureReseller7');
  const outsider = await login(f.app, 'outside', 'SecureOutside77');
  const plan = await f.app({ method: 'POST', pathname: '/api/packages', headers: headers(admin), body: { name: 'Domain plan', limits: { domains: 2, pythonApps: 1, nodeApps: 1 } } });
  await f.app({ method: 'PATCH', pathname: '/api/users/outside', headers: headers(admin), body: { packageId: plan.body.id } });

  const created = await f.app({ method: 'POST', pathname: '/api/domains', headers: headers(outsider), body: { domain: 'site.example.com' } });
  assert.equal(created.status, 202);
  assert.equal(created.body.status, 'queued');
  const createJob = f.store.data.jobs.find(item => item.resourceId === created.body.id);
  assert.equal(createJob.type, 'create_domain');
  assert.deepEqual(createJob.input, { siteId: created.body.id, domain: 'site.example.com', username: 'outside' });
  await assert.rejects(f.app({ method: 'POST', pathname: `/api/domains/${created.body.id}/disable`, headers: headers(outsider), body: {} }), /already in progress/);
  await assert.rejects(f.app({ method: 'DELETE', pathname: `/api/domains/${created.body.id}`, headers: headers(reseller), body: {} }), /forbidden/);

  const record = f.store.data.domains.find(item => item.id === created.body.id);
  record.status = 'active'; record.enabled = true;
  const disabled = await f.app({ method: 'POST', pathname: `/api/domains/${record.id}/disable`, headers: headers(outsider), body: {} });
  assert.equal(disabled.status, 202);
  assert.equal(f.store.data.jobs.at(-1).type, 'disable_domain');
  record.status = 'active'; record.enabled = true;
  const ssl = await f.app({ method: 'POST', pathname: `/api/domains/${record.id}/ssl`, headers: headers(outsider), body: { forceHttps: true } });
  assert.equal(ssl.status, 202);
  assert.equal(f.store.data.jobs.at(-1).type, 'issue_ssl');
  assert.equal(f.store.data.jobs.at(-1).input.forceHttps, true);
  assert.equal(f.store.data.jobs.at(-1).input.email, 'admin@example.com');
  record.ssl = 'active'; record.forceHttps = true;
  const application = await f.app({ method: 'POST', pathname: '/api/applications', headers: headers(outsider), body: { domainId: record.id, kind: 'php', phpVersion: '8.3', framework: 'laravel' } });
  assert.equal(application.status, 202);
  assert.equal(f.store.data.jobs.at(-1).type, 'create_php_site');
  assert.equal(f.store.data.jobs.at(-1).input.domain, 'site.example.com');
  assert.equal(f.store.data.jobs.at(-1).input.tls, true);
  await assert.rejects(f.app({ method: 'POST', pathname: '/api/applications', headers: headers(reseller), body: { domainId: record.id, kind: 'php', phpVersion: '8.3', framework: 'generic' } }), /forbidden/);
  await assert.rejects(f.app({ method: 'DELETE', pathname: `/api/domains/${record.id}`, headers: headers(outsider), body: {} }), /application first/);
  const applicationRecord = f.store.data.applications.find(item => item.id === application.body.id); applicationRecord.status = 'active';
  const removed = await f.app({ method: 'DELETE', pathname: `/api/applications/${applicationRecord.id}`, headers: headers(outsider), body: {} });
  assert.equal(removed.status, 202);
  assert.equal(f.store.data.jobs.at(-1).type, 'delete_php_site');
  f.store.data.applications = [];
  const python = await f.app({ method: 'POST', pathname: '/api/applications', headers: headers(outsider), body: { domainId: record.id, kind: 'python', pythonVersion: '3.12', framework: 'flask' } });
  assert.equal(python.status, 202);
  assert.equal(python.body.startup, 'wsgi:app');
  assert.equal(f.store.data.jobs.at(-1).type, 'create_python_app');
  assert.equal(f.store.data.jobs.at(-1).input.memoryMb, 512);
  const pythonRecord = f.store.data.applications.find(item => item.id === python.body.id); pythonRecord.status = 'active';
  const stopped = await f.app({ method: 'POST', pathname: `/api/applications/${pythonRecord.id}/stop`, headers: headers(outsider), body: {} });
  assert.equal(stopped.status, 202);
  assert.equal(f.store.data.jobs.at(-1).input.action, 'stop');
  f.store.data.applications = [];
  const nodeApplication = await f.app({ method: 'POST', pathname: '/api/applications', headers: headers(outsider), body: { domainId: record.id, kind: 'node', nodeVersion: '18', entrypoint: 'src/server.js' } });
  assert.equal(nodeApplication.status, 202);
  assert.equal(nodeApplication.body.entrypoint, 'src/server.js');
  assert.equal(f.store.data.jobs.at(-1).type, 'create_node_app');
  await assert.rejects(f.app({ method: 'POST', pathname: '/api/applications', headers: headers(outsider), body: { domainId: record.id, kind: 'node', nodeVersion: '18', entrypoint: '../bad.js' } }), /already has|invalid Node/);
  f.store.data.applications = [];
  const react = await f.app({ method: 'POST', pathname: '/api/applications', headers: headers(outsider), body: { domainId: record.id, kind: 'react', nodeVersion: '18', outputDir: 'dist' } });
  assert.equal(react.status, 202);
  assert.equal(react.body.outputDir, 'dist');
  assert.equal(f.store.data.jobs.at(-1).type, 'deploy_react_app');
  await fs.rm(f.dir, { recursive: true });
});

test('failed provisioning jobs expose safe diagnostics and can be retried by managers', async () => {
  const f = await fixture(); const admin = await login(f.app, 'admin', 'SecureAdminPass7'); const outsider = await login(f.app, 'outside', 'SecureOutside77');
  const created = await f.app({ method: 'POST', pathname: '/api/users', headers: headers(admin), body: { username: 'retryuser', email: 'retry@example.com', password: 'SecureRetryPass7' } });
  const job = f.store.data.jobs.find(item => item.resourceId === created.body.id); job.status = 'failed'; job.progress = 5; job.error = 'useradd failed safely'; job.completedAt = new Date().toISOString();
  await assert.rejects(f.app({ method: 'POST', pathname: `/api/jobs/${job.id}/retry`, headers: headers(outsider), body: {} }), /forbidden/);
  const retried = await f.app({ method: 'POST', pathname: `/api/jobs/${job.id}/retry`, headers: headers(admin), body: {} });
  assert.equal(retried.status, 202); assert.equal(retried.body.status, 'queued'); assert.equal(retried.body.input, undefined); assert.equal(retried.body.error, undefined); assert.equal(created.body.systemUsername, undefined);
  await fs.rm(f.dir, { recursive: true });
});
