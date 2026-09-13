import test from 'node:test'; import assert from 'node:assert/strict'; import { validateOperation } from './operations.js';
test('agent rejects arbitrary commands',()=>{assert.throws(()=>validateOperation('execute_command',{command:'id'}),/allowlisted/);});
test('agent validates operation arguments',()=>{assert.deepEqual(validateOperation('create_user',{username:'alice_1'}),{username:'alice_1'});assert.throws(()=>validateOperation('create_user',{username:'root;id'}),/invalid/);});

