import express from 'express';
import {
  clearSessionCookie, createSession, destroySession, hashPassword, requireAuth, requireRole, ROLES,
  sessionToken, setSessionCookie, validatePassword, verifyPassword,
} from '../auth.js';
import { config } from '../config.js';
import { badRequest, HttpError, intOrNull, notFound, nowIso, str, truthy } from '../util.js';
import { ACTIONS, CATEGORIES, CREATE_ROLES, PLANNING_STATUSES, PRIORITIES, STATUSES } from '../workflow.js';
import { describePermissions, loadPermissions, savePermissions } from '../services/permissions.js';
import { createUser, listProducts, listUsers, saveModule, saveProduct, updateUser } from '../services/admin.js';
import { ALLOWED_EXTENSIONS, discardFiles, sendAttachment, uploadMiddleware } from '../services/attachments.js';
import { getCeoDashboard } from '../services/ceo.js';
import { getDashboard, getReports } from '../services/dashboard.js';
import {
  addComment, addItemAttachments, createItem, deleteItem, exportItems, setPlanningStatus, getItemDetail, listItems, performAction, updateItem,
} from '../services/items.js';

/** Wraps a handler so uploaded temp files are removed when it throws. */
const withFiles = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    discardFiles(req.files);
    throw err;
  }
};

const idParam = (req, name = 'id') => {
  const id = intOrNull(req.params[name]);
  if (!id) throw notFound();
  return id;
};

/** Neutralises spreadsheet formula injection and quotes every cell. */
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function apiRouter(db) {
  const r = express.Router();
  const upload = uploadMiddleware();

  // ---- Auth ----
  r.post('/auth/login', (req, res) => {
    const email = str(req.body?.email, { max: 200 }).toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) throw badRequest('Enter your email and password.');
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
    if (!user || !verifyPassword(password, user.password_hash)) throw new HttpError(401, 'Incorrect email or password.');
    const remember = truthy(req.body?.remember);
    const { token, expires } = createSession(db, user.id, { remember });
    setSessionCookie(req, res, token, expires, remember);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });

  r.post('/auth/logout', (req, res) => {
    destroySession(db, sessionToken(req));
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  r.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

  r.post('/auth/password', requireAuth, (req, res) => {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(String(req.body?.current_password ?? ''), row.password_hash)) {
      throw badRequest('Current password is incorrect.', { current_password: 'Current password is incorrect.' });
    }
    const err = validatePassword(req.body?.new_password);
    if (err) throw badRequest(err, { new_password: err });
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hashPassword(req.body.new_password), nowIso(), req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    const { token, expires } = createSession(db, req.user.id);
    setSessionCookie(req, res, token, expires);
    res.json({ ok: true });
  });

  r.use(requireAuth);

  // ---- Reference data ----
  r.get('/meta', (req, res) => {
    const role = req.user.role;
    const perms = loadPermissions(db);
    res.json({
      user: req.user,
      session: { idleMinutes: config.sessionIdleMinutes, remembered: Boolean(req.session?.remember) },
      statuses: STATUSES, planningStatuses: PLANNING_STATUSES, categories: CATEGORIES, priorities: PRIORITIES, roles: ROLES,
      actions: Object.fromEntries(Object.entries(ACTIONS).map(([k, v]) => [k, v.label])),
      products: listProducts(db),
      users: db.prepare('SELECT id, name, role, active FROM users ORDER BY name').all(),
      // Which roles each workflow step allows, so pickers (e.g. developer, QA engineer) match the server.
      workflowRoles: perms,
      requesters: db.prepare('SELECT DISTINCT requested_by FROM items ORDER BY requested_by').all().map((x) => x.requested_by),
      permissions: {
        // Every workflow step is open to everyone signed in.
        createItem: CREATE_ROLES.includes(role), assign: true, admin: role === 'admin',
      },
      uploads: { maxMb: config.maxUploadMb, maxFiles: config.maxFilesPerUpload, extensions: ALLOWED_EXTENSIONS },
    });
  });

  // ---- Items ----
  r.get('/items', (req, res) => res.json(listItems(db, req.query, req.user)));

  r.get('/items/export.csv', (req, res) => {
    const rows = exportItems(db, req.query, req.user);
    const head = ['ID', 'Title', 'Category', 'Product', 'Module', 'Priority', 'Status', 'Planning Status', 'Assigned To', 'Requested By',
      'Due Date', 'Deployed At', 'Created', 'Updated'];
    const lines = rows.map((i) => [i.item_key, i.title, CATEGORIES[i.category], i.product_name, i.module, PRIORITIES[i.priority],
      STATUSES[i.status], PLANNING_STATUSES[i.planning_status], i.assigned_name, i.requested_by, i.due_date, i.deployed_at, i.created_at, i.updated_at]
      .map(csvCell).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="axiora-items-${nowIso().slice(0, 10)}.csv"`);
    res.send('﻿' + [head.map(csvCell).join(','), ...lines].join('\r\n'));
  });

  r.post('/items', upload, withFiles((req, res) => {
    const id = createItem(db, req.user, req.body || {}, req.files || []);
    res.status(201).json({ id });
  }));

  r.get('/items/:id', (req, res) => res.json(getItemDetail(db, idParam(req), req.user)));

  r.patch('/items/:id', (req, res) => {
    const id = idParam(req);
    updateItem(db, req.user, id, req.body || {});
    res.json(getItemDetail(db, id, req.user));
  });

  r.delete('/items/:id', (req, res) => {
    deleteItem(db, req.user, idParam(req));
    res.json({ ok: true });
  });

  r.post('/items/:id/actions/:action', upload, withFiles((req, res) => {
    const id = idParam(req);
    performAction(db, req.user, id, req.params.action, req.body || {}, req.files || []);
    res.json(getItemDetail(db, id, req.user));
  }));

  r.post('/items/:id/planning', (req, res) => {
    const id = idParam(req);
    setPlanningStatus(db, req.user, id, req.body?.planning_status);
    res.json(getItemDetail(db, id, req.user));
  });

  r.post('/items/:id/comments', upload, withFiles((req, res) => {
    const id = idParam(req);
    addComment(db, req.user, id, req.body || {}, req.files || []);
    res.status(201).json(getItemDetail(db, id, req.user));
  }));

  r.post('/items/:id/attachments', upload, withFiles((req, res) => {
    const id = idParam(req);
    addItemAttachments(db, req.user, id, req.files || []);
    res.status(201).json(getItemDetail(db, id, req.user));
  }));

  r.get('/attachments/:id', (req, res) => {
    if (!sendAttachment(db, idParam(req), res)) throw notFound('File not found.');
  });

  // ---- Dashboard & reports ----
  r.get('/dashboard', (req, res) => res.json(getDashboard(db, req.query, req.user)));
  r.get('/reports', (req, res) => res.json(getReports(db, req.query, req.user)));
  r.get('/ceo-dashboard', requireRole('admin'), (req, res) => res.json(getCeoDashboard(db, req.query, req.user)));

  // ---- Administration ----
  r.get('/users', requireRole('admin'), (req, res) => res.json({ users: listUsers(db) }));
  r.post('/users', requireRole('admin'), (req, res) => res.status(201).json({ id: createUser(db, req.user, req.body || {}) }));
  r.patch('/users/:id', requireRole('admin'), (req, res) => {
    updateUser(db, req.user, idParam(req), req.body || {});
    res.json({ users: listUsers(db) });
  });
  r.get('/workflow-permissions', requireRole('admin'), (req, res) => res.json({ permissions: describePermissions(db) }));
  r.put('/workflow-permissions', requireRole('admin'), (req, res) => res.json({ permissions: savePermissions(db, req.user, req.body?.permissions) }));
  r.get('/products', requireRole('admin'), (req, res) => res.json({ products: listProducts(db) }));
  r.post('/products', requireRole('admin'), (req, res) => {
    saveProduct(db, req.user, null, req.body || {});
    res.status(201).json({ products: listProducts(db) });
  });
  r.patch('/products/:id', requireRole('admin'), (req, res) => {
    saveProduct(db, req.user, idParam(req), req.body || {});
    res.json({ products: listProducts(db) });
  });
  r.post('/modules', requireRole('admin'), (req, res) => {
    saveModule(db, req.user, null, req.body || {});
    res.status(201).json({ products: listProducts(db) });
  });
  r.patch('/modules/:id', requireRole('admin'), (req, res) => {
    saveModule(db, req.user, idParam(req), req.body || {});
    res.json({ products: listProducts(db) });
  });

  r.use((_req, _res, next) => next(notFound('Unknown API endpoint.')));
  return r;
}
