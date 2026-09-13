import path from 'node:path';
import { Store } from '../backend/src/store.js';
import { cleanEmail, cleanUsername, hashPassword } from '../backend/src/security.js';
import { ROLES } from '../backend/src/rbac.js';

const [usernameArg, emailArg] = process.argv.slice(2);
const password = process.env.LINTECH_ADMIN_PASSWORD;
if (!usernameArg || !emailArg || !password) {
  console.error('Usage: LINTECH_ADMIN_PASSWORD=<secret> npm run bootstrap -- <username> <email>'); process.exit(2);
}
const store = await new Store(process.env.LINTECH_DATA_FILE || path.resolve('data/panel.json')).load();
if (store.data.users.some(x => x.role === ROLES.SUPER_ADMIN)) throw new Error('a super administrator already exists');
const user = { id: store.id('usr'), username: cleanUsername(usernameArg), email: cleanEmail(emailArg), role: ROLES.SUPER_ADMIN, resellerId: null, packageId: null, suspended: false, passwordHash: await hashPassword(password), mustChangePassword: true, createdAt: new Date().toISOString() };
store.data.users.push(user); store.audit(user.id, 'user.bootstrap', user.id); await store.save();
console.log(`Created super administrator ${user.username}; password was not logged.`);

