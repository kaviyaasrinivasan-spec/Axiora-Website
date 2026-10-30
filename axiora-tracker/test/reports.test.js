import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { clients, defectInput, startTestServer, today } from './helpers.js';

let ctx;
let c;
let other;
const items = {};

before(async () => {
  ctx = await startTestServer();
  c = await clients(ctx);
  other = (await c.admin.post('/api/products', { name: 'iClinical.ai' })).data.products.find((p) => p.name === 'iClinical.ai')?.id;
  assert.ok(other, 'second product');
  items.jan = await rejectedItem(ctx.productId, { failSelfTest: true });
  items.feb = await rejectedItem(ctx.productId);
  items.otherJan = await rejectedItem(other);
  // Pin every timestamp so date ranges can be checked exactly (all times UTC).
  const set = (sql, ...args) => ctx.db.prepare(sql).run(...args);
  // 20:00 UTC on 9 Jan is 01:30 on 10 Jan in India (UTC+5:30).
  set('UPDATE items SET created_at = ? WHERE id = ?', '2026-01-09T20:00:00.000Z', items.jan);
  set('UPDATE qa_verifications SET created_at = ? WHERE item_id = ?', '2026-01-10T12:00:00.000Z', items.jan);
  set('UPDATE self_tests SET created_at = ? WHERE item_id = ?', '2026-01-10T09:00:00.000Z', items.jan);
  set('UPDATE items SET created_at = ? WHERE id = ?', '2026-02-15T10:00:00.000Z', items.feb);
  set('UPDATE qa_verifications SET created_at = ? WHERE item_id = ?', '2026-02-15T11:00:00.000Z', items.feb);
  set('UPDATE self_tests SET created_at = ? WHERE item_id = ?', '2026-02-15T10:30:00.000Z', items.feb);
  set("UPDATE items SET status = 'deployed', deployed_at = ? WHERE id = ?", '2026-02-20T10:00:00.000Z', items.feb);
  set('UPDATE items SET created_at = ? WHERE id = ?', '2026-01-10T08:00:00.000Z', items.otherJan);
  set('UPDATE qa_verifications SET created_at = ? WHERE item_id = ?', '2026-01-10T08:30:00.000Z', items.otherJan);
  set('UPDATE self_tests SET created_at = ? WHERE item_id = ?', '2026-01-10T08:15:00.000Z', items.otherJan);
});
after(() => ctx.close());

const act = (id, client, action, body = {}) => client.post(`/api/items/${id}/actions/${action}`, body).then((r) => {
  assert.equal(r.status, 200, `${action}: ${JSON.stringify(r.data)}`);
});

async function rejectedItem(productId, { failSelfTest = false } = {}) {
  const id = (await c.admin.post('/api/items', defectInput(productId))).data.id;
  await act(id, c.admin, 'assign', { assigned_to: ctx.users.dev.id });
  await act(id, c.dev, 'start_development');
  await act(id, c.dev, 'start_self_test', { implementation_notes: 'done' });
  if (failSelfTest) {
    await act(id, c.dev, 'record_self_test', { result: 'failed', tested_on: today(), notes: 'broken' });
    await act(id, c.dev, 'start_self_test', { implementation_notes: 'fixed' });
  }
  await act(id, c.dev, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
  await act(id, c.qa, 'start_qa');
  await act(id, c.qa, 'qa_reject', { tested_on: today(), notes: 'fails', observed: 'error shown' });
  return id;
}

async function report(params) {
  const res = await c.rm.get('/api/reports?' + new URLSearchParams(params));
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const r = res.data;
  const dev = r.developers.find((d) => d.name === 'DEV') || {};
  return {
    items: r.matrix.reduce((a, m) => a + m.n, 0),
    qa: Number(r.qa.total), rejected: Number(r.qa.rejected || 0),
    rejectedItems: r.mostRejected.map((x) => x.id).sort(),
    dev: { assigned: dev.assigned || 0, deployed: dev.deployed || 0, selfTestFailures: dev.self_test_failures || 0, rejections: dev.qa_rejections || 0 },
    deployed: r.cycleTime.reduce((a, x) => a + x.deployed, 0),
  };
}

describe('report filters', () => {
  test('product only (all time)', async () => {
    const r = await report({ product: ctx.productId });
    assert.equal(r.items, 2);
    assert.equal(r.qa, 2);
    assert.deepEqual(r.rejectedItems, [items.jan, items.feb].sort());
    assert.deepEqual(r.dev, { assigned: 2, deployed: 1, selfTestFailures: 1, rejections: 2 }, 'developer figures follow the product');
    const all = await report({ product: 'all' });
    assert.equal(all.items, 3);
    assert.deepEqual(all.dev, { assigned: 3, deployed: 1, selfTestFailures: 1, rejections: 3 });
    const otherOnly = await report({ product: other });
    assert.deepEqual(otherOnly.rejectedItems, [items.otherJan]);
    assert.deepEqual(otherOnly.dev, { assigned: 1, deployed: 0, selfTestFailures: 0, rejections: 1 });
  });

  test('a single day, in the viewer\'s time zone', async () => {
    const india = await report({ product: ctx.productId, from: '2026-01-10', to: '2026-01-10', tz: -330 });
    assert.equal(india.items, 1, 'created 01:30 on 10 Jan India time');
    assert.equal(india.qa, 1);
    assert.deepEqual(india.rejectedItems, [items.jan]);
    assert.deepEqual(india.dev, { assigned: 1, deployed: 0, selfTestFailures: 1, rejections: 1 });
    assert.equal(india.deployed, 0);
    const utc = await report({ product: ctx.productId, from: '2026-01-10', to: '2026-01-10', tz: 0 });
    assert.equal(utc.items, 0, 'still 9 Jan in UTC');
    assert.equal(utc.qa, 1);
    const prevDayUtc = await report({ product: ctx.productId, from: '2026-01-09', to: '2026-01-09', tz: 0 });
    assert.equal(prevDayUtc.items, 1);
    assert.equal(prevDayUtc.qa, 0);
  });

  test('day boundaries are exact', async () => {
    // 10 Jan in India is 09 Jan 18:30 → 10 Jan 18:30 UTC.
    ctx.db.prepare('UPDATE qa_verifications SET created_at = ? WHERE item_id = ?').run('2026-01-10T18:30:00.000Z', items.jan);
    assert.equal((await report({ product: ctx.productId, from: '2026-01-10', to: '2026-01-10', tz: -330 })).qa, 0, 'end is exclusive');
    assert.equal((await report({ product: ctx.productId, from: '2026-01-11', to: '2026-01-11', tz: -330 })).qa, 1, 'start is inclusive');
    ctx.db.prepare('UPDATE qa_verifications SET created_at = ? WHERE item_id = ?').run('2026-01-10T12:00:00.000Z', items.jan);
  });

  test('month and custom ranges', async () => {
    const jan = await report({ product: ctx.productId, from: '2026-01-01', to: '2026-01-31', tz: -330 });
    assert.deepEqual([jan.items, jan.qa, jan.rejectedItems], [1, 1, [items.jan]]);
    const feb = await report({ product: ctx.productId, from: '2026-02-01', to: '2026-02-28', tz: -330 });
    assert.deepEqual([feb.items, feb.qa, feb.rejectedItems, feb.deployed], [1, 1, [items.feb], 1]);
    assert.deepEqual(feb.dev, { assigned: 1, deployed: 1, selfTestFailures: 0, rejections: 1 });
    const deployDay = await report({ product: ctx.productId, from: '2026-02-20', to: '2026-02-20', tz: -330 });
    assert.deepEqual([deployDay.items, deployDay.qa, deployDay.deployed, deployDay.dev.deployed], [0, 0, 1, 1], 'counted on the day it was deployed');
    const openStart = await report({ product: ctx.productId, from: '2026-02-01', tz: -330 });
    assert.equal(openStart.items, 1);
    const openEnd = await report({ product: ctx.productId, to: '2026-01-31', tz: -330 });
    assert.equal(openEnd.items, 1);
    const empty = await report({ product: ctx.productId, from: '2025-06-01', to: '2025-06-30', tz: -330 });
    assert.deepEqual([empty.items, empty.qa, empty.rejectedItems, empty.deployed], [0, 0, [], 0]);
    assert.deepEqual(empty.dev, { assigned: 0, deployed: 0, selfTestFailures: 0, rejections: 0 });
  });

  test('product and date range together', async () => {
    const r = await report({ product: other, from: '2026-01-10', to: '2026-01-10', tz: -330 });
    assert.deepEqual([r.items, r.qa, r.rejectedItems], [1, 1, [items.otherJan]]);
    const all = await report({ product: 'all', from: '2026-01-10', to: '2026-01-10', tz: -330 });
    assert.deepEqual([all.items, all.qa], [2, 2]);
  });

  test('invalid ranges', async () => {
    const res = await c.rm.get('/api/reports?from=2026-02-01&to=2026-01-01');
    assert.equal(res.status, 400);
    assert.ok(res.data.fields.from);
    // Malformed dates and time zones are ignored rather than trusted.
    const r = await report({ product: ctx.productId, from: "2026-01-01' OR 1=1 --", tz: '9999' });
    assert.equal(r.items, 2);
    assert.equal((await c.anon.get('/api/reports')).status, 401);
  });
});
