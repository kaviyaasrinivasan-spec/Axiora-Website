import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { nowIso } from './util.js';

export function openDb(file = config.dbFile) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

/** Applies every migrations/*.sql file not yet recorded, in filename order. */
export function migrate(db, dir = path.join(config.root, 'migrations')) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
  const pending = fs.readdirSync(dir).filter((f) => f.endsWith('.sql') && !applied.has(f)).sort();
  if (!pending.length) return pending;
  // Table rebuilds (SQLite's ALTER procedure) need foreign-key enforcement off; integrity is
  // verified before each migration commits.
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    for (const name of pending) {
      const sql = fs.readFileSync(path.join(dir, name), 'utf8');
      tx(db, () => {
        db.exec(sql);
        const broken = db.prepare('PRAGMA foreign_key_check').all();
        if (broken.length) throw new Error(`Migration ${name} broke ${broken.length} foreign key reference(s).`);
        db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, nowIso());
      });
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
  return pending;
}

/** Runs fn inside a write transaction; nested calls join the outer one. */
export function tx(db, fn) {
  if (db.isTransaction) return fn();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
