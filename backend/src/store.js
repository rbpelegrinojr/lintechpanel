import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const empty = () => ({ users: [], sessions: [], packages: [], domains: [], jobs: [], audit: [], notifications: [] });

export class Store {
  constructor(file) { this.file = file; this.data = empty(); this.queue = Promise.resolve(); this.lockFile = `${file}.lock`; }
  async load() {
    try { this.data = { ...empty(), ...JSON.parse(await fs.readFile(this.file, 'utf8')) }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return this;
  }
  async save() {
    this.queue = this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(this.data, null, 2), { mode: 0o600 });
      await fs.rename(temporary, this.file);
    });
    return this.queue;
  }
  async withLock(callback, options = {}) {
    const timeoutMs = options.timeoutMs || 15_000;
    const staleMs = options.staleMs || 120_000;
    const token = `${process.pid}:${randomUUID()}`;
    const started = Date.now();
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    while (true) {
      try {
        const handle = await fs.open(this.lockFile, 'wx', 0o600);
        await handle.writeFile(`${token}\n${new Date().toISOString()}\n`);
        await handle.close();
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        try {
          const metadata = await fs.stat(this.lockFile);
          if (Date.now() - metadata.mtimeMs > staleMs) { await fs.rm(this.lockFile, { force: true }); continue; }
        } catch (statError) { if (statError.code !== 'ENOENT') throw statError; }
        if (Date.now() - started >= timeoutMs) throw Object.assign(new Error('state store is busy'), { status: 503 });
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    try { return await callback(); }
    finally {
      try {
        if ((await fs.readFile(this.lockFile, 'utf8')).startsWith(`${token}\n`)) await fs.rm(this.lockFile, { force: true });
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  id(prefix) { return `${prefix}_${randomUUID()}`; }
  audit(actorId, action, target, result = 'success', metadata = {}) {
    this.data.audit.push({ id: this.id('aud'), actorId, action, target, result, metadata, at: new Date().toISOString() });
  }
  notify(ownerId, kind, title, body) {
    this.data.notifications.push({ id: this.id('not'), ownerId, kind, title, body, readAt: null, createdAt: new Date().toISOString() });
  }
}
