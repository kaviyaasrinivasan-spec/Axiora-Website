import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { clients, defectInput, startTestServer, today } from './helpers.js';

let ctx;
let c;

before(async () => {
  ctx = await startTestServer();
  c = await clients(ctx);
});
after(() => ctx.close());

async function newItem(extra = {}) {
  const res = await c.admin.post('/api/items', defectInput(ctx.productId, extra));
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.id;
}

const act = (client, id, action, body = {}, opts) => client.post(`/api/items/${id}/actions/${action}`, body, opts);

/** Drives an item from creation to QA Approved, asserting every step. */
async function toApproved(id) {
  assert.equal((await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id })).status, 200);
  assert.equal((await act(c.dev, id, 'start_development')).status, 200);
  assert.equal((await act(c.dev, id, 'start_self_test', { implementation_notes: 'Fixed the job number lookup.' })).status, 200);
  const st = await act(c.dev, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'Tested 5 scenarios.', submit: 'true' });
  assert.equal(st.status, 200, JSON.stringify(st.data));
  assert.equal(st.data.item.status, 'ready_for_qa');
  assert.equal((await act(c.qa, id, 'start_qa')).status, 200);
  const ok = await act(c.qa, id, 'qa_approve', { tested_on: today(), notes: 'Verified with multiple jobs.' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.item.status, 'qa_approved');
}

describe('authentication and RBAC', () => {
  test('API requires a session', async () => {
    assert.equal((await c.anon.get('/api/items')).status, 401);
    assert.equal((await c.anon.post('/api/items', defectInput(ctx.productId))).status, 401);
  });

  test('state-changing requests without the CSRF header are refused', async () => {
    const res = await c.admin.request('POST', '/api/items', defectInput(ctx.productId), { csrf: false });
    assert.equal(res.status, 403);
  });

  test('wrong password is rejected', async () => {
    const res = await c.anon.post('/api/auth/login', { email: 'admin@test.local', password: 'nope-nope-nope' });
    assert.equal(res.status, 401);
  });

  test('developers and QA can create items; everyone can assign; release managers cannot create', async () => {
    const devItem = await c.dev.post('/api/items', defectInput(ctx.productId, { assigned_to: ctx.users.dev2.id }));
    assert.equal(devItem.status, 201, JSON.stringify(devItem.data));
    assert.equal((await c.dev.get(`/api/items/${devItem.data.id}`)).data.item.status, 'assigned');
    const qaItem = await c.qa.post('/api/items', defectInput(ctx.productId));
    assert.equal(qaItem.status, 201);
    assert.equal((await act(c.qa, qaItem.data.id, 'assign', { assigned_to: ctx.users.dev.id })).status, 200);
    assert.equal((await act(c.dev, qaItem.data.id, 'assign', { assigned_to: ctx.users.dev2.id })).status, 200, 'developer can reassign');
    assert.equal((await c.rm.post('/api/items', defectInput(ctx.productId))).status, 403);
    assert.equal((await act(c.rm, qaItem.data.id, 'assign', { assigned_to: ctx.users.dev.id })).status, 200, 'release manager can assign');
    const meta = (await c.dev.get('/api/meta')).data.permissions;
    assert.equal(meta.createItem && meta.assign, true);
    assert.equal((await c.rm.get('/api/meta')).data.permissions.assign, true);
  });

  test('only admins manage users and products', async () => {
    assert.equal((await c.dev.get('/api/users')).status, 403);
    assert.equal((await c.qa.post('/api/products', { name: 'X' })).status, 403);
  });
});

describe('deleting items', () => {
  test('any signed-in user can delete an item with its history and files', async () => {
    const res = await c.admin.post('/api/items', { ...defectInput(ctx.productId), files: [{ name: 'shot.png', content: 'png' }] }, { form: true });
    const id = res.data.id;
    await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id });
    await c.qa.post(`/api/items/${id}/comments`, { body: 'note' });
    const detail = (await c.admin.get(`/api/items/${id}`)).data;
    for (const client of [c.admin, c.dev, c.dev2, c.qa, c.qa2, c.rm]) assert.equal((await client.get(`/api/items/${id}`)).data.canDelete, true);
    assert.equal((await c.anon.del(`/api/items/${id}`)).status, 401, 'signed-out users cannot');
    const stored = ctx.db.prepare('SELECT stored_name FROM attachments WHERE item_id = ?').get(id).stored_name;

    // A release manager (who did not create it and is not assigned) deletes it.
    const del = await c.rm.del(`/api/items/${id}`);
    assert.equal(del.status, 200, JSON.stringify(del.data));
    assert.equal((await c.admin.get(`/api/items/${id}`)).status, 404);
    for (const t of ['attachments', 'comments', 'activity']) {
      assert.equal(ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE item_id = ?`).get(id).n, 0, t);
    }
    assert.equal(fs.existsSync(`${ctx.tmp}/uploads/${stored}`), false, 'attachment file removed');
    const audit = ctx.db.prepare("SELECT details FROM activity WHERE action = 'item_deleted' ORDER BY id DESC").get();
    assert.match(audit.details, new RegExp(detail.item.item_key));
  });

  test('items in production cannot be deleted', async () => {
    const id = await newItem();
    await toApproved(id);
    assert.equal((await c.admin.get(`/api/items/${id}`)).data.canDelete, true, 'still deletable before production');
    await act(c.rm, id, 'move_to_production');
    assert.equal((await c.admin.get(`/api/items/${id}`)).data.canDelete, false);
    assert.equal((await c.admin.del(`/api/items/${id}`)).status, 409, 'deployed');
    for (const client of [c.dev, c.qa, c.rm]) {
      const d = (await client.get(`/api/items/${id}`)).data;
      assert.deepEqual([d.canEdit, d.canDelete], [false, false]);
      assert.equal((await client.del(`/api/items/${id}`)).status, 409);
      assert.equal((await client.patch(`/api/items/${id}`, { title: 'x' })).status, 403);
    }
  });
});

describe('item creation', () => {
  test('defects require reproduction details and get an auto-generated ID', async () => {
    const bad = await c.admin.post('/api/items', { category: 'defect', title: 'x', description: 'y', product_id: ctx.productId, priority: 'low', requested_by: 'me' });
    assert.equal(bad.status, 400);
    assert.ok(bad.data.fields.steps_to_reproduce && bad.data.fields.actual_behaviour);
    const id = await newItem();
    const detail = await c.admin.get(`/api/items/${id}`);
    assert.match(detail.data.item.item_key, /^CD-\d{4}$/);
    assert.equal(detail.data.item.status, 'new');
  });

  test('requirements require acceptance criteria', async () => {
    const res = await c.admin.post('/api/items', { category: 'requirement', title: 'Filter', description: 'Add filter', product_id: ctx.productId, priority: 'high', requested_by: 'Ops' });
    assert.equal(res.status, 400);
    assert.ok(res.data.fields.acceptance_criteria);
  });

  test('attachments are stored with a safe name and blocked types are refused', async () => {
    const ok = await c.admin.post('/api/items', { ...defectInput(ctx.productId), files: [{ name: 'shot.png', content: 'png-bytes' }] }, { form: true });
    assert.equal(ok.status, 201, JSON.stringify(ok.data));
    const detail = await c.admin.get(`/api/items/${ok.data.id}`);
    assert.equal(detail.data.attachments.length, 1);
    const file = await c.admin.get(`/api/attachments/${detail.data.attachments[0].id}`);
    assert.equal(file.status, 200);
    const bad = await c.admin.post('/api/items', { ...defectInput(ctx.productId), files: [{ name: 'evil.html', content: '<script>' }] }, { form: true });
    assert.equal(bad.status, 400);
  });

  test('many attachments can be saved at once (more than the old limit of 10)', async () => {
    const files = Array.from({ length: 15 }, (_, i) => ({ name: `evidence-${i + 1}.png`, content: `png-${i}` }));
    const res = await c.admin.post('/api/items', { ...defectInput(ctx.productId), files }, { form: true });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const detail = (await c.admin.get(`/api/items/${res.data.id}`)).data;
    assert.equal(detail.attachments.length, 15);
    assert.deepEqual(detail.attachments.map((a) => a.original_name), files.map((f) => f.name));
    assert.ok((await c.admin.get('/api/meta')).data.uploads.maxFiles >= 15);
  });

  test('status and assignment cannot be edited directly', async () => {
    const id = await newItem();
    assert.equal((await c.admin.patch(`/api/items/${id}`, { status: 'deployed' })).status, 400);
    assert.equal((await c.admin.patch(`/api/items/${id}`, { assigned_to: ctx.users.dev.id })).status, 400);
    const edit = await c.admin.patch(`/api/items/${id}`, { priority: 'low', title: 'Renamed' });
    assert.equal(edit.status, 200);
    const audit = edit.data.activity.find((a) => a.action === 'updated');
    assert.deepEqual(Object.keys(audit.details.changes).sort(), ['priority', 'title']);
  });
});

describe('development and self-test', () => {
  test('anyone can do the development steps, not only the assigned developer', async () => {
    const id = await newItem();
    await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id });
    assert.equal((await act(c.dev2, id, 'start_development')).status, 200);
    assert.equal((await act(c.qa, id, 'start_self_test', { implementation_notes: 'done by QA' })).status, 200);
    const res = await act(c.rm, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
    assert.equal(res.data.item.status, 'ready_for_qa');
    assert.equal(res.data.item.assigned_to, ctx.users.dev.id, 'the assigned developer is unchanged');
  });

  test('cannot submit to QA without a passed self-test', async () => {
    const id = await newItem();
    await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id });
    // Skipping straight to QA is impossible from In Development.
    await act(c.dev, id, 'start_development');
    assert.equal((await act(c.dev, id, 'submit_to_qa')).status, 409);
    // Self-test requires implementation notes.
    assert.equal((await act(c.dev, id, 'start_self_test')).status, 400);
    assert.equal((await act(c.dev, id, 'start_self_test', { implementation_notes: 'Changed X' })).status, 200);
    assert.equal((await act(c.dev, id, 'submit_to_qa')).status, 409);
    // A failed self-test cannot be submitted and returns the item to In Development.
    const failSubmit = await act(c.dev, id, 'record_self_test', { result: 'failed', tested_on: today(), notes: 'Broke', submit: 'true' });
    assert.equal(failSubmit.status, 400);
    const failed = await act(c.dev, id, 'record_self_test', { result: 'failed', tested_on: today(), notes: 'Edge case broken' });
    assert.equal(failed.status, 200);
    assert.equal(failed.data.item.status, 'in_development');
    // Re-entering self-test resets the result; a passed record unlocks submission.
    await act(c.dev, id, 'start_self_test');
    assert.equal((await act(c.dev, id, 'submit_to_qa')).status, 409);
    await act(c.dev, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'All good' });
    const sub = await act(c.dev, id, 'submit_to_qa');
    assert.equal(sub.status, 200);
    assert.equal(sub.data.item.status, 'ready_for_qa');
    assert.equal(sub.data.selfTests.length, 2, 'both self-test results are preserved');
  });

  test('self-test date cannot be in the future', async () => {
    const id = await newItem();
    await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id });
    await act(c.dev, id, 'start_development');
    await act(c.dev, id, 'start_self_test', { implementation_notes: 'n' });
    const res = await act(c.dev, id, 'record_self_test', { result: 'passed', tested_on: '2999-01-01', notes: 'x' });
    assert.equal(res.status, 400);
    assert.ok(res.data.fields.tested_on);
  });
});

describe('QA verification', () => {
  test('the same person may develop and verify a change', async () => {
    const id = await newItem();
    await act(c.dev, id, 'assign', { assigned_to: ctx.users.dev.id });
    await act(c.dev, id, 'start_development');
    await act(c.dev, id, 'start_self_test', { implementation_notes: 'Did it' });
    await act(c.dev, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
    assert.equal((await act(c.dev, id, 'start_qa')).status, 200);
    const res = await act(c.dev, id, 'qa_approve', { tested_on: today(), notes: 'verified' });
    assert.equal(res.data.item.status, 'qa_approved');
    assert.equal(res.data.item.qa_by, ctx.users.dev.id);
  });

  test('approval requires verification notes; rejection requires reason and evidence', async () => {
    const id = await newItem();
    await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id });
    await act(c.dev, id, 'start_development');
    await act(c.dev, id, 'start_self_test', { implementation_notes: 'n' });
    await act(c.dev, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
    assert.equal((await act(c.qa, id, 'qa_approve', { tested_on: today() })).status, 409, 'cannot approve before starting QA');
    await act(c.qa, id, 'start_qa');
    assert.equal((await act(c.qa, id, 'qa_approve', { tested_on: today() })).status, 400);
    assert.equal((await act(c.qa, id, 'qa_reject', { tested_on: today() })).status, 400);
    assert.equal((await act(c.qa, id, 'qa_reject', { tested_on: today(), notes: 'Wrong total' })).status, 400, 'evidence required');
  });

  test('rejected items return to the developer and must be self-tested again', async () => {
    const id = await newItem();
    await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id });
    await act(c.dev, id, 'start_development');
    await act(c.dev, id, 'start_self_test', { implementation_notes: 'v1' });
    await act(c.dev, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
    await act(c.qa, id, 'start_qa');
    const rej = await act(c.qa, id, 'qa_reject', { tested_on: today(), notes: 'Total is wrong', observed: 'Shows 0 instead of 12' });
    assert.equal(rej.status, 200);
    assert.equal(rej.data.item.status, 'qa_rejected');
    // Cannot be approved or queued for production from Rejected.
    assert.equal((await act(c.qa, id, 'qa_approve', { tested_on: today(), notes: 'x' })).status, 409);
    assert.equal((await act(c.rm, id, 'queue_for_production')).status, 409);
    // Developer fixes; the earlier passed self-test no longer counts.
    const fix = await act(c.dev, id, 'start_fix');
    assert.equal(fix.data.item.status, 'in_development');
    assert.equal(fix.data.item.dev_cycle, 2);
    await act(c.dev, id, 'start_self_test', { implementation_notes: 'v2' });
    assert.equal((await act(c.dev, id, 'submit_to_qa')).status, 409);
    const resubmitted = await act(c.dev, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'fixed', submit: 'true' });
    assert.equal(resubmitted.data.item.qa_by, ctx.users.qa.id, 'the QA who rejected it stays assigned for the re-test');
    // Anyone may pick it up; whoever starts verification becomes its QA engineer.
    assert.equal((await act(c.qa2, id, 'start_qa')).data.item.qa_by, ctx.users.qa2.id);
    const ok = await act(c.qa2, id, 'qa_approve', { tested_on: today(), notes: 'Total now correct' });
    assert.equal(ok.data.item.status, 'qa_approved');
    assert.equal(ok.data.verifications.length, 2, 'rejection history is preserved');
    assert.deepEqual(ok.data.verifications.map((v) => v.result), ['approved', 'rejected']);
  });
});

describe('planning status', () => {
  const WORKFLOW_FIELDS = ['status', 'assigned_to', 'qa_by', 'dev_cycle', 'current_self_test_id', 'release_id', 'deployed_at', 'deployed_version'];
  const pick = (item) => Object.fromEntries(WORKFLOW_FIELDS.map((k) => [k, item[k]]));
  const setPlanning = (client, id, planning_status) => client.post(`/api/items/${id}/planning`, { planning_status });

  test('defaults to Backlog, accepts a chosen value and rejects unknown ones', async () => {
    const meta = (await c.admin.get('/api/meta')).data;
    assert.deepEqual(meta.planningStatuses, { backlog: 'Backlog', planned: 'Planned', active: 'Active', on_hold: 'On Hold', completed: 'Completed' });
    const a = await newItem();
    assert.equal((await c.admin.get(`/api/items/${a}`)).data.item.planning_status, 'backlog');
    const b = await newItem({ planning_status: 'planned' });
    assert.equal((await c.admin.get(`/api/items/${b}`)).data.item.planning_status, 'planned');
    assert.equal((await c.admin.post('/api/items', defectInput(ctx.productId, { planning_status: 'someday' }))).status, 400);
    assert.equal((await setPlanning(c.admin, a, 'someday')).status, 400);
    assert.equal((await setPlanning(c.admin, a, '')).status, 400);
  });

  test('changing it never touches the workflow, at any stage, and is audited separately', async () => {
    const id = await newItem();
    await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id });
    await act(c.dev, id, 'start_development');
    await act(c.dev, id, 'start_self_test', { implementation_notes: 'n' });
    await act(c.dev, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
    await act(c.qa, id, 'start_qa');
    const before = (await c.admin.get(`/api/items/${id}`)).data;
    const clients = [c.rm, c.dev2, c.qa2, c.dev, c.qa];
    const actionsBefore = await Promise.all(clients.map(async (cl) => (await cl.get(`/api/items/${id}`)).data.actions));

    // Every role can change it, including ones with no workflow rights at this stage.
    for (const [client, value] of [[c.rm, 'planned'], [c.dev2, 'completed'], [c.qa2, 'on_hold'], [c.dev, 'active']]) {
      const res = await setPlanning(client, id, value);
      assert.equal(res.status, 200, JSON.stringify(res.data));
      assert.equal(res.data.item.planning_status, value);
      assert.deepEqual(pick(res.data.item), pick(before.item), 'workflow fields unchanged');
    }
    // Each user's available workflow actions are exactly what they were before.
    const actionsAfter = await Promise.all(clients.map(async (cl) => (await cl.get(`/api/items/${id}`)).data.actions));
    assert.deepEqual(actionsAfter, actionsBefore);
    const after = (await c.qa.get(`/api/items/${id}`)).data;
    assert.ok(after.actions.includes('qa_approve'), 'QA can still continue the workflow');
    const changes = after.activity.filter((a) => a.action === 'planning_changed');
    assert.equal(changes.length, 4);
    assert.deepEqual(changes.map((a) => [a.from_status, a.to_status]), [[null, null], [null, null], [null, null], [null, null]], 'kept out of the workflow trail');
    assert.deepEqual(changes[0].details, { from: 'Backlog', to: 'Planned' });
    assert.deepEqual(changes[1].details, { from: 'Planned', to: 'Completed' });
    // Setting the same value again is a no-op.
    await setPlanning(c.dev, id, 'active');
    assert.equal((await c.qa.get(`/api/items/${id}`)).data.activity.filter((a) => a.action === 'planning_changed').length, 4);
    // The workflow still finishes normally afterwards.
    assert.equal((await act(c.qa, id, 'qa_approve', { tested_on: today(), notes: 'ok' })).data.item.status, 'qa_approved');
  });

  test('list filter, CSV column and deployed items', async () => {
    const id = await newItem({ planning_status: 'on_hold' });
    const list = (await c.admin.get('/api/items?planning=on_hold&pageSize=100')).data.items;
    assert.ok(list.length >= 1 && list.every((i) => i.planning_status === 'on_hold'));
    assert.ok(list.some((i) => i.id === id));
    const csv = (await c.admin.get('/api/items/export.csv?planning=on_hold')).data;
    assert.match(csv, /"Planning Status"/);
    assert.match(csv, /"On Hold"/);
    const deployed = ctx.db.prepare("SELECT id FROM items WHERE status = 'deployed' LIMIT 1").get();
    if (deployed) {
      const res = await setPlanning(c.admin, deployed.id, 'planned');
      assert.equal(res.data.item.status, 'deployed');
    }
  });
});

describe('priority from the list', () => {
  test('anyone can change priority and edit details until the item is in production; changes are audited', async () => {
    const id = await newItem({ priority: 'medium', title: 'Inline priority check' });
    const row = async (client) => (await client.get(`/api/items?q=Inline%20priority%20check&pageSize=100`)).data.items.find((i) => i.id === id);
    for (const client of [c.admin, c.dev, c.qa, c.rm]) assert.equal((await row(client)).can_edit, true);
    assert.equal((await c.qa.get(`/api/items/${id}`)).data.canEdit, true);
    const res = await c.dev.patch(`/api/items/${id}`, { priority: 'high' });
    assert.equal(res.status, 200);
    assert.equal(res.data.item.priority, 'high');
    assert.equal(res.data.item.status, 'new', 'workflow untouched');
    const audit = res.data.activity.find((a) => a.action === 'updated');
    assert.deepEqual(audit.details.changes.priority, { label: 'Priority', from: 'Medium', to: 'High' });
  });
});

describe('blocker priority', () => {
  test('blocker is the top priority: listed first, sorted first and counted as urgent', async () => {
    const meta = (await c.qa.get('/api/meta')).data;
    assert.equal(Object.keys(meta.priorities)[0], 'blocker');
    assert.equal(meta.priorities.blocker, 'Blocker');
    const id = await newItem({ priority: 'blocker', title: 'Checkout completely down' });
    assert.equal((await c.admin.get('/api/items?sort=priority&pageSize=1')).data.items[0].id, id);
    assert.equal((await c.admin.get('/api/items?priority=blocker')).data.total, 1);
    const dash = (await c.admin.get('/api/dashboard')).data;
    assert.equal(dash.openByPriority.blocker, 1);
    assert.equal(dash.urgentDefects.items[0].id, id, 'blocker defects lead the urgent list');
    assert.equal((await c.admin.patch(`/api/items/${id}`, { priority: 'urgent' })).status, 400, 'unknown priorities are still rejected');
  });
});

describe('QA assignment', () => {
  async function readyForQa() {
    const id = await newItem();
    await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id });
    await act(c.dev, id, 'start_development');
    await act(c.dev, id, 'start_self_test', { implementation_notes: 'n' });
    await act(c.dev, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
    return id;
  }

  test('items are distributed to QA engineers; anyone may still verify them', async () => {
    const a = await readyForQa();
    const b = await readyForQa();
    assert.equal((await act(c.admin, a, 'assign_qa', { qa_by: ctx.users.dev.id })).status, 400, 'a developer is not in the QA picker');
    assert.equal((await act(c.admin, a, 'assign_qa', { qa_by: ctx.users.qa.id })).status, 200);
    assert.equal((await act(c.admin, b, 'assign_qa', { qa_by: ctx.users.qa2.id })).status, 200);
    assert.equal((await act(c.admin, a, 'assign_qa', { qa_by: ctx.users.qa.id })).status, 400, 'already assigned');

    // Each QA engineer sees their own item in My Work.
    const mine = (await c.qa.get('/api/items?view=my&pageSize=100')).data.items.map((i) => i.id);
    assert.ok(mine.includes(a) && !mine.includes(b));
    assert.equal((await act(c.qa, a, 'start_qa')).status, 200);
    assert.equal((await act(c.qa2, b, 'start_qa')).status, 200);
    // Anyone may record the result, not only the QA engineer verifying it.
    assert.equal((await act(c.qa2, a, 'qa_approve', { tested_on: today(), notes: 'Verified by a colleague' })).status, 200);
    const detail = (await act(c.qa2, b, 'qa_approve', { tested_on: today(), notes: 'Verified' })).data;
    assert.equal(detail.item.status, 'qa_approved');
    assert.equal(detail.item.qa_by_name, 'QA2');
    assert.ok(detail.activity.some((x) => x.action === 'assign_qa' && x.details.qa === 'QA2'));
  });

  test('QA filter and list columns', async () => {
    const id = await readyForQa();
    await act(c.admin, id, 'assign_qa', { qa_by: ctx.users.qa2.id });
    const qaList = (await c.qa2.get('/api/items?view=qa&qa=me&pageSize=100')).data.items;
    assert.ok(qaList.some((i) => i.id === id && i.qa_name === 'QA2'));
    const unassigned = (await c.qa.get('/api/items?view=qa&qa=none&pageSize=100')).data.items;
    assert.ok(unassigned.every((i) => i.qa_by === null));
    const open = (await c.qa.get('/api/items?view=qa&qa=mine_open&pageSize=100')).data.items;
    assert.ok(open.every((i) => i.qa_by === null || i.qa_by === ctx.users.qa.id));
    assert.ok(!open.some((i) => i.id === id), "another engineer's item is not in Mine + unassigned");
  });

  test('the person who built the change can be assigned to verify it', async () => {
    const id = await newItem();
    await act(c.admin, id, 'assign', { assigned_to: ctx.users.admin.id });
    await act(c.admin, id, 'start_development');
    await act(c.admin, id, 'start_self_test', { implementation_notes: 'n' });
    await act(c.admin, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
    const res = await act(c.dev, id, 'assign_qa', { qa_by: ctx.users.admin.id });
    assert.equal(res.status, 200);
    assert.equal(res.data.item.qa_by, ctx.users.admin.id);
  });
});

describe('moving to production', () => {
  test('only QA-approved items can be queued or moved to production', async () => {
    const id = await newItem();
    assert.equal((await act(c.rm, id, 'queue_for_production')).status, 409);
    assert.equal((await act(c.rm, id, 'move_to_production')).status, 409);
    assert.equal((await c.rm.get('/api/releases')).status, 404, 'the releases API is gone');
  });

  test('every role is offered Move to Production', async () => {
    const id = await newItem();
    await toApproved(id);
    for (const client of [c.admin, c.dev, c.dev2, c.qa, c.qa2, c.rm]) {
      assert.ok((await client.get(`/api/items/${id}`)).data.actions.includes('move_to_production'));
    }
    assert.equal((await act(c.dev2, id, 'move_to_production')).data.item.status, 'deployed');
  });

  test('straight from QA Approved, with notes and files', async () => {
    const id = await newItem();
    await toApproved(id);
    const res = await c.rm.post(`/api/items/${id}/actions/move_to_production`,
      { notes: 'Live in v1.3', files: [{ name: 'deploy-log.txt', content: 'deployed ok' }] }, { form: true });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const d = (await c.rm.get(`/api/items/${id}`)).data;
    assert.equal(d.item.status, 'deployed');
    assert.equal(d.item.deployed_by, ctx.users.rm.id);
    assert.ok(d.item.deployed_at);
    assert.equal(d.deploymentAttachments.length, 1);
    assert.equal(d.deploymentAttachments[0].original_name, 'deploy-log.txt');
    assert.equal(d.attachments.length, 0, 'production files are kept apart from the item attachments');
    const move = d.activity.at(-1);
    assert.deepEqual([move.action, move.from_status, move.to_status, move.details.notes], ['move_to_production', 'qa_approved', 'deployed', 'Live in v1.3']);
    assert.deepEqual(d.actions, ['verify_in_production'], 'only verification is left');
    assert.equal((await act(c.rm, id, 'move_to_production')).status, 409, 'only once');
  });

  test('through the production queue', async () => {
    const id = await newItem({ category: 'requirement', acceptance_criteria: 'Filter works' });
    await toApproved(id);
    // QA approval and production readiness are separate statuses.
    assert.equal((await act(c.rm, id, 'queue_for_production')).data.item.status, 'ready_for_production');
    const queue = (await c.rm.get('/api/items?view=production&pageSize=100')).data.items;
    assert.ok(queue.some((i) => i.id === id), 'listed in the Production Queue');
    const res = await act(c.admin, id, 'move_to_production');
    assert.equal(res.data.item.status, 'deployed');
    assert.equal(res.data.item.deployed_by, ctx.users.admin.id);
    assert.ok(!(await c.rm.get('/api/items?view=production&pageSize=100')).data.items.some((i) => i.id === id), 'leaves the queue');
    assert.deepEqual(res.data.activity.filter((a) => a.to_status).map((a) => a.to_status).slice(-2), ['ready_for_production', 'deployed']);
  });

  test('verify in production: only after deployment, by anyone, and the item then leaves the open lists', async () => {
    const id = await newItem();
    await toApproved(id);
    assert.equal((await act(c.qa, id, 'verify_in_production')).status, 409, 'not before it is in production');
    await act(c.rm, id, 'move_to_production');
    assert.ok((await c.dev2.get(`/api/items/${id}`)).data.actions.includes('verify_in_production'));
    const res = await c.dev2.post(`/api/items/${id}/actions/verify_in_production`,
      { notes: 'Checked live', files: [{ name: 'live.png', content: 'png' }] }, { form: true });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    const d = res.data;
    assert.equal(d.item.status, 'verified');
    assert.equal(d.item.verified_by_name, 'DEV2');
    assert.ok(d.item.verified_at);
    assert.equal(d.item.deployed_by, ctx.users.rm.id, 'deployment record kept');
    assert.deepEqual([d.activity.at(-1).from_status, d.activity.at(-1).to_status, d.activity.at(-1).details.notes], ['deployed', 'verified', 'Checked live']);
    assert.equal(d.deploymentAttachments.length, 1);
    assert.deepEqual(d.actions, [], 'final stage');
    assert.equal(d.canEdit, false);
    assert.equal(d.canDelete, false);
    assert.equal((await c.admin.del(`/api/items/${id}`)).status, 409);
    const ids = async (q) => (await c.admin.get(`/api/items?product=all&pageSize=200${q}`)).data.items.map((i) => i.id);
    assert.ok(!(await ids('&open=1')).includes(id), 'not on All Items');
    assert.ok(!(await ids('&status=deployed')).includes(id), 'not on Deployed to Production');
    assert.ok((await ids('&status=verified')).includes(id), 'on Verified in Production');
    const dash = (await c.admin.get('/api/dashboard?product=all')).data;
    assert.equal(dash.cards.verified, ctx.db.prepare("SELECT COUNT(*) AS n FROM items WHERE status = 'verified'").get().n);
  });

  test('return for investigation restarts development', async () => {
    const id = await newItem();
    await toApproved(id);
    await act(c.rm, id, 'queue_for_production');
    assert.equal((await act(c.rm, id, 'return_for_investigation')).status, 400, 'reason required');
    const res = await act(c.rm, id, 'return_for_investigation', { reason: 'Conflicts with hotfix' });
    assert.equal(res.data.item.status, 'in_development');
    assert.equal(res.data.item.qa_by, null);
  });
});

describe('audit trail and dashboard', () => {
  test('every transition is attributed in the activity log', async () => {
    const id = await newItem();
    await toApproved(id);
    const { activity } = (await c.admin.get(`/api/items/${id}`)).data;
    const transitions = activity.filter((a) => a.to_status && a.from_status !== a.to_status).map((a) => [a.from_status, a.to_status]);
    assert.deepEqual(transitions, [
      [null, 'new'], ['new', 'assigned'], ['assigned', 'in_development'], ['in_development', 'self_test'], ['self_test', 'ready_for_qa'],
      ['ready_for_qa', 'qa_in_progress'], ['qa_in_progress', 'qa_approved'],
    ]);
    assert.ok(activity.every((a) => a.user_name && a.created_at));
  });

  test('dashboard counts equal database counts and list totals', async () => {
    const dash = (await c.admin.get('/api/dashboard')).data;
    const q = (sql, ...p) => ctx.db.prepare(sql).get(...p).n;
    assert.equal(dash.cards.total, q('SELECT COUNT(*) AS n FROM items'));
    assert.equal(dash.cards.defects, q("SELECT COUNT(*) AS n FROM items WHERE category = 'defect'"));
    assert.equal(dash.cards.requirements, q("SELECT COUNT(*) AS n FROM items WHERE category = 'requirement'"));
    assert.equal(dash.cards.deployed, q("SELECT COUNT(*) AS n FROM items WHERE status = 'deployed'"));
    assert.equal(dash.cards.awaiting_qa, q("SELECT COUNT(*) AS n FROM items WHERE status IN ('ready_for_qa', 'qa_in_progress')"));
    const list = (await c.admin.get('/api/items?status=ready_for_qa,qa_in_progress')).data;
    assert.equal(list.total, dash.cards.awaiting_qa);
    // Filters apply to the dashboard too.
    const defectsOnly = (await c.admin.get('/api/dashboard?category=defect')).data;
    assert.equal(defectsOnly.cards.requirements, 0);
    assert.equal(defectsOnly.cards.total, dash.cards.defects);
  });

  test('item list supports search, filters and pagination', async () => {
    const page = (await c.admin.get('/api/items?pageSize=2&page=1')).data;
    assert.equal(page.items.length, 2);
    assert.ok(page.total > 2);
    const search = (await c.admin.get('/api/items?q=%25')).data;
    assert.equal(search.total, 0, 'LIKE wildcards are escaped');
    const csv = await c.admin.get('/api/items/export.csv?category=defect');
    assert.equal(csv.status, 200);
    assert.match(csv.data, /CD-\d{4}/);
  });
});

test('uploads directory contains only randomly named files', () => {
  const dir = `${ctx.tmp}/uploads`;
  for (const f of fs.readdirSync(dir)) assert.match(f, /^[0-9a-f]{32}\.[a-z]+$/);
});
