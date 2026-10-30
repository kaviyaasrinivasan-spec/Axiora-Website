import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { clients, defectInput, startTestServer, today } from './helpers.js';

let ctx;
let c;

before(async () => {
  ctx = await startTestServer();
  c = await clients(ctx);
});
after(() => ctx.close());

const ROLES = ['admin', 'dev', 'dev2', 'qa', 'qa2', 'rm'];
const act = (client, id, action, body = {}) => client.post(`/api/items/${id}/actions/${action}`, body);
const actions = async (client, id) => (await client.get(`/api/items/${id}`)).data.actions;
const putPerms = (client, permissions) => client.request('PUT', '/api/workflow-permissions', { permissions });

async function newItem() {
  const res = await c.admin.post('/api/items', defectInput(ctx.productId));
  assert.equal(res.status, 201);
  return res.data.id;
}

describe('every signed-in user can run the whole workflow', () => {
  for (const who of ROLES) {
    test(`${who} alone takes an item from New to Deployed, including a QA rejection and fix`, async () => {
      const me = c[who];
      const id = await newItem();
      // The item is assigned to someone else, so nothing here relies on being the assignee.
      const assignee = who === 'dev' ? ctx.users.dev2.id : ctx.users.dev.id;
      const steps = [
        ['assign', { assigned_to: assignee }, 'assigned'],
        ['start_development', {}, 'in_development'],
        ['start_self_test', { implementation_notes: 'Implemented' }, 'self_test'],
        ['record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' }, 'ready_for_qa'],
        ['assign_qa', { qa_by: ctx.users.qa2.id }, 'ready_for_qa'],
        ['start_qa', {}, 'qa_in_progress'],
        ['qa_reject', { tested_on: today(), notes: 'Wrong total', observed: 'Shows 0' }, 'qa_rejected'],
        ['start_fix', {}, 'in_development'],
        ['start_self_test', { implementation_notes: 'Fixed' }, 'self_test'],
        ['record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' }, 'ready_for_qa'],
        ['start_qa', {}, 'qa_in_progress'],
        ['qa_approve', { tested_on: today(), notes: 'Verified' }, 'qa_approved'],
        ['queue_for_production', {}, 'ready_for_production'],
        ['move_to_production', { notes: 'Live' }, 'deployed'],
      ];
      for (const [action, body, status] of steps) {
        assert.ok((await actions(me, id)).includes(action), `${who} is offered ${action}`);
        const res = await act(me, id, action, body);
        assert.equal(res.status, 200, `${who} ${action}: ${JSON.stringify(res.data)}`);
        assert.equal(res.data.item.status, status, `${who} ${action}`);
      }
      const { activity } = (await me.get(`/api/items/${id}`)).data;
      const moves = activity.filter((a) => a.action !== 'created' && a.to_status && a.from_status !== a.to_status);
      assert.ok(moves.every((a) => a.user_name === who.toUpperCase()), 'every step is recorded under the person who did it');
    });
  }

  test('return for investigation and moving straight from QA Approved are open to everyone too', async () => {
    for (const who of ['dev2', 'qa', 'rm']) {
      const id = await newItem();
      await act(c.admin, id, 'assign', { assigned_to: ctx.users.dev.id });
      for (const [a, b] of [['start_development', {}], ['start_self_test', { implementation_notes: 'n' }],
        ['record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' }], ['start_qa', {}],
        ['qa_approve', { tested_on: today(), notes: 'ok' }]]) await act(c[who], id, a, b);
      assert.equal((await act(c[who], id, 'return_for_investigation', { reason: 'Found an issue' })).data.item.status, 'in_development');
    }
  });
});

describe('what is still enforced', () => {
  test('stages cannot be skipped and required details are still required', async () => {
    const id = await newItem();
    assert.equal((await act(c.qa, id, 'start_development')).status, 409, 'must be assigned first');
    await act(c.qa, id, 'assign', { assigned_to: ctx.users.dev.id });
    assert.equal((await act(c.qa, id, 'start_qa')).status, 409, 'cannot jump to QA');
    assert.equal((await act(c.qa, id, 'move_to_production')).status, 409, 'cannot jump to production');
    await act(c.qa, id, 'start_development');
    assert.equal((await act(c.qa, id, 'start_self_test', {})).status, 400, 'implementation notes required');
    await act(c.qa, id, 'start_self_test', { implementation_notes: 'n' });
    assert.equal((await act(c.qa, id, 'submit_to_qa')).status, 409, 'needs a passed self-test');
    await act(c.qa, id, 'record_self_test', { result: 'passed', tested_on: today(), notes: 'ok', submit: 'true' });
    await act(c.qa, id, 'start_qa');
    assert.equal((await act(c.qa, id, 'qa_reject', { tested_on: today(), notes: 'x' })).status, 400, 'rejection needs evidence');
  });

  test('signed-out users and requests without the app header are refused', async () => {
    const id = await newItem();
    assert.equal((await c.anon.post(`/api/items/${id}/actions/assign`, { assigned_to: ctx.users.dev.id })).status, 401);
    const noHeader = await c.dev.request('POST', `/api/items/${id}/actions/assign`, { assigned_to: ctx.users.dev.id }, { csrf: false });
    assert.equal(noHeader.status, 403);
  });
});

describe('developer and QA picker settings', () => {
  test('only admins can read or change them', async () => {
    for (const client of [c.dev, c.qa, c.rm]) {
      assert.equal((await client.get('/api/workflow-permissions')).status, 403);
      assert.equal((await putPerms(client, { start_qa: ['qa'] })).status, 403);
    }
    assert.equal((await c.anon.get('/api/workflow-permissions')).status, 401);
    const res = await c.admin.get('/api/workflow-permissions');
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.permissions.map((p) => p.key), ['start_development', 'start_qa']);
  });

  test('invalid changes are rejected and nothing is saved', async () => {
    for (const bad of [{ assign: ['admin'] }, { start_qa: ['superuser'] }, { start_qa: [] }, { start_qa: 'admin' }]) {
      const res = await putPerms(c.admin, bad);
      assert.equal(res.status, 400, JSON.stringify(bad));
      assert.ok(res.data.fields, 'per-setting error');
    }
    const qa = (await c.admin.get('/api/workflow-permissions')).data.permissions.find((p) => p.key === 'start_qa');
    assert.deepEqual(qa.roles, ['qa', 'admin']);
  });

  test('they decide who can be chosen as developer or QA engineer, and can be restored', async () => {
    const id = await newItem();
    assert.equal((await act(c.admin, id, 'assign', { assigned_to: ctx.users.qa2.id })).status, 400, 'QA is not in the developer picker by default');
    assert.equal((await putPerms(c.admin, { start_development: ['developer', 'admin', 'qa'] })).status, 200);
    assert.ok((await c.admin.get('/api/meta')).data.workflowRoles.start_development.includes('qa'), 'pickers get the new roles');
    assert.equal((await act(c.admin, id, 'assign', { assigned_to: ctx.users.qa2.id })).status, 200);
    const audit = ctx.db.prepare("SELECT details FROM activity WHERE action = 'workflow_permissions_updated' ORDER BY id DESC").get();
    assert.deepEqual(JSON.parse(audit.details).changes.start_development, { from: ['developer', 'admin'], to: ['admin', 'developer', 'qa'] });
    const defaults = Object.fromEntries((await c.admin.get('/api/workflow-permissions')).data.permissions.map((p) => [p.key, p.defaultRoles]));
    const res = await putPerms(c.admin, defaults);
    assert.ok(res.data.permissions.every((p) => JSON.stringify(p.roles) === JSON.stringify(p.defaultRoles)));
  });
});
