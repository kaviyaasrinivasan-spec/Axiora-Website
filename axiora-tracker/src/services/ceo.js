import { GROUPS, STATUSES } from '../workflow.js';
import { rangeParts } from './dashboard.js';
import { buildFilter } from './items.js';

// CEO dashboard: what happened in a period (from the activity trail, so every number is a
// recorded event) plus a snapshot of where things stand now. All figures honour the
// product / type / developer / priority filters.

const DAY = 864e5;
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** Workflow events counted in the KPI cards: the status an item moved into. */
const MOVES = {
  moved_to_development: 'in_development',
  moved_to_qa: 'ready_for_qa',
  qa_approved: 'qa_approved',
  deployed: 'deployed',
};

export function getCeoDashboard(db, q, user) {
  const { sql, params } = buildFilter({ product: q.product, category: q.category, assigned_to: q.assigned_to, priority: q.priority }, user);
  const and = sql ? `${sql} AND` : 'WHERE';
  const parts = rangeParts(q);
  const today = new Date(Date.now() - parts.offset * 60000).toISOString().slice(0, 10);
  const from = parts.from || parts.to || today;
  const to = parts.to || (parts.from ? today : from);
  const length = daysBetween(from, to) + 1;
  const previous = { from: addDays(from, -length), to: addDays(from, -1) };
  const current = parts.between(from, to);
  const before = parts.between(previous.from, previous.to);

  const one = (query) => db.prepare(query).get(...params).n || 0;
  const all = (query) => db.prepare(query).all(...params);
  const created = (category, during) => one(`SELECT COUNT(*) AS n FROM items i ${and} i.category = '${category}' AND ${during('i.created_at')}`);
  const movedFrom = `FROM activity a JOIN items i ON i.id = a.item_id ${and}`;
  const movedInto = (status, during) => `a.to_status = '${status}' AND (a.from_status IS NULL OR a.from_status <> a.to_status) AND ${during('a.created_at')}`;
  const moved = (status, during) => one(`SELECT COUNT(DISTINCT a.item_id) AS n ${movedFrom} ${movedInto(status, during)}`);

  const kpi = (fn) => ({ value: fn(current), previous: fn(before) });
  const kpis = {
    new_requirements: kpi((d) => created('requirement', d)),
    new_defects: kpi((d) => created('defect', d)),
    ...Object.fromEntries(Object.entries(MOVES).map(([key, status]) => [key, kpi((d) => moved(status, d))])),
  };

  // Trend charts cover the selected period, widened to at least the last 7 days so a single
  // day still shows a trend. Long periods are grouped by month.
  const chartFrom = length < 7 ? addDays(to, -6) : from;
  const unit = daysBetween(chartFrom, to) + 1 <= 62 ? 'day' : 'month';
  const shift = -parts.offset;
  const bucket = (col) => {
    const local = `date(${col}, '${shift >= 0 ? '+' : ''}${shift} minutes')`;
    return unit === 'day' ? local : `substr(${local}, 1, 7)`;
  };
  const buckets = [];
  for (let d = chartFrom; d <= to; d = addDays(d, 1)) {
    const b = unit === 'day' ? d : d.slice(0, 7);
    if (buckets.at(-1) !== b) buckets.push(b);
  }
  const series = (rows) => buckets.map((b) => ({
    bucket: b,
    requirement: rows.find((r) => r.b === b && r.category === 'requirement')?.n || 0,
    defect: rows.find((r) => r.b === b && r.category === 'defect')?.n || 0,
  }));
  const chartRange = parts.between(chartFrom, to);

  const byCategory = (status) => Object.fromEntries(all(`SELECT i.category, COUNT(DISTINCT a.item_id) AS n ${movedFrom} ${movedInto(status, current)}
    GROUP BY i.category`).map((r) => [r.category, r.n]));
  const statusRows = Object.fromEntries(all(`SELECT i.status, COUNT(*) AS n FROM items i ${sql} GROUP BY i.status`).map((r) => [r.status, r.n]));
  const count = (cond) => one(`SELECT COUNT(*) AS n FROM items i ${and} ${cond}`);
  const inList = (arr) => arr.map((s) => `'${s}'`).join(', ');

  return {
    range: { from, to, days: length, previous, chart: { from: chartFrom, to, unit } },
    kpis,
    raised: series(all(`SELECT ${bucket('i.created_at')} AS b, i.category, COUNT(*) AS n FROM items i
      ${and} ${chartRange('i.created_at')} GROUP BY b, i.category`)),
    deployments: series(all(`SELECT ${bucket('a.created_at')} AS b, i.category, COUNT(DISTINCT a.item_id) AS n
      ${movedFrom} ${movedInto('deployed', chartRange)} GROUP BY b, i.category`)),
    statusNow: Object.fromEntries(Object.keys(STATUSES).map((s) => [s, statusRows[s] || 0])),
    developers: all(`SELECT u.id, u.name, COUNT(DISTINCT a.item_id) AS deployed
      FROM activity a JOIN items i ON i.id = a.item_id JOIN users u ON u.id = i.assigned_to
      ${and} ${movedInto('deployed', current)} GROUP BY u.id ORDER BY deployed DESC, u.name`),
    completed: [['dev_complete', 'ready_for_qa'], ['qa_approved', 'qa_approved'], ['deployed', 'deployed']].map(([key, status]) => {
      const c = byCategory(status);
      return { key, requirement: c.requirement || 0, defect: c.defect || 0 };
    }),
    pending: {
      unassigned: count("i.status = 'new'"),
      overdue_development: db.prepare(`SELECT COUNT(*) AS n FROM items i ${and} i.status IN ('assigned', ${inList(GROUPS.in_development)}) AND i.due_date < ?`).get(...params, today).n,
      awaiting_qa: count(`i.status IN (${inList(GROUPS.awaiting_qa)})`),
      qa_rejected: count("i.status = 'qa_rejected'"),
      awaiting_production: count(`i.status IN (${inList(GROUPS.production_queue)})`),
      critical_defects: count("i.category = 'defect' AND i.priority IN ('blocker', 'critical') AND i.status NOT IN ('deployed', 'verified')"),
    },
    today,
    recent: all(`SELECT i.id, i.item_key, i.title, i.category, i.priority, i.status, p.name AS product_name,
        dev.name AS assigned_name, dep.name AS completed_by_name, a.created_at AS completed_at
      FROM activity a JOIN items i ON i.id = a.item_id JOIN products p ON p.id = i.product_id
      LEFT JOIN users dev ON dev.id = i.assigned_to LEFT JOIN users dep ON dep.id = a.user_id
      ${and} ${movedInto('deployed', current)} ORDER BY a.created_at DESC, a.id DESC LIMIT 10`),
  };
}
