import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';

test('state store lock prevents lost updates across store instances', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lintech-store-'));
  const file = path.join(directory, 'panel.json');
  const stores = [new Store(file), new Store(file)];
  await Promise.all(Array.from({ length: 20 }, (_, index) => stores[index % stores.length].withLock(async () => {
    const store = stores[index % stores.length];
    await store.load();
    store.data.revision = (store.data.revision || 0) + 1;
    await store.save();
  })));
  const result = await new Store(file).load();
  assert.equal(result.data.revision, 20);
  await fs.rm(directory, { recursive: true });
});
