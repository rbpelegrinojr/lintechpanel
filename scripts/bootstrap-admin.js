import path from 'node:path';
import { Store } from '../backend/src/store.js';
import { cleanEmail, cleanUsername, hashPassword } from '../backend/src/security.js';
import { ROLES } from '../backend/src/rbac.js';

const cliArgs = process.argv.slice(2);
const ifMissing = cliArgs[0] === '--if-missing';
const [usernameArg, emailArg] = ifMissing ? cliArgs.slice(1) : cliArgs;
const password = process.env.LINTECH_ADMIN_PASSWORD;
if (!usernameArg || !emailArg || !password) {
  console.error('Usage: LINTECH_ADMIN_PASSWORD=<secret> npm run bootstrap -- [--if-missing] <username> <email>'); process.exit(2);
}
const store = await new Store(process.env.LINTECH_DATA_FILE || path.resolve('data/panel.json')).load();
const existingAdmin = store.data.users.find(x => x.role === ROLES.SUPER_ADMIN);
if (existingAdmin) {
  if (ifMissing) {
    console.log(`Preserving existing super administrator ${existingAdmin.username}; credentials were not changed.`);
    process.exit(0);
  }
  throw new Error('a super administrator already exists');
}
const user = { id: store.id('usr'), username: cleanUsername(usernameArg), email: cleanEmail(emailArg), role: ROLES.SUPER_ADMIN, resellerId: null, packageId: null, suspended: false, passwordHash: await hashPassword(password), mustChangePassword: true, createdAt: new Date().toISOString() };
store.data.users.push(user); store.audit(user.id, 'user.bootstrap', user.id); await store.save();
console.log(`Created super administrator ${user.username}; password was not logged.`);
