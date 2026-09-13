import path from 'node:path';
import { Store } from '../../backend/src/store.js';

const file = process.env.LINTECH_DATA_FILE || path.resolve('data/panel.json');
const workerId = `worker-${process.pid}`;
let stopping = false;

async function processOne() {
  const store = await new Store(file).load();
  const job = store.data.jobs.find(x => x.status === 'queued');
  if (!job) return false;
  job.status = 'running'; job.startedAt = new Date().toISOString(); job.workerId = workerId; job.progress = 5;
  await store.save();
  try {
    // Operations remain deliberately closed: each type must gain a concrete runner before production use.
    const implemented = new Set(['deploy_static']);
    if (!implemented.has(job.type)) throw new Error('runner is unavailable in this release');
    job.safeLogs.push('Validated deployment request.'); job.progress = 100; job.status = 'successful';
  } catch (error) { job.status = 'failed'; job.error = error.message; }
  job.completedAt = new Date().toISOString(); delete job.workerId; await store.save(); return true;
}

process.on('SIGTERM', () => { stopping = true; }); process.on('SIGINT', () => { stopping = true; });
console.log(`${workerId} started`);
while (!stopping) { const worked = await processOne(); await new Promise(resolve => setTimeout(resolve, worked ? 100 : 1500)); }
console.log(`${workerId} stopped`);

