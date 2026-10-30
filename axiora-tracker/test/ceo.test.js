import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { clients, defectInput, startTestServer, today } from './helpers.js';

let ctx;
let c;
let other;
const items = {};

const act = (id, client, action, body = {}) => client.post(`/api/items/${id}/actions/${action}`, body).then((r) => {
  assert.equal(r.status, 200, `${action}: ${JSON.stringify(r.data)}`);
});
const create = async (productId, extra = {}) => {
  const res = await c.admin.post('/api/items', defectInput(productId, extra));
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.id;
};
const requirement = { category: 'requirement', business_requirement: 'Need it', acceptance_criteria: 'Works', priority: 'high' };

async function toQa(id, dev = 'dev') {
  await act(id, c.admin, 'assign', { assigned_to: ctx.users[dev].id });
  await act(id, c[dev], 'start_development');
  await act(id, c[dev], 'start_self_test', { implementation_notes: 'done' });
  await act(id, c[dev], 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
}

/** Pins when an item was created and when it entered each status (UTC instants). */
function pin(id, createdAt, statusTimes) {
  ctx.db.prepare('UPDATE items SET created_at = ? WHERE id = ?').run(createdAt, id);
  ctx.db.prepare('UPDATE activity SET created_at = ? WHERE item_id = ?').run(createdAt, id);
  for (const [status, at] of Object.entries(statusTimes)) {
    ctx.db.prepare('UPDATE activity SET created_at = ? WHERE item_id = ? AND to_status = ?').run(at, id, status);
  }
}

before(async () => {
  ctx = await startTestServer();
  c = await clients(ctx);
  other = (await c.admin.post('/api/products', { name: 'iClinical.ai' })).data.products.find((p) => p.name === 'iClinical.ai').id;

  // Requirement: created 10 Mar (India time), developed, approved and moved to production on 11 Mar by the release manager.
  items.req = await create(ctx.productId, requirement);
  await toQa(items.req);
  await act(items.req, c.qa, 'start_qa');
  await act(items.req, c.qa, 'qa_approve', { tested_on: today(), notes: 'verified' });
  await act(items.req, c.rm, 'move_to_production');
  pin(items.req, '2026-03-10T05:00:00.000Z', {
    in_development: '2026-03-10T06:00:00.000Z', ready_for_qa: '2026-03-10T07:00:00.000Z',
    qa_approved: '2026-03-11T05:00:00.000Z', deployed: '2026-03-11T10:00:00.000Z',
  });

  // Critical defect: created 10 Mar, with the second developer, in QA since 10 Mar, overdue.
  items.defect = await create(ctx.productId, { due_date: '2026-01-01' });
  await toQa(items.defect, 'dev2');
  pin(items.defect, '2026-03-10T08:00:00.000Z', { in_development: '2026-03-10T09:00:00.000Z', ready_for_qa: '2026-03-10T11:00:00.000Z' });

  // Blocker defect, unassigned, created on 9 Mar (the day before).
  items.blocker = await create(ctx.productId, { priority: 'blocker' });
  pin(items.blocker, '2026-03-09T08:00:00.000Z', {});

  // Another product: in development since 10 Mar.
  items.other = await create(other, { priority: 'low', due_date: '2026-01-01' });
  await act(items.other, c.admin, 'assign', { assigned_to: ctx.users.dev.id });
  await act(items.other, c.dev, 'start_development');
  pin(items.other, '2026-03-10T04:00:00.000Z', { in_development: '2026-03-10T04:30:00.000Z' });
});
after(() => ctx.close());

async function ceo(params) {
  const res = await c.admin.get('/api/ceo-dashboard?' + new URLSearchParams({ tz: -330, ...params }));
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data;
}
const values = (d) => Object.fromEntries(Object.entries(d.kpis).map(([k, v]) => [k, v.value]));
const previous = (d) => Object.fromEntries(Object.entries(d.kpis).map(([k, v]) => [k, v.previous]));

describe('CEO dashboard', () => {
  test('only admins can open it', async () => {
    for (const client of [c.dev, c.qa, c.rm]) assert.equal((await client.get('/api/ceo-dashboard')).status, 403);
    assert.equal((await c.anon.get('/api/ceo-dashboard')).status, 401);
    assert.equal((await c.admin.get('/api/ceo-dashboard')).status, 200);
  });

  test('KPI cards for one day, compared with the day before', async () => {
    const d = await ceo({ product: ctx.productId, from: '2026-03-10', to: '2026-03-10' });
    assert.deepEqual(d.range.previous, { from: '2026-03-09', to: '2026-03-09' });
    assert.deepEqual(values(d), { new_requirements: 1, new_defects: 1, moved_to_development: 2, moved_to_qa: 2, qa_approved: 0, deployed: 0 });
    assert.deepEqual(previous(d), { new_requirements: 0, new_defects: 1, moved_to_development: 0, moved_to_qa: 0, qa_approved: 0, deployed: 0 });
    const next = await ceo({ product: ctx.productId, from: '2026-03-11', to: '2026-03-11' });
    assert.deepEqual(values(next), { new_requirements: 0, new_defects: 0, moved_to_development: 0, moved_to_qa: 0, qa_approved: 1, deployed: 1 });
  });

  test('a week, every product, and each filter', async () => {
    const week = { from: '2026-03-09', to: '2026-03-15' };
    assert.deepEqual(values(await ceo({ product: 'all', ...week })),
      { new_requirements: 1, new_defects: 3, moved_to_development: 3, moved_to_qa: 2, qa_approved: 1, deployed: 1 });
    assert.equal((await ceo({ product: ctx.productId, ...week })).kpis.new_defects.value, 2);
    assert.equal((await ceo({ product: other, ...week })).kpis.new_defects.value, 1);
    assert.deepEqual(values(await ceo({ product: 'all', category: 'requirement', ...week })),
      { new_requirements: 1, new_defects: 0, moved_to_development: 1, moved_to_qa: 1, qa_approved: 1, deployed: 1 });
    assert.deepEqual(values(await ceo({ product: 'all', assigned_to: ctx.users.dev2.id, ...week })),
      { new_requirements: 0, new_defects: 1, moved_to_development: 1, moved_to_qa: 1, qa_approved: 0, deployed: 0 });
    assert.deepEqual(values(await ceo({ product: 'all', priority: 'blocker', ...week })),
      { new_requirements: 0, new_defects: 1, moved_to_development: 0, moved_to_qa: 0, qa_approved: 0, deployed: 0 });
    assert.deepEqual(values(await ceo({ product: 'all', from: '2026-04-01', to: '2026-04-30' })),
      { new_requirements: 0, new_defects: 0, moved_to_development: 0, moved_to_qa: 0, qa_approved: 0, deployed: 0 });
  });

  test('trend charts: at least 7 days, one bucket per local day', async () => {
    const d = await ceo({ product: ctx.productId, from: '2026-03-11', to: '2026-03-11' });
    assert.deepEqual(d.range.chart, { from: '2026-03-05', to: '2026-03-11', unit: 'day' });
    assert.equal(d.raised.length, 7);
    const day = (s, b) => s.find((x) => x.bucket === b);
    assert.deepEqual(day(d.raised, '2026-03-10'), { bucket: '2026-03-10', requirement: 1, defect: 1 });
    assert.deepEqual(day(d.raised, '2026-03-09'), { bucket: '2026-03-09', requirement: 0, defect: 1 });
    assert.deepEqual(day(d.deployments, '2026-03-11'), { bucket: '2026-03-11', requirement: 1, defect: 0 });
    assert.equal(d.deployments.reduce((a, x) => a + x.requirement + x.defect, 0), 1);
    const long = await ceo({ product: ctx.productId, from: '2026-01-01', to: '2026-03-31' });
    assert.equal(long.range.chart.unit, 'month');
    assert.deepEqual(long.raised.map((x) => x.bucket), ['2026-01', '2026-02', '2026-03']);
    assert.deepEqual(long.raised[2], { bucket: '2026-03', requirement: 1, defect: 2 });
  });

  test('developer completion, completed by status and recently completed items', async () => {
    const d = await ceo({ product: ctx.productId, from: '2026-03-09', to: '2026-03-15' });
    assert.deepEqual(d.developers.map((x) => [x.name, x.deployed]), [['DEV', 1]]);
    assert.deepEqual(d.completed, [
      { key: 'dev_complete', requirement: 1, defect: 1 },
      { key: 'qa_approved', requirement: 1, defect: 0 },
      { key: 'deployed', requirement: 1, defect: 0 },
    ]);
    assert.equal(d.recent.length, 1);
    const r = d.recent[0];
    assert.deepEqual([r.id, r.category, r.product_name, r.assigned_name, r.completed_by_name, r.completed_at, r.status],
      [items.req, 'requirement', 'CARGORA', 'DEV', 'RM', '2026-03-11T10:00:00.000Z', 'deployed']);
    assert.deepEqual((await ceo({ product: ctx.productId, from: '2026-03-12', to: '2026-03-15' })).recent, []);
  });

  test('current status and pending & risks are live snapshots that follow the filters', async () => {
    const d = await ceo({ product: ctx.productId, from: '2026-04-01', to: '2026-04-01' });
    assert.equal(d.statusNow.deployed, 1);
    assert.equal(d.statusNow.ready_for_qa, 1);
    assert.equal(d.statusNow.new, 1);
    assert.equal(Object.values(d.statusNow).reduce((a, n) => a + n, 0), 3);
    assert.deepEqual(d.pending, { unassigned: 1, overdue_development: 0, awaiting_qa: 1, qa_rejected: 0, awaiting_production: 0, critical_defects: 2 });
    const all = await ceo({ product: 'all' });
    assert.deepEqual(all.pending, { unassigned: 1, overdue_development: 1, awaiting_qa: 1, qa_rejected: 0, awaiting_production: 0, critical_defects: 2 });
    assert.equal((await ceo({ product: 'all', priority: 'blocker' })).pending.critical_defects, 1);
  });

  test('defaults to today and rejects a reversed range', async () => {
    const d = await ceo({});
    assert.equal(d.range.from, d.range.to);
    assert.equal(d.range.from, d.today);
    assert.equal((await c.admin.get('/api/ceo-dashboard?from=2026-03-10&to=2026-03-01')).status, 400);
  });
});
