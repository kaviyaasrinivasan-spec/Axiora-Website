import { badRequest, isDate, todayIso } from '../util.js';
import { GROUPS } from '../workflow.js';
import { buildFilter } from './items.js';

// Dashboard and reports honour the same filters as the item list, minus status/view,
// so a number on a card always equals the row count of the list it links to.
const FILTER_KEYS = ['product', 'category', 'assigned_to', 'priority', 'requested_by', 'from', 'to'];

function scopedFilter(q, user) {
  const f = {};
  for (const k of FILTER_KEYS) if (q[k] !== undefined && q[k] !== '') f[k] = q[k];
  return buildFilter(f, user);
}

const inList = (arr) => arr.map((s) => `'${s}'`).join(', ');
const BRIEF = `i.id, i.item_key, i.title, i.category, i.priority, i.status, i.due_date, i.updated_at,
  p.name AS product_name, u.name AS assigned_name`;
const BRIEF_FROM = 'FROM items i JOIN products p ON p.id = i.product_id LEFT JOIN users u ON u.id = i.assigned_to';

export function getDashboard(db, q, user) {
  const { sql, params } = scopedFilter(q, user);
  const and = sql ? `${sql} AND` : 'WHERE';
  const all = (query, ...extra) => db.prepare(query).all(...params, ...extra);
  const count = (cond, ...extra) => db.prepare(`SELECT COUNT(*) AS n FROM items i ${and} ${cond}`).get(...params, ...extra).n;

  const byStatus = Object.fromEntries(all(`SELECT i.status, COUNT(*) AS n FROM items i ${sql} GROUP BY i.status`).map((r) => [r.status, r.n]));
  const byCategory = Object.fromEntries(all(`SELECT i.category, COUNT(*) AS n FROM items i ${sql} GROUP BY i.category`).map((r) => [r.category, r.n]));
  const sum = (statuses) => statuses.reduce((acc, s) => acc + (byStatus[s] || 0), 0);
  const today = todayIso();

  return {
    cards: {
      requirements: byCategory.requirement || 0,
      defects: byCategory.defect || 0,
      total: (byCategory.requirement || 0) + (byCategory.defect || 0),
      new: sum(['new']),
      in_development: sum(GROUPS.in_development),
      awaiting_qa: sum(GROUPS.awaiting_qa),
      qa_rejected: sum(['qa_rejected']),
      qa_approved: sum(['qa_approved']),
      ready_for_production: sum(['ready_for_production']),
      deployed: sum(['deployed']),
      verified: sum(['verified']),
    },
    byStatus,
    openByPriority: Object.fromEntries(all(`SELECT i.priority, COUNT(*) AS n FROM items i ${and} i.status NOT IN ('deployed', 'verified') GROUP BY i.priority`)
      .map((r) => [r.priority, r.n])),
    byProduct: all(`SELECT p.id, p.name, COUNT(*) AS total, SUM(i.status NOT IN ('deployed', 'verified')) AS open
      FROM items i JOIN products p ON p.id = i.product_id ${sql} GROUP BY p.id ORDER BY total DESC`),
    byDeveloper: all(`SELECT u.id, u.name,
        SUM(i.status IN ('assigned', 'in_development', 'self_test', 'qa_rejected')) AS with_developer,
        SUM(i.status IN (${inList(GROUPS.awaiting_qa)})) AS in_qa,
        SUM(i.status = 'qa_rejected') AS rejected,
        SUM(i.status IN ('qa_approved', 'ready_for_production')) AS approved,
        SUM(i.status IN ('deployed', 'verified')) AS deployed,
        COUNT(*) AS total
      FROM items i JOIN users u ON u.id = i.assigned_to ${sql} GROUP BY u.id ORDER BY with_developer DESC, total DESC`),
    awaitingQa: all(`SELECT ${BRIEF} ${BRIEF_FROM} ${and} i.status IN (${inList(GROUPS.awaiting_qa)}) ORDER BY i.updated_at ASC LIMIT 8`),
    urgentDefects: {
      total: count("i.category = 'defect' AND i.priority IN ('blocker', 'critical', 'high') AND i.status NOT IN ('deployed', 'verified')"),
      items: all(`SELECT ${BRIEF} ${BRIEF_FROM} ${and} i.category = 'defect' AND i.priority IN ('blocker', 'critical', 'high') AND i.status NOT IN ('deployed', 'verified')
        ORDER BY i.priority = 'blocker' DESC, i.priority = 'critical' DESC, i.created_at ASC LIMIT 8`),
    },
    recent: all(`SELECT ${BRIEF} ${BRIEF_FROM} ${sql} ORDER BY i.updated_at DESC LIMIT 8`),
    overdue: {
      total: count("i.due_date < ? AND i.status NOT IN ('deployed', 'verified')", today),
      items: all(`SELECT ${BRIEF} ${BRIEF_FROM} ${and} i.due_date < ? AND i.status NOT IN ('deployed', 'verified') ORDER BY i.due_date ASC LIMIT 8`, today),
    },
  };
}

/**
 * Report date range (?from=&to=, calendar dates in the viewer's time zone; ?tz= is their
 * getTimezoneOffset() in minutes). Returns a function giving the SQL condition "column falls
 * in the range". The bounds are ISO instants computed here, never user text, so inlining them is safe.
 */
export function reportRange(q) {
  return rangeParts(q).during;
}

/** The parsed range: dates, the viewer's UTC offset, `at(date, days)` → UTC instant, and `during(col)`. */
export function rangeParts(q) {
  const tz = Number(q.tz ?? 0);
  const offset = Number.isInteger(tz) && Math.abs(tz) <= 840 ? tz : 0;
  const from = isDate(q.from) ? q.from : null;
  const to = isDate(q.to) ? q.to : null;
  if (from && to && from > to) throw badRequest('The start date must be on or before the end date.', { from: 'Start date is after the end date.' });
  const at = (date, days = 0) => new Date(Date.parse(`${date}T00:00:00Z`) + (days * 1440 + offset) * 60000).toISOString();
  const between = (start, end) => {
    const bounds = [start && ['>=', at(start)], end && ['<', at(end, 1)]].filter(Boolean);
    return (col) => bounds.map(([op, v]) => `${col} ${op} '${v}'`).join(' AND ') || '1 = 1';
  };
  return { from, to, offset, at, between, during: between(from, to) };
}

// The date range applies to when each thing happened: items by creation date, QA results,
// self-tests and moves to production by the time they were recorded.
export function getReports(db, q, user) {
  const { sql, params } = scopedFilter({ product: q.product, category: q.category }, user);
  const and = sql ? `${sql} AND` : 'WHERE';
  const all = (query) => db.prepare(query).all(...params);
  const during = reportRange(q);

  const qa = db.prepare(`SELECT COUNT(*) AS total, SUM(v.result = 'approved') AS approved, SUM(v.result = 'rejected') AS rejected
    FROM qa_verifications v JOIN items i ON i.id = v.item_id ${and} ${during('v.created_at')}`).get(...params);
  const firstPass = db.prepare(`SELECT COUNT(*) AS verified, SUM(first.result = 'approved') AS first_pass FROM items i
    JOIN qa_verifications first ON first.id = (SELECT MIN(id) FROM qa_verifications WHERE item_id = i.id) ${and} ${during('first.created_at')}`).get(...params);

  const perDeveloper = {
    assigned: `SELECT i.assigned_to AS uid, COUNT(*) AS n FROM items i ${and} i.assigned_to IS NOT NULL AND ${during('i.created_at')} GROUP BY uid`,
    deployed: `SELECT i.assigned_to AS uid, COUNT(*) AS n FROM items i ${and} i.assigned_to IS NOT NULL AND i.status IN ('deployed', 'verified') AND ${during('i.deployed_at')} GROUP BY uid`,
    self_test_failures: `SELECT s.created_by AS uid, COUNT(*) AS n FROM self_tests s JOIN items i ON i.id = s.item_id
      ${and} s.result = 'failed' AND s.created_by = i.assigned_to AND ${during('s.created_at')} GROUP BY uid`,
    qa_rejections: `SELECT i.assigned_to AS uid, COUNT(*) AS n FROM qa_verifications v JOIN items i ON i.id = v.item_id
      ${and} v.result = 'rejected' AND i.assigned_to IS NOT NULL AND ${during('v.created_at')} GROUP BY uid`,
  };
  const devs = new Map();
  for (const [key, query] of Object.entries(perDeveloper)) {
    for (const r of all(query)) {
      if (!devs.has(r.uid)) devs.set(r.uid, { uid: r.uid, assigned: 0, deployed: 0, self_test_failures: 0, qa_rejections: 0 });
      devs.get(r.uid)[key] = r.n;
    }
  }
  const names = new Map(db.prepare('SELECT id, name FROM users').all().map((u) => [u.id, u.name]));
  const developers = [...devs.values()].map(({ uid, ...x }) => ({ name: names.get(uid), ...x }))
    .sort((a, b) => b.assigned - a.assigned || a.name.localeCompare(b.name));

  return {
    matrix: all(`SELECT p.name AS product, i.status, COUNT(*) AS n FROM items i JOIN products p ON p.id = i.product_id
      ${and} ${during('i.created_at')} GROUP BY p.name, i.status ORDER BY p.name`),
    qa: { ...qa, verified_items: firstPass.verified, first_pass: firstPass.first_pass || 0 },
    mostRejected: all(`SELECT i.id, i.item_key, i.title, i.status, u.name AS assigned_name, COUNT(v.id) AS rejections
      FROM items i JOIN qa_verifications v ON v.item_id = i.id AND v.result = 'rejected' AND ${during('v.created_at')} LEFT JOIN users u ON u.id = i.assigned_to
      ${sql} GROUP BY i.id ORDER BY rejections DESC, i.id DESC LIMIT 10`),
    developers,
    cycleTime: all(`SELECT i.category, COUNT(*) AS deployed,
        ROUND(AVG(julianday(i.deployed_at) - julianday(i.created_at)), 1) AS avg_days
      FROM items i ${and} i.status IN ('deployed', 'verified') AND ${during('i.deployed_at')} GROUP BY i.category`),
  };
}
