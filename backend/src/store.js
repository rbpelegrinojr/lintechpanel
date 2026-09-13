import fs from 'node:fs/promises';
import path from 'node:path';

const empty = () => ({ users: [], sessions: [], packages: [], domains: [], jobs: [], audit: [], notifications: [] });

export class Store {
  constructor(file) { this.file = file; this.data = empty(); this.queue = Promise.resolve(); }
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
  id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
  audit(actorId, action, target, result = 'success', metadata = {}) {
    this.data.audit.push({ id: this.id('aud'), actorId, action, target, result, metadata, at: new Date().toISOString() });
  }
}

