// Usage: npm run create-admin -- --email you@company.com --name "Your Name"
// The password is read from the ADMIN_PASSWORD environment variable or prompted for.
import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { migrate, openDb } from '../src/db.js';
import { createUser } from '../src/services/admin.js';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const email = values.email || (await rl.question('Admin email: '));
const name = values.name || (await rl.question('Full name: '));
const password = process.env.ADMIN_PASSWORD || (await rl.question('Password (min 10 chars): '));
rl.close();

const db = openDb();
migrate(db);
try {
  createUser(db, null, { name, email, role: 'admin', password });
  console.log(`Admin ${email} created.`);
} catch (err) {
  console.error(err.message, err.fields ? JSON.stringify(err.fields) : '');
  process.exitCode = 1;
} finally {
  db.close();
}
