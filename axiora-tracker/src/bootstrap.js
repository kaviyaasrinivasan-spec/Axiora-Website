import { config } from './config.js';
import { createUser } from './services/admin.js';

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the database has no users. */
export function bootstrapAdmin(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return;
  if (!config.adminEmail || !config.adminPassword) {
    console.warn('No users exist yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, or run: npm run create-admin');
    return;
  }
  createUser(db, null, { name: config.adminName, email: config.adminEmail, role: 'admin', password: config.adminPassword });
  console.log(`Created initial admin account ${config.adminEmail}. Remove ADMIN_PASSWORD from .env now.`);
}
