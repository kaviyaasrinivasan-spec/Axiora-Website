import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { migrate, openDb } from '../src/db.js';

const MIGRATIONS = path.resolve(import.meta.dirname, '../migrations');

test('003 rebuilds items with existing data intact and accepts blocker', () => {
  // Build a database on the pre-003 schema with data that references items from several tables.
  const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axt-migr-'));
  for (const f of ['001_initial_schema.sql', '002_login_attempts.sql']) fs.copyFileSync(path.join(MIGRATIONS, f), path.join(oldDir, f));
  const db = openDb(':memory:');
  migrate(db, oldDir);
  const now = new Date().toISOString();
  db.exec(`
    INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (1, 'A', 'a@x', 'h', 'admin', '${now}', '${now}');
    INSERT INTO products (id, name, created_at) VALUES (1, 'CARGORA', '${now}');
    INSERT INTO items (id, item_key, category, title, description, product_id, priority, requested_by, status, created_by, created_at, updated_at, assigned_to, qa_by)
      VALUES (1, 'CD-0001', 'defect', 'Old item', 'd', 1, 'critical', 'A', 'self_test', 1, '${now}', '${now}', 1, 1);
    INSERT INTO self_tests (id, item_id, cycle, result, tested_on, notes, created_by, created_at) VALUES (1, 1, 1, 'passed', '2026-10-01', 'ok', 1, '${now}');
    UPDATE items SET current_self_test_id = 1 WHERE id = 1;
    INSERT INTO activity (item_id, user_id, action, created_at) VALUES (1, 1, 'created', '${now}');
    INSERT INTO comments (item_id, user_id, body, created_at) VALUES (1, 1, 'hi', '${now}');
  `);
  assert.throws(() => db.exec("UPDATE items SET priority = 'blocker' WHERE id = 1"), /CHECK constraint/);

  // Upgrade with the real migrations folder.
  assert.deepEqual(migrate(db, MIGRATIONS), ['003_blocker_priority.sql', '004_planning_status.sql', '005_session_idle_timeout.sql', '006_remove_login_lockout.sql', '007_planning_completed.sql', '008_workflow_permissions.sql', '009_verified_in_production.sql']);
  const item = db.prepare('SELECT * FROM items WHERE id = 1').get();
  assert.equal(item.title, 'Old item');
  assert.equal(item.current_self_test_id, 1);
  assert.equal(item.qa_by, 1);
  assert.equal(item.planning_status, 'backlog', 'existing items start in the backlog');
  assert.throws(() => db.exec("UPDATE items SET planning_status = 'later' WHERE id = 1"), /CHECK constraint/);
  db.exec("UPDATE items SET planning_status = 'completed' WHERE id = 1");
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'enforcement restored');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND tbl_name = 'items' AND name LIKE 'items_%'").get().n, 9);
  // Child tables still reference the rebuilt table.
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM self_tests s JOIN items i ON i.id = s.item_id').get().n, 1);
  assert.throws(() => db.exec("INSERT INTO comments (item_id, user_id, body, created_at) VALUES (99, 1, 'x', 'now')"), /FOREIGN KEY/);

  db.exec("UPDATE items SET priority = 'blocker' WHERE id = 1");
  assert.throws(() => db.exec("UPDATE items SET priority = 'urgent' WHERE id = 1"), /CHECK constraint/);
});
