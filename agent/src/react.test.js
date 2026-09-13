import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectBuildTree, reactPaths, reactStarterFiles, validateReactApp } from './react.js';

const app = { appId: 'app_react-123', siteId: 'dom_react-123', domain: 'react.example.com', username: 'lt_0123456789ab', nodeVersion: '18', outputDir: 'dist' };
test('React paths are confined and starter is a real Vite React project', () => { assert.equal(reactPaths(app).output, '/home/lt_0123456789ab/applications/app_react-123/dist'); assert.match(reactStarterFiles()['src/main.jsx'], /createRoot/); assert.throws(() => validateReactApp({ ...app, outputDir: '../public' }), /invalid build output/); });
test('build inspection rejects symlinks and accepts regular output', async () => { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lintech-build-')); await fs.writeFile(path.join(dir, 'index.html'), 'ok'); assert.deepEqual(await inspectBuildTree(dir), { files: 1, bytes: 2 }); try { await fs.symlink(path.join(dir, 'index.html'), path.join(dir, 'link')); await assert.rejects(inspectBuildTree(dir), /symbolic link/); } finally { await fs.rm(dir, { recursive: true }); } });
