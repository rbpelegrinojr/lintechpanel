import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeAppPaths, nodeStarter, renderNodeSite, renderNodeUnit, validateNodeApp } from './node-app.js';

const app = { appId: 'app_node-123', siteId: 'dom_node-123', domain: 'node.example.com', username: 'lt_0123456789ab', nodeVersion: '18', entrypoint: 'server.js', memoryMb: 256, cpuPercent: 50, processes: 24 };
test('Node generator emits a constrained service and Unix proxy', () => { assert.match(renderNodeUnit(app), /ExecStart=\/usr\/bin\/node \/home\/lt_0123456789ab\/applications\/app_node-123\/server\.js/); assert.match(renderNodeUnit(app), /MemoryMax=256M/); assert.match(renderNodeSite(app), /proxy_pass http:\/\/unix:\/run\/lintech-app-app_node-123\/app\.sock:/); assert.match(nodeStarter(), /LINTECH_SOCKET/); assert.equal(nodeAppPaths(app).service, 'lintech-app-app_node-123.service'); });
test('Node generator rejects traversal and unsupported versions', () => { assert.throws(() => validateNodeApp({ ...app, entrypoint: '../server.js' }), /invalid Node/); assert.throws(() => validateNodeApp({ ...app, nodeVersion: '99' }), /unsupported Node/); });
