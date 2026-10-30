import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { tx } from '../db.js';
import {
  badRequest, conflict, forbidden, HttpError, intOrNull, isDate, notFound, nowIso, optStr, str, todayIso, truthy,
} from '../util.js';
import {
  ACTIONS, CATEGORIES, hasPermission, PLANNING_STATUSES, CREATE_ROLES, GROUPS, PRIORITIES, STATUSES, allowedActions, canEditItem, checkAction,
} from '../workflow.js';
import { listActivity, logActivity } from './activity.js';
import { listAttachments, saveAttachments } from './attachments.js';
import { loadPermissions } from './permissions.js';

const SORTS = {
  updated: 'i.updated_at DESC',
  created: 'i.created_at DESC',
  priority: "CASE i.priority WHEN 'blocker' THEN 0 WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, i.updated_at DESC",
  key: 'i.id DESC',
  due: 'i.due_date IS NULL, i.due_date ASC',
};

// Fields an authorized user may edit after creation, with labels for the audit trail.
const EDITABLE = {
  title: 'Title', description: 'Description', product_id: 'Product', module: 'Module / Feature', priority: 'Priority',
  requested_by: 'Requested By', due_date: 'Due Date', steps_to_reproduce: 'Steps to Reproduce',
  expected_behaviour: 'Expected Behaviour', actual_behaviour: 'Actual Behaviour', environment: 'Environment',
  business_requirement: 'Business Requirement', acceptance_criteria: 'Acceptance Criteria',
};

const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
const listOf = (value, allowed) => String(value || '').split(',').map((s) => s.trim()).filter((s) => s in allowed);
const placeholders = (arr) => arr.map(() => '?').join(', ');

/**
 * Builds a WHERE clause from query-string filters. Shared by the item list, CSV export,
 * dashboard and reports so that every count is computed the same way.
 */
export function buildFilter(q, user, { skipStatus = false } = {}) {
  const where = [];
  const params = [];
  const text = str(q.q, { max: 200 });
  if (text) {
    const like = `%${likeEscape(text)}%`;
    where.push("(i.item_key LIKE ? ESCAPE '\\' OR i.title LIKE ? ESCAPE '\\' OR i.description LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  const product = intOrNull(q.product);
  if (product) { where.push('i.product_id = ?'); params.push(product); }
  if (q.category in CATEGORIES) { where.push('i.category = ?'); params.push(q.category); }
  const statuses = skipStatus ? [] : listOf(q.status, STATUSES);
  if (statuses.length) { where.push(`i.status IN (${placeholders(statuses)})`); params.push(...statuses); }
  const priorities = listOf(q.priority, PRIORITIES);
  if (priorities.length) { where.push(`i.priority IN (${placeholders(priorities)})`); params.push(...priorities); }
  if (q.assigned_to === 'me') { where.push('i.assigned_to = ?'); params.push(user.id); }
  else if (q.assigned_to === 'none') where.push('i.assigned_to IS NULL');
  else if (intOrNull(q.assigned_to)) { where.push('i.assigned_to = ?'); params.push(intOrNull(q.assigned_to)); }
  const requester = str(q.requested_by, { max: 200 });
  if (requester) { where.push('i.requested_by = ?'); params.push(requester); }
  if (isDate(q.from)) { where.push('i.created_at >= ?'); params.push(q.from); }
  if (isDate(q.to)) { where.push('i.created_at < ?'); params.push(nextDay(q.to)); }
  // QA engineer filter: me | none | mine_open (mine + unassigned) | user id; "all" or empty means everyone.
  if (q.qa === 'me') { where.push('i.qa_by = ?'); params.push(user.id); }
  else if (q.qa === 'none') where.push('i.qa_by IS NULL');
  else if (q.qa === 'mine_open') { where.push('(i.qa_by = ? OR i.qa_by IS NULL)'); params.push(user.id); }
  else if (intOrNull(q.qa)) { where.push('i.qa_by = ?'); params.push(intOrNull(q.qa)); }
  const planning = listOf(q.planning, PLANNING_STATUSES);
  if (planning.length) { where.push(`i.planning_status IN (${placeholders(planning)})`); params.push(...planning); }
  if (truthy(q.overdue)) { where.push("i.due_date < ? AND i.status NOT IN ('deployed', 'verified')"); params.push(todayIso()); }
  if (truthy(q.open)) where.push("i.status NOT IN ('deployed', 'verified')");

  if (q.view === 'my') {
    // Items waiting on the current user, based on their role.
    const parts = ["(i.assigned_to = ? AND i.status IN ('assigned', 'in_development', 'self_test', 'qa_rejected'))"];
    params.push(user.id);
    if (hasPermission(user.perms, 'start_qa', user)) { parts.push("(i.qa_by = ? AND i.status IN ('ready_for_qa', 'qa_in_progress'))"); params.push(user.id); }
    if (user.role === 'admin') parts.push("i.status = 'new'");
    if (['admin', 'release_manager'].includes(user.role)) parts.push("i.status = 'qa_approved'");
    where.push(`(${parts.join(' OR ')})`);
  } else if (q.view === 'qa') {
    where.push(`i.status IN (${placeholders(GROUPS.awaiting_qa)})`); params.push(...GROUPS.awaiting_qa);
  } else if (q.view === 'production') {
    where.push(`i.status IN (${placeholders(GROUPS.production_queue)})`); params.push(...GROUPS.production_queue);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function nextDay(date) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const LIST_COLUMNS = `i.id, i.item_key, i.title, i.category, i.priority, i.status, i.module, i.requested_by, i.due_date,
  i.created_at, i.updated_at, i.assigned_to, i.planning_status, i.created_by, p.name AS product_name, u.name AS assigned_name,
  i.qa_by, qa.name AS qa_name`;
const LIST_FROM = `FROM items i JOIN products p ON p.id = i.product_id LEFT JOIN users u ON u.id = i.assigned_to
  LEFT JOIN users qa ON qa.id = i.qa_by`;

export function listItems(db, q, user) {
  const { sql, params } = buildFilter(q, { ...user, perms: loadPermissions(db) });
  const pageSize = Math.min(Math.max(Number(q.pageSize) || 25, 1), 100);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM items i ${sql}`).get(...params).n;
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(Math.max(Number(q.page) || 1, 1), pages);
  const order = SORTS[q.sort] || SORTS.updated;
  const items = db.prepare(`SELECT ${LIST_COLUMNS} ${LIST_FROM} ${sql} ORDER BY ${order}, i.id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize)
    .map((i) => ({ ...i, can_edit: canEditItem(i) }));
  return { items, total, page, pageSize, pages };
}

export function exportItems(db, q, user) {
  const { sql, params } = buildFilter(q, { ...user, perms: loadPermissions(db) });
  return db.prepare(`SELECT ${LIST_COLUMNS}, i.deployed_at, i.deployed_version ${LIST_FROM} ${sql}
    ORDER BY ${SORTS[q.sort] || SORTS.updated}, i.id DESC LIMIT 10000`).all(...params);
}

function getItemRow(db, id) {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item) throw notFound('Item not found.');
  return item;
}

function actionContext(db, item, user) {
  const current = item.current_self_test_id
    ? db.prepare('SELECT result FROM self_tests WHERE id = ?').get(item.current_self_test_id) : null;
  return { selfTestPassed: current?.result === 'passed', perms: loadPermissions(db) };
}

export function getItemDetail(db, id, user) {
  const raw = getItemRow(db, id);
  const item = db.prepare(`SELECT i.*, p.name AS product_name, a.name AS assigned_name, c.name AS created_by_name,
      q.name AS qa_by_name, d.name AS deployed_by_name, vb.name AS verified_by_name
    FROM items i JOIN products p ON p.id = i.product_id LEFT JOIN users a ON a.id = i.assigned_to
    JOIN users c ON c.id = i.created_by LEFT JOIN users q ON q.id = i.qa_by LEFT JOIN users d ON d.id = i.deployed_by
    LEFT JOIN users vb ON vb.id = i.verified_by WHERE i.id = ?`).get(id);

  const attachments = listAttachments(db, 'item_id', id);
  const byRef = (context, refId) => attachments.filter((a) => a.context === context && a.ref_id === refId);
  const selfTests = db.prepare(`SELECT s.*, u.name AS created_by_name FROM self_tests s JOIN users u ON u.id = s.created_by
    WHERE s.item_id = ? ORDER BY s.id DESC`).all(id).map((s) => ({ ...s, attachments: byRef('self_test', s.id) }));
  const verifications = db.prepare(`SELECT v.*, u.name AS created_by_name FROM qa_verifications v JOIN users u ON u.id = v.created_by
    WHERE v.item_id = ? ORDER BY v.id DESC`).all(id).map((v) => ({ ...v, attachments: byRef('qa', v.id) }));
  const comments = db.prepare(`SELECT c.*, u.name AS user_name, u.role AS user_role FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.item_id = ? ORDER BY c.id`).all(id).map((c) => ({ ...c, attachments: byRef('comment', c.id) }));

  const ctx = actionContext(db, raw, user);
  return {
    item,
    attachments: attachments.filter((a) => a.context === 'item'),
    // Files recorded when the item was moved to production (plus any from the earlier release-based deployments).
    deploymentAttachments: [...attachments.filter((a) => a.context === 'deployment'),
      ...(item.release_id ? listAttachments(db, 'release_id', item.release_id) : [])],
    selfTests,
    verifications,
    comments,
    activity: listActivity(db, 'item_id', id),
    actions: allowedActions(raw, user, ctx),
    hints: actionHints(raw, user, ctx),
    canEdit: canEditItem(raw),
    canDelete: !deleteBlocker(raw),
  };
}

/** Plain-language explanation of what the item is waiting for, shown beside the actions. */
function actionHints(item, user, ctx) {
  const hints = [];
  if (item.status === 'self_test' && !ctx.selfTestPassed) {
    hints.push('Record a passed self-test to unlock "Submit to QA". A failed self-test returns the item to In Development.');
  }
  if (item.status === 'ready_for_production') {
    hints.push('Use "Move to Production" once this change is live.');
  }
  return hints;
}

function validateItemInput(db, input, category, { partial = false } = {}) {
  const fields = {};
  const req = (key, label) => { if (!partial || key in input) { if (!str(input[key])) fields[key] = `${label} is required.`; } };
  req('title', 'Title');
  req('description', 'Description');
  req('requested_by', 'Requested By');
  if (!partial || 'product_id' in input) {
    const pid = intOrNull(input.product_id);
    const product = pid && db.prepare('SELECT active FROM products WHERE id = ?').get(pid);
    if (!product) fields.product_id = 'Choose a product.';
    else if (!product.active) fields.product_id = 'This product is no longer active.';
  }
  if ((!partial || 'priority' in input) && !(input.priority in PRIORITIES)) fields.priority = 'Choose a priority.';
  if (str(input.due_date) && !isDate(str(input.due_date))) fields.due_date = 'Use a valid date.';
  if (category === 'defect') {
    req('steps_to_reproduce', 'Steps to reproduce');
    req('expected_behaviour', 'Expected behaviour');
    req('actual_behaviour', 'Actual behaviour');
  } else {
    req('acceptance_criteria', 'Acceptance criteria');
  }
  if (str(input.title).length > 200) fields.title = 'Keep the title under 200 characters.';
  if (Object.keys(fields).length) throw badRequest('Please correct the highlighted fields.', fields);
}

function normalizedFields(input, category) {
  const out = {
    title: str(input.title, { max: 200 }),
    description: str(input.description),
    product_id: intOrNull(input.product_id),
    module: optStr(input.module, { max: 120 }),
    priority: input.priority,
    requested_by: str(input.requested_by, { max: 120 }),
    due_date: optStr(input.due_date),
    expected_behaviour: optStr(input.expected_behaviour),
    steps_to_reproduce: null, actual_behaviour: null, environment: null, business_requirement: null, acceptance_criteria: null,
  };
  if (category === 'defect') {
    Object.assign(out, {
      steps_to_reproduce: optStr(input.steps_to_reproduce), actual_behaviour: optStr(input.actual_behaviour),
      environment: optStr(input.environment, { max: 120 }),
    });
  } else {
    Object.assign(out, {
      business_requirement: optStr(input.business_requirement), acceptance_criteria: optStr(input.acceptance_criteria),
    });
  }
  return out;
}

/** The developer must be active and have a role allowed to do development work. */
function assertAssignable(db, userId, perms) {
  const dev = db.prepare('SELECT id, name, role, active FROM users WHERE id = ?').get(userId);
  if (!dev || !dev.active || !hasPermission(perms, 'start_development', dev)) {
    throw badRequest('Choose an active developer.', { assigned_to: 'Choose an active developer.' });
  }
  return dev;
}

export function createItem(db, user, input, files) {
  if (!CREATE_ROLES.includes(user.role)) throw forbidden('Your role cannot create items.');
  const category = input.category;
  if (!(category in CATEGORIES)) throw badRequest('Choose Requirement or Defect.', { category: 'Choose Requirement or Defect.' });
  validateItemInput(db, input, category);
  const assignee = intOrNull(input.assigned_to);
  const dev = assignee ? assertAssignable(db, assignee, loadPermissions(db)) : null;
  const planning = planningInput(input.planning_status);

  return tx(db, () => {
    const f = normalizedFields(input, category);
    const now = nowIso();
    const r = db.prepare(`INSERT INTO items (category, title, description, product_id, module, priority, requested_by, due_date,
        steps_to_reproduce, expected_behaviour, actual_behaviour, environment, business_requirement, acceptance_criteria,
        status, planning_status, assigned_to, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, NULL, ?, ?, ?)`)
      .run(category, f.title, f.description, f.product_id, f.module, f.priority, f.requested_by, f.due_date,
        f.steps_to_reproduce, f.expected_behaviour, f.actual_behaviour, f.environment, f.business_requirement,
        f.acceptance_criteria, planning, user.id, now, now);
    const id = Number(r.lastInsertRowid);
    db.prepare('UPDATE items SET item_key = ? WHERE id = ?').run(`CD-${String(id).padStart(4, '0')}`, id);
    logActivity(db, { itemId: id, userId: user.id, action: 'created', to: 'new', details: { category } });
    saveAttachments(db, files, { itemId: id, context: 'item', userId: user.id });
    if (dev) {
      db.prepare("UPDATE items SET assigned_to = ?, status = 'assigned' WHERE id = ?").run(dev.id, id);
      logActivity(db, { itemId: id, userId: user.id, action: 'assign', from: 'new', to: 'assigned', details: { assigned_to: dev.name } });
    }
    return id;
  });
}

export function updateItem(db, user, id, input) {
  if ('status' in input || 'assigned_to' in input || 'category' in input) {
    throw badRequest('Status, category and assignment cannot be edited directly. Use the workflow actions.');
  }
  return tx(db, () => {
    const item = getItemRow(db, id);
    if (!canEditItem(item)) throw forbidden('Items in production cannot be edited.');
    const merged = { ...item, ...input };
    validateItemInput(db, merged, item.category);
    const next = normalizedFields(merged, item.category);
    const changes = {};
    for (const key of Object.keys(EDITABLE)) {
      const before = item[key] ?? null;
      const after = next[key] ?? null;
      if (before !== after) changes[key] = { label: EDITABLE[key], from: auditValue(db, key, before), to: auditValue(db, key, after) };
    }
    if (!Object.keys(changes).length) return id;
    const sets = Object.keys(changes).map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE items SET ${sets}, updated_at = ? WHERE id = ?`)
      .run(...Object.keys(changes).map((k) => next[k] ?? null), nowIso(), id);
    logActivity(db, { itemId: id, userId: user.id, action: 'updated', details: { changes } });
    return id;
  });
}

function auditValue(db, key, value) {
  if (value === null) return null;
  if (key === 'product_id') return db.prepare('SELECT name FROM products WHERE id = ?').get(value)?.name ?? value;
  if (key === 'priority') return PRIORITIES[value];
  return String(value).length > 300 ? String(value).slice(0, 300) + '…' : value;
}

function validDatePast(value, field, label) {
  const v = str(value);
  if (!v) return { [field]: `${label} is required.` };
  if (!isDate(v)) return { [field]: 'Use a valid date.' };
  if (v > todayIso()) return { [field]: `${label} cannot be in the future.` };
  return {};
}

/**
 * Performs a workflow action. Every transition goes through here: it re-reads the item inside
 * a write transaction, re-checks permissions and preconditions, then records the audit entry.
 */
export function performAction(db, user, id, action, input = {}, files = []) {
  if (!(action in ACTIONS)) throw badRequest('Unknown action.');
  return tx(db, () => {
    const item = getItemRow(db, id);
    const ctx = actionContext(db, item, user);
    const denied = checkAction(action, item, user, ctx);
    if (denied) throw new HttpError(denied.status, denied.message);
    const now = nowIso();
    const def = ACTIONS[action];
    let to = def.to ?? item.status;
    const updates = {};
    const details = {};
    const note = optStr(input.comment, { max: 5000 });
    if (note) details.comment = note;

    switch (action) {
      case 'assign': {
        const devId = intOrNull(input.assigned_to);
        if (!devId) throw badRequest('Choose a developer.', { assigned_to: 'Choose a developer.' });
        if (devId === item.assigned_to) throw badRequest('The item is already assigned to this developer.', { assigned_to: 'Already assigned to this developer.' });
        const dev = assertAssignable(db, devId, ctx.perms);
        const prev = item.assigned_to ? db.prepare('SELECT name FROM users WHERE id = ?').get(item.assigned_to)?.name : null;
        updates.assigned_to = dev.id;
        if (item.status === 'new') to = 'assigned';
        Object.assign(details, { assigned_to: dev.name, previous: prev });
        break;
      }
      case 'save_notes':
      case 'start_self_test': {
        const notes = 'implementation_notes' in input ? str(input.implementation_notes) : (item.implementation_notes || '');
        if (!notes) {
          throw badRequest('Describe what you implemented before continuing.', { implementation_notes: 'Implementation notes are required.' });
        }
        if (notes !== (item.implementation_notes || '')) { updates.implementation_notes = notes; details.notes_updated = true; }
        if (action === 'start_self_test') updates.current_self_test_id = null;
        break;
      }
      case 'record_self_test': {
        const result = input.result;
        const fields = { ...validDatePast(input.tested_on, 'tested_on', 'Tested on') };
        if (!['passed', 'failed'].includes(result)) fields.result = 'Choose Passed or Failed.';
        if (!str(input.notes)) fields.notes = 'Describe what you tested and the outcome.';
        if (Object.keys(fields).length) throw badRequest('Please complete the self-test result.', fields);
        if (truthy(input.submit) && result !== 'passed') throw badRequest('Only a passed self-test can be submitted to QA.', { result: 'Self-test must be Passed to submit.' });
        const r = db.prepare(`INSERT INTO self_tests (item_id, cycle, result, tested_on, notes, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, item.dev_cycle, result, str(input.tested_on), str(input.notes), user.id, now);
        const testId = Number(r.lastInsertRowid);
        saveAttachments(db, files, { itemId: id, context: 'self_test', refId: testId, userId: user.id });
        Object.assign(details, { result, self_test_id: testId, evidence_files: files.length });
        if (result === 'failed') {
          updates.current_self_test_id = null;
          to = 'in_development';
        } else {
          updates.current_self_test_id = testId;
          if (truthy(input.submit)) {
            logActivity(db, { itemId: id, userId: user.id, action, from: item.status, to: item.status, details });
            updates.updated_at = now;
            applyUpdates(db, id, { ...updates, status: 'ready_for_qa' });
            logActivity(db, { itemId: id, userId: user.id, action: 'submit_to_qa', from: 'self_test', to: 'ready_for_qa' });
            return id;
          }
        }
        break;
      }
      case 'assign_qa': {
        const qaId = intOrNull(input.qa_by);
        if (!qaId) throw badRequest('Choose a QA engineer.', { qa_by: 'Choose a QA engineer.' });
        if (qaId === item.qa_by) throw badRequest('The item is already assigned to this QA engineer.', { qa_by: 'Already assigned to this QA engineer.' });
        const qa = db.prepare('SELECT id, name, role, active FROM users WHERE id = ?').get(qaId);
        if (!qa || !qa.active || !hasPermission(ctx.perms, 'start_qa', qa)) throw badRequest('Choose an active QA engineer.', { qa_by: 'Choose an active QA engineer.' });
        const prev = item.qa_by ? db.prepare('SELECT name FROM users WHERE id = ?').get(item.qa_by)?.name : null;
        updates.qa_by = qa.id;
        Object.assign(details, { qa: qa.name, previous: prev });
        break;
      }
      case 'start_qa':
        updates.qa_by = user.id;
        break;
      case 'qa_approve':
      case 'qa_reject': {
        const approve = action === 'qa_approve';
        const fields = { ...validDatePast(input.tested_on, 'tested_on', 'Tested on') };
        if (!str(input.notes)) fields.notes = approve ? 'Verification notes are required.' : 'A rejection reason is required.';
        if (!approve && !str(input.observed) && !files.length) {
          fields.observed = 'Record what you observed or attach evidence (for example a screenshot).';
        }
        if (Object.keys(fields).length) throw badRequest('Please complete the verification result.', fields);
        const r = db.prepare(`INSERT INTO qa_verifications (item_id, cycle, result, tested_on, notes, observed, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, item.dev_cycle, approve ? 'approved' : 'rejected', str(input.tested_on), str(input.notes), optStr(input.observed), user.id, now);
        const vId = Number(r.lastInsertRowid);
        saveAttachments(db, files, { itemId: id, context: 'qa', refId: vId, userId: user.id });
        Object.assign(details, { verification_id: vId, evidence_files: files.length });
        if (!approve) {
          details.reason = str(input.notes, { max: 500 });
          Object.assign(updates, { dev_cycle: item.dev_cycle + 1, current_self_test_id: null });
        }
        break;
      }
      case 'return_for_investigation': {
        const reason = str(input.reason);
        if (!reason) throw badRequest('Explain why the item is being returned.', { reason: 'A reason is required.' });
        details.reason = reason;
        Object.assign(updates, { dev_cycle: item.dev_cycle + 1, current_self_test_id: null, qa_by: null });
        break;
      }
      case 'move_to_production': {
        const notes = optStr(input.notes, { max: 5000 });
        if (notes) details.notes = notes;
        if (files.length) {
          saveAttachments(db, files, { itemId: id, context: 'deployment', userId: user.id });
          details.files = files.length;
        }
        Object.assign(updates, { deployed_at: now, deployed_by: user.id });
        break;
      }
      case 'verify_in_production': {
        const notes = optStr(input.notes, { max: 5000 });
        if (notes) details.notes = notes;
        if (files.length) {
          saveAttachments(db, files, { itemId: id, context: 'deployment', userId: user.id });
          details.files = files.length;
        }
        Object.assign(updates, { verified_at: now, verified_by: user.id });
        break;
      }
      default:
        break;
    }

    updates.status = to;
    updates.updated_at = now;
    applyUpdates(db, id, updates);
    logActivity(db, { itemId: id, userId: user.id, action, from: item.status, to, details: Object.keys(details).length ? details : null });
    return id;
  });
}

function applyUpdates(db, id, updates) {
  const keys = Object.keys(updates);
  db.prepare(`UPDATE items SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => updates[k]), id);
}

export function addComment(db, user, id, input, files) {
  const body = str(input.body, { max: 10000 });
  if (!body) throw badRequest('Write a comment first.', { body: 'Comment cannot be empty.' });
  return tx(db, () => {
    getItemRow(db, id);
    const now = nowIso();
    const r = db.prepare('INSERT INTO comments (item_id, user_id, body, created_at) VALUES (?, ?, ?, ?)').run(id, user.id, body, now);
    const cId = Number(r.lastInsertRowid);
    saveAttachments(db, files, { itemId: id, context: 'comment', refId: cId, userId: user.id });
    db.prepare('UPDATE items SET updated_at = ? WHERE id = ?').run(now, id);
    logActivity(db, { itemId: id, userId: user.id, action: 'commented', details: { excerpt: body.slice(0, 140) } });
    return cId;
  });
}

export function addItemAttachments(db, user, id, files) {
  if (!files?.length) throw badRequest('Choose at least one file.');
  return tx(db, () => {
    const item = getItemRow(db, id);
    saveAttachments(db, files, { itemId: id, context: 'item', userId: user.id });
    db.prepare('UPDATE items SET updated_at = ? WHERE id = ?').run(nowIso(), id);
    logActivity(db, { itemId: id, userId: user.id, action: 'attachments_added', details: { files: files.map((f) => f.originalname) } });
  });
}

/** Why `item` may not be deleted, or null when deletion is allowed. Any signed-in user may delete. */
function deleteBlocker(item) {
  if (GROUPS.closed.includes(item.status)) return conflict('Items in production are part of the delivery history and cannot be deleted.');
  return null;
}

/**
 * Permanently deletes an item with its self-tests, QA results, comments, attachments and history.
 * One audit entry (not tied to the item) records what was deleted and by whom.
 */
export function deleteItem(db, user, id) {
  const stored = tx(db, () => {
    const item = getItemRow(db, id);
    const blocker = deleteBlocker(item);
    if (blocker) throw blocker;
    const files = db.prepare('SELECT stored_name FROM attachments WHERE item_id = ?').all(id).map((r) => r.stored_name);
    db.prepare('UPDATE items SET current_self_test_id = NULL WHERE id = ?').run(id);
    for (const table of ['attachments', 'comments', 'self_tests', 'qa_verifications', 'release_items', 'activity']) {
      db.prepare(`DELETE FROM ${table} WHERE item_id = ?`).run(id);
    }
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    logActivity(db, { userId: user.id, action: 'item_deleted',
      details: { item_key: item.item_key, title: item.title, category: item.category, status: item.status } });
    return files;
  });
  for (const name of stored) fs.rm(path.join(config.uploadDir, path.basename(name)), { force: true }, () => {});
}

function planningInput(value) {
  if (value === undefined || value === null || value === '') return 'backlog';
  if (!(value in PLANNING_STATUSES)) {
    throw badRequest('Choose a planning status.', { planning_status: 'Choose Backlog, Planned, Active, On Hold or Completed.' });
  }
  return value;
}

/**
 * Changes only the planning label. Workflow status, assignment and QA data are untouched,
 * and the change is logged without from/to workflow statuses so the workflow trail stays clean.
 */
export function setPlanningStatus(db, user, id, value) {
  if (!value) throw badRequest('Choose a planning status.', { planning_status: 'Choose a planning status.' });
  const next = planningInput(value);
  return tx(db, () => {
    const item = getItemRow(db, id);
    if (item.planning_status === next) return id;
    db.prepare('UPDATE items SET planning_status = ?, updated_at = ? WHERE id = ?').run(next, nowIso(), id);
    logActivity(db, { itemId: id, userId: user.id, action: 'planning_changed',
      details: { from: PLANNING_STATUSES[item.planning_status], to: PLANNING_STATUSES[next] } });
    return id;
  });
}
