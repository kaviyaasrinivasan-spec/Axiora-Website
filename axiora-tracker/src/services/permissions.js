import { ROLES } from '../auth.js';
import { tx } from '../db.js';
import { badRequest, nowIso } from '../util.js';
import { WORKFLOW_PERMISSIONS, defaultPermissions } from '../workflow.js';
import { logActivity } from './activity.js';

/** The workflow permission map in force: defaults, overridden by what admins saved. */
export function loadPermissions(db) {
  const perms = defaultPermissions();
  for (const row of db.prepare('SELECT permission, roles FROM workflow_permissions').all()) {
    if (!(row.permission in perms)) continue;
    const roles = JSON.parse(row.roles).filter((r) => r in ROLES);
    if (roles.length) perms[row.permission] = roles;
  }
  return perms;
}

/** Permission rows for the Settings screen. */
export function describePermissions(db) {
  const perms = loadPermissions(db);
  return Object.entries(WORKFLOW_PERMISSIONS).map(([key, def]) => ({
    key, group: def.group, label: def.label, note: def.note || null, roles: perms[key], defaultRoles: def.roles,
  }));
}

/**
 * Saves new roles for some or all permissions ({ permission: [roles] }). Every permission must keep
 * at least one role so no workflow step can become impossible. The change is audited.
 */
export function savePermissions(db, actor, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('Send the permissions to save.');
  const fields = {};
  const next = {};
  for (const [key, roles] of Object.entries(input)) {
    if (!(key in WORKFLOW_PERMISSIONS)) { fields[key] = 'Unknown permission.'; continue; }
    if (!Array.isArray(roles) || roles.some((r) => !(r in ROLES))) { fields[key] = 'Choose valid roles.'; continue; }
    const unique = [...new Set(roles)];
    if (!unique.length) { fields[key] = 'At least one role must be allowed.'; continue; }
    next[key] = Object.keys(ROLES).filter((r) => unique.includes(r));
  }
  if (Object.keys(fields).length) throw badRequest('Please correct the workflow permissions.', fields);
  return tx(db, () => {
    const current = loadPermissions(db);
    const changes = {};
    const now = nowIso();
    for (const [key, roles] of Object.entries(next)) {
      const sameSet = (a, b) => [...a].sort().join() === [...b].sort().join();
      if (sameSet(current[key], roles)) continue;
      changes[key] = { from: current[key], to: roles };
      // Back to the default: drop the override so only real changes are stored.
      if (sameSet(roles, WORKFLOW_PERMISSIONS[key].roles)) {
        db.prepare('DELETE FROM workflow_permissions WHERE permission = ?').run(key);
        continue;
      }
      db.prepare(`INSERT INTO workflow_permissions (permission, roles, updated_by, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(permission) DO UPDATE SET roles = excluded.roles, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
        .run(key, JSON.stringify(roles), actor.id, now);
    }
    if (Object.keys(changes).length) logActivity(db, { userId: actor.id, action: 'workflow_permissions_updated', details: { changes } });
    return describePermissions(db);
  });
}
