import path from 'node:path';
import { Store } from '../../backend/src/store.js';
import { callAgent } from './agent-client.js';

const file = process.env.LINTECH_DATA_FILE || path.resolve('data/panel.json');
const workerId = `worker-${process.pid}`;
let stopping = false;

async function processOne() {
  const store = new Store(file);
  const job = await store.withLock(async () => {
    await store.load();
    const candidate = store.data.jobs.find(x => x.status === 'queued');
    if (!candidate) return null;
    candidate.status = 'running'; candidate.startedAt = new Date().toISOString(); candidate.workerId = workerId; candidate.progress = 5;
    await store.save();
    return structuredClone(candidate);
  });
  if (!job) return false;
  let failure = null;
  let operationResult = null;
  try {
    if (job.type === 'provision_user') {
      await callAgent('create_user', { username: job.input.username });
      await callAgent('create_customer_dirs', { userId: job.input.userId, username: job.input.username });
    } else if (['create_domain', 'delete_domain', 'enable_domain', 'disable_domain'].includes(job.type)) {
      operationResult = await callAgent(job.type, job.input);
    } else if (job.type === 'issue_ssl') {
      operationResult = await callAgent('issue_ssl', { ...job.input, email: process.env.LINTECH_ACME_EMAIL || job.input.email }, { timeoutMs: 120_000 });
    } else if (['create_php_site', 'delete_php_site'].includes(job.type)) {
      operationResult = await callAgent(job.type, job.input, { timeoutMs: 60_000 });
    } else if (['create_python_app', 'delete_python_app', 'control_python_app'].includes(job.type)) {
      operationResult = await callAgent(job.type, job.input, { timeoutMs: job.type === 'create_python_app' ? 300_000 : 60_000 });
    } else {
      throw new Error('runner is unavailable in this release');
    }
  } catch (error) {
    failure = error;
  }
  await store.withLock(async () => {
    await store.load();
    const current = store.data.jobs.find(item => item.id === job.id);
    if (!current) throw new Error('claimed job disappeared from the state store');
    current.completedAt = new Date().toISOString(); delete current.workerId;
    if (failure) { current.status = 'failed'; current.error = failure.message; }
    else { current.safeLogs.push('Validated privileged operation completed.'); current.progress = 100; current.status = 'successful'; }
    if (job.type === 'provision_user') {
      const user = store.data.users.find(item => item.id === job.resourceId); if (user) user.systemStatus = failure ? 'error' : 'active';
    } else if (job.type === 'delete_domain' && !failure) {
      store.data.domains = store.data.domains.filter(item => item.id !== job.resourceId);
    } else if (job.type.endsWith('_domain')) {
      const domain = store.data.domains.find(item => item.id === job.resourceId);
      if (domain && failure) { domain.status = 'error'; domain.error = failure.message; }
      else if (domain) { domain.status = job.type === 'disable_domain' ? 'disabled' : 'active'; domain.enabled = job.type !== 'disable_domain'; delete domain.error; }
    } else if (job.type === 'issue_ssl') {
      const domain = store.data.domains.find(item => item.id === job.resourceId);
      if (domain && failure) { domain.ssl = 'error'; domain.sslError = failure.message; }
      else if (domain) { domain.ssl = 'active'; domain.forceHttps = operationResult.forceHttps; domain.sslExpiresAt = operationResult.expiresAt; delete domain.sslError; }
    } else if (job.type === 'delete_php_site' && !failure) {
      store.data.applications = store.data.applications.filter(item => item.id !== job.resourceId);
    } else if (['create_php_site', 'delete_php_site'].includes(job.type)) {
      const application = store.data.applications.find(item => item.id === job.resourceId);
      if (application) { application.status = failure ? 'error' : 'active'; application.updatedAt = new Date().toISOString(); if (failure) application.error = failure.message; else delete application.error; }
    } else if (job.type === 'delete_python_app' && !failure) {
      store.data.applications = store.data.applications.filter(item => item.id !== job.resourceId);
    } else if (['create_python_app', 'delete_python_app', 'control_python_app'].includes(job.type)) {
      const application = store.data.applications.find(item => item.id === job.resourceId);
      if (application) { application.status = failure ? 'error' : (operationResult.status || 'active'); application.updatedAt = new Date().toISOString(); if (failure) application.error = failure.message; else delete application.error; }
    }
    await store.save();
  });
  return true;
}

process.on('SIGTERM', () => { stopping = true; }); process.on('SIGINT', () => { stopping = true; });
console.log(`${workerId} started`);
while (!stopping) { const worked = await processOne(); await new Promise(resolve => setTimeout(resolve, worked ? 100 : 1500)); }
console.log(`${workerId} stopped`);
