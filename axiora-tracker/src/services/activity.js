import { nowIso } from '../util.js';

export function logActivity(db, { itemId = null, releaseId = null, userId, action, from = null, to = null, details = null }) {
  db.prepare(`INSERT INTO activity (item_id, release_id, user_id, action, from_status, to_status, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(itemId, releaseId, userId ?? null, action, from, to, details ? JSON.stringify(details) : null, nowIso());
}

export function listActivity(db, where, value) {
  return db.prepare(`SELECT a.id, a.item_id, a.release_id, a.action, a.from_status, a.to_status, a.details, a.created_at,
      u.name AS user_name, i.item_key
    FROM activity a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN items i ON i.id = a.item_id
    WHERE a.${where} = ? ORDER BY a.id`).all(value)
    .map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }));
}
