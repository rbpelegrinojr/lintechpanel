import test from 'node:test';
import assert from 'node:assert/strict';
import { pythonPaths, renderPythonSite, renderPythonUnit, starterSource, validatePythonApp } from './python.js';

const app = { appId: 'app_py-123', siteId: 'dom_py-123', domain: 'py.example.com', username: 'lt_0123456789ab', pythonVersion: '3.12', framework: 'flask', startup: 'wsgi:app', memoryMb: 384, cpuPercent: 75, processes: 32 };

test('Python generator confines service paths and resources', () => {
  assert.equal(pythonPaths(app).unit, '/etc/systemd/system/lintech-app-app_py-123.service');
  const unit = renderPythonUnit(app);
  assert.match(unit, /User=lt_0123456789ab/); assert.match(unit, /MemoryMax=384M/); assert.match(unit, /CPUQuota=75%/); assert.match(unit, /NoNewPrivileges=true/);
  assert.match(renderPythonSite(app), /proxy_pass http:\/\/unix:\/run\/lintech-app-app_py-123\/app\.sock:/);
  assert.match(starterSource('flask'), /Flask/);
});

test('Python generator rejects command-like startup and unsupported runtimes', () => {
  assert.throws(() => validatePythonApp({ ...app, startup: 'wsgi:app;id' }), /invalid WSGI/);
  assert.throws(() => validatePythonApp({ ...app, pythonVersion: '2.7' }), /unsupported Python/);
});
