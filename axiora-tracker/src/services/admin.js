import { hashPassword, ROLES, validatePassword } from '../auth.js';
import { tx } from '../db.js';
import { badRequest, conflict, intOrNull, notFound, nowIso, str, truthy } from '../util.js';
import { logActivity } from './activity.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function listUsers(db) {
  return db.prepare(`SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
      (SELECT COUNT(*) FROM items i WHERE i.assigned_to = u.id AND i.status NOT IN ('deployed', 'verified')) AS open_items
    FROM users u ORDER BY u.active DESC, u.name`).all();
}

export function createUser(db, actor, input) {
  const fields = {};
  const name = str(input.name, { max: 120 });
  const email = str(input.email, { max: 200 }).toLowerCase();
  if (!name) fields.name = 'Name is required.';
  if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email address.';
  else if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) fields.email = 'A user with this email already exists.';
  if (!(input.role in ROLES)) fields.role = 'Choose a role.';
  const pwErr = validatePassword(input.password);
  if (pwErr) fields.password = pwErr;
  if (Object.keys(fields).length) throw badRequest('Please correct the highlighted fields.', fields);
  return tx(db, () => {
    const now = nowIso();
    const r = db.prepare('INSERT INTO users (name, email, password_hash, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .run(name, email, hashPassword(input.password), input.role, now, now);
    logActivity(db, { userId: actor?.id, action: 'user_created', details: { name, email, role: input.role } });
    return Number(r.lastInsertRowid);
  });
}

function activeAdminCount(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;
}

export function updateUser(db, actor, id, input) {
  return tx(db, () => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) throw notFound('User not found.');
    const next = {
      name: 'name' in input ? str(input.name, { max: 120 }) : user.name,
      email: 'email' in input ? str(input.email, { max: 200 }).toLowerCase() : user.email,
      role: 'role' in input ? input.role : user.role,
      active: 'active' in input ? (truthy(input.active) ? 1 : 0) : user.active,
    };
    const fields = {};
    if (!next.name) fields.name = 'Name is required.';
    if (!EMAIL_RE.test(next.email)) fields.email = 'Enter a valid email address.';
    else if (db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(next.email, id)) fields.email = 'A user with this email already exists.';
    if (!(next.role in ROLES)) fields.role = 'Choose a role.';
    let passwordHash = null;
    if (str(input.password)) {
      const pwErr = validatePassword(input.password);
      if (pwErr) fields.password = pwErr;
      else passwordHash = hashPassword(input.password);
    }
    if (Object.keys(fields).length) throw badRequest('Please correct the highlighted fields.', fields);
    if (id === actor.id && (next.role !== 'admin' || !next.active)) throw conflict('You cannot remove your own admin access.');
    if (user.role === 'admin' && user.active && (next.role !== 'admin' || !next.active) && activeAdminCount(db) <= 1) {
      throw conflict('At least one active admin is required.');
    }
    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ?, password_hash = COALESCE(?, password_hash), updated_at = ? WHERE id = ?')
      .run(next.name, next.email, next.role, next.active, passwordHash, nowIso(), id);
    // Signing-in identity changed: end existing sessions.
    if (!next.active || passwordHash || next.role !== user.role || next.email !== user.email.toLowerCase()) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    const changes = {};
    for (const k of ['name', 'email', 'role', 'active']) if (user[k] !== next[k]) changes[k] = { from: user[k], to: next[k] };
    if (passwordHash) changes.password = 'reset';
    if (Object.keys(changes).length) logActivity(db, { userId: actor.id, action: 'user_updated', details: { user: user.email, changes } });
  });
}

export function listProducts(db) {
  const products = db.prepare('SELECT * FROM products ORDER BY active DESC, name').all();
  const modules = db.prepare('SELECT * FROM modules ORDER BY name').all();
  return products.map((p) => ({ ...p, modules: modules.filter((m) => m.product_id === p.id) }));
}

export function saveProduct(db, actor, id, input) {
  const name = str(input.name, { max: 120 });
  if (!name) throw badRequest('Product name is required.', { name: 'Product name is required.' });
  const dupe = db.prepare('SELECT id FROM products WHERE name = ? AND id IS NOT ?').get(name, id);
  if (dupe) throw badRequest('This product already exists.', { name: 'This product already exists.' });
  return tx(db, () => {
    if (id) {
      if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) throw notFound('Product not found.');
      const active = 'active' in input ? (truthy(input.active) ? 1 : 0) : null;
      db.prepare('UPDATE products SET name = ?, active = COALESCE(?, active) WHERE id = ?').run(name, active, id);
      logActivity(db, { userId: actor.id, action: 'product_updated', details: { id, name, active } });
      return id;
    }
    const r = db.prepare('INSERT INTO products (name, active, created_at) VALUES (?, 1, ?)').run(name, nowIso());
    logActivity(db, { userId: actor.id, action: 'product_created', details: { name } });
    return Number(r.lastInsertRowid);
  });
}

export function saveModule(db, actor, id, input) {
  const name = str(input.name, { max: 120 });
  if (!name) throw badRequest('Module name is required.', { name: 'Module name is required.' });
  return tx(db, () => {
    if (id) {
      const m = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
      if (!m) throw notFound('Module not found.');
      if (db.prepare('SELECT id FROM modules WHERE product_id = ? AND name = ? AND id <> ?').get(m.product_id, name, id)) {
        throw badRequest('This module already exists for the product.', { name: 'Already exists.' });
      }
      const active = 'active' in input ? (truthy(input.active) ? 1 : 0) : null;
      db.prepare('UPDATE modules SET name = ?, active = COALESCE(?, active) WHERE id = ?').run(name, active, id);
      return id;
    }
    const productId = intOrNull(input.product_id);
    if (!productId || !db.prepare('SELECT id FROM products WHERE id = ?').get(productId)) throw badRequest('Choose a product.');
    if (db.prepare('SELECT id FROM modules WHERE product_id = ? AND name = ?').get(productId, name)) {
      throw badRequest('This module already exists for the product.', { name: 'Already exists.' });
    }
    const r = db.prepare('INSERT INTO modules (product_id, name, active, created_at) VALUES (?, ?, 1, ?)').run(productId, name, nowIso());
    return Number(r.lastInsertRowid);
  });
}
