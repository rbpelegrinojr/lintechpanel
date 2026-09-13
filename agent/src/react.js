import fs from 'node:fs/promises';
import path from 'node:path';
import { validateSite } from './nginx.js';

const APP_ID = /^[a-z][a-z0-9_-]{2,63}$/;
const OUTPUT = /^[A-Za-z0-9_][A-Za-z0-9_./-]{0,126}$/;

export function validateReactApp(input) {
  const site = validateSite(input); const appId = String(input.appId || ''); const nodeVersion = String(input.nodeVersion || ''); const outputDir = String(input.outputDir || 'dist');
  if (!APP_ID.test(appId)) throw new Error('invalid application id');
  if (nodeVersion !== '18') throw new Error('unsupported Node.js version');
  if (!OUTPUT.test(outputDir) || outputDir.split('/').includes('..') || path.posix.isAbsolute(outputDir)) throw new Error('invalid build output directory');
  return { ...site, appId, nodeVersion, outputDir };
}

export function reactPaths(input) {
  const { appId, username, domain, outputDir } = validateReactApp(input); const root = `/home/${username}/applications/${appId}`;
  return { root, output: path.posix.join(root, outputDir), publicRoot: `/home/${username}/websites/${domain}/public` };
}

export async function inspectBuildTree(root, limits = {}) {
  const maximumFiles = limits.maximumFiles || 20_000; const maximumBytes = limits.maximumBytes || 512 * 1024 * 1024;
  let files = 0; let bytes = 0;
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name); const metadata = await fs.lstat(target);
      if (metadata.isSymbolicLink()) throw new Error('build output contains a symbolic link');
      if (metadata.isDirectory()) await visit(target);
      else if (metadata.isFile()) { files += 1; bytes += metadata.size; }
      else throw new Error('build output contains an unsupported file type');
      if (files > maximumFiles || bytes > maximumBytes) throw new Error('build output exceeds safety limits');
    }
  }
  await visit(root); if (!files) throw new Error('build output is empty'); return { files, bytes };
}

export function reactStarterFiles() {
  return {
    'package.json': `${JSON.stringify({ name: 'lintech-react-app', private: true, version: '1.0.0', type: 'module', scripts: { build: 'vite build' }, dependencies: { react: '19.3.0', 'react-dom': '19.3.0' }, devDependencies: { vite: '^6.0.0' } }, null, 2)}\n`,
    'index.html': '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LinTech React App</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n',
    'src/main.jsx': "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './style.css';\nfunction App() { return <main><h1>LinTech React application</h1><p>Your deployment is working.</p></main>; }\ncreateRoot(document.getElementById('root')).render(<App />);\n",
    'src/style.css': 'body{font-family:system-ui,sans-serif;margin:0;background:#f4f7fb;color:#172033}main{max-width:48rem;margin:10vh auto;padding:2rem;background:white;border-radius:1rem}\n'
  };
}
