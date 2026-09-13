import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cleanDomain, hashPassword, verifyPassword } from '../src/security.js';
import { confinedPath, safeArchiveEntry } from '../src/path-guard.js';
import { ROLES, requireOwner } from '../src/rbac.js';

test('password hashes verify without storing plaintext', async () => { const value='LongCorrectHorse7'; const hash=await hashPassword(value); assert.equal(await verifyPassword(value,hash),true); assert.equal(await verifyPassword('wrong',hash),false); assert.equal(hash.includes(value),false); });
test('domains are normalized and malformed input rejected', () => { assert.equal(cleanDomain('EXAMPLE.com.'),'example.com'); assert.throws(()=>cleanDomain('bad; rm -rf.example')); });
test('archive traversal is rejected', () => { assert.equal(safeArchiveEntry('site/index.html'),true); assert.equal(safeArchiveEntry('../../etc/passwd'),false); assert.equal(safeArchiveEntry('..\\secret'),false); });
test('filesystem paths remain in tenant root', async () => { const root=await fs.mkdtemp(path.join(os.tmpdir(),'lintech-')); await fs.writeFile(path.join(root,'safe.txt'),'ok'); assert.equal(await confinedPath(root,'safe.txt',{mustExist:true}),await fs.realpath(path.join(root,'safe.txt'))); await assert.rejects(confinedPath(root,'../escape')); await fs.rm(root,{recursive:true}); });
test('tenant ownership is enforced', () => { const customer={id:'a',role:ROLES.CUSTOMER}; assert.doesNotThrow(()=>requireOwner(customer,{ownerId:'a'})); assert.throws(()=>requireOwner(customer,{ownerId:'b'})); });
