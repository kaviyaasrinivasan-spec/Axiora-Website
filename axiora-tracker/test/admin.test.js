import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Client, clients, PASSWORD, startTestServer } from './helpers.js';

let ctx;
let c;

before(async () => {
  ctx = await startTestServer();
  c = await clients(ctx);
});
after(() => ctx.close());

test('admin cannot remove their own admin access or the last admin', async () => {
  const self = await c.admin.patch(`/api/users/${ctx.users.admin.id}`, { role: 'developer' });
  assert.equal(self.status, 409);
  const deactivate = await c.admin.patch(`/api/users/${ctx.users.admin.id}`, { active: '0' });
  assert.equal(deactivate.status, 409);
});

test('deactivating a user ends their session immediately', async () => {
  const id = (await c.admin.post('/api/users', { name: 'Temp', email: 'temp@test.local', role: 'qa', password: PASSWORD })).data.id;
  const temp = await new Client(ctx.base).login('temp@test.local');
  assert.equal((await temp.get('/api/meta')).status, 200);
  assert.equal((await c.admin.patch(`/api/users/${id}`, { active: '0' })).status, 200);
  assert.equal((await temp.get('/api/meta')).status, 401);
  assert.equal((await new Client(ctx.base).post('/api/auth/login', { email: 'temp@test.local', password: PASSWORD })).status, 401);
});

test('user creation validates email, role and password strength', async () => {
  const res = await c.admin.post('/api/users', { name: '', email: 'bad', role: 'boss', password: 'short' });
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.data.fields).sort(), ['email', 'name', 'password', 'role']);
  const dupe = await c.admin.post('/api/users', { name: 'Dup', email: 'DEV@test.local', role: 'qa', password: PASSWORD });
  assert.ok(dupe.data.fields.email, 'emails are unique regardless of case');
});

test('password change requires the current password and keeps the user signed in', async () => {
  const qa = await new Client(ctx.base).login('qa2@test.local');
  assert.equal((await qa.post('/api/auth/password', { current_password: 'wrong', new_password: 'another-long-password' })).status, 400);
  assert.equal((await qa.post('/api/auth/password', { current_password: PASSWORD, new_password: 'another-long-password' })).status, 200);
  assert.equal((await qa.get('/api/meta')).status, 200);
  const res = await new Client(ctx.base).post('/api/auth/login', { email: 'qa2@test.local', password: 'another-long-password' });
  assert.equal(res.status, 200);
});

test('products: inactive products cannot receive new items; names are unique', async () => {
  const add = await c.admin.post('/api/products', { name: 'Legacy' });
  const legacy = add.data.products.find((p) => p.name === 'Legacy');
  assert.equal((await c.admin.post('/api/products', { name: 'legacy' })).status, 400);
  await c.admin.patch(`/api/products/${legacy.id}`, { name: 'Legacy', active: '0' });
  const res = await c.admin.post('/api/items', {
    category: 'requirement', title: 'x', description: 'y', product_id: legacy.id, priority: 'low', requested_by: 'me', acceptance_criteria: 'z',
  });
  assert.equal(res.status, 400);
  assert.ok(res.data.fields.product_id);
});

test('failed sign-ins never lock the account out', async () => {
  const anon = new Client(ctx.base);
  for (let i = 0; i < 12; i++) {
    const res = await anon.post('/api/auth/login', { email: 'rm@test.local', password: 'wrong-password!' });
    assert.equal(res.status, 401);
    assert.equal(res.data.error, 'Incorrect email or password.');
  }
  assert.equal((await anon.post('/api/auth/login', { email: 'rm@test.local', password: PASSWORD })).status, 200, 'the right password still works');
});

test('unknown API routes return JSON 404 and the SPA shell serves other paths', async () => {
  assert.equal((await c.admin.get('/api/nope')).status, 404);
  const shell = await c.anon.get('/some/page');
  assert.equal(shell.status, 200);
  assert.match(shell.data, /<div id="app">/);
});

test('remember me keeps the user signed in for 30 days; otherwise the cookie ends with the browser', async () => {
  const login = async (remember) => {
    const res = await fetch(`${ctx.base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'axiora-tracker' },
      body: JSON.stringify({ email: 'dev@test.local', password: PASSWORD, remember }),
    });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie');
    const token = cookie.split(';')[0];
    const days = (new Date(ctx.db.prepare('SELECT MAX(expires_at) AS e FROM sessions WHERE user_id = ?').get(ctx.users.dev.id).e) - Date.now()) / 86400000;
    return { cookie, token, days };
  };
  const remembered = await login(true);
  assert.match(remembered.cookie, /expires=/i, 'persistent cookie');
  assert.ok(remembered.days > 29 && remembered.days <= 30, `session lasts 30 days (got ${remembered.days})`);
  ctx.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(ctx.users.dev.id);
  const normal = await login(false);
  assert.doesNotMatch(normal.cookie, /expires=/i, 'browser-session cookie');
  assert.ok(normal.days < 1, 'server session uses the normal lifetime');
});

test('admin can change a user email; the old email stops working and sessions end', async () => {
  const id = (await c.admin.post('/api/users', { name: 'Mover', email: 'old.name@workbooster.test', role: 'developer', password: PASSWORD })).data.id;
  const session = await new Client(ctx.base).login('old.name@workbooster.test');
  assert.equal((await c.admin.patch(`/api/users/${id}`, { email: 'not-an-email' })).status, 400);
  const dupe = await c.admin.patch(`/api/users/${id}`, { email: 'DEV@test.local' });
  assert.equal(dupe.status, 400);
  assert.ok(dupe.data.fields.email);
  const res = await c.admin.patch(`/api/users/${id}`, { email: 'New.Name@Axiora.test' });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.users.find((u) => u.id === id).email, 'new.name@axiora.test', 'stored lower-case');
  assert.equal((await session.get('/api/meta')).status, 401, 'existing session ended');
  assert.equal((await new Client(ctx.base).post('/api/auth/login', { email: 'old.name@workbooster.test', password: PASSWORD })).status, 401);
  assert.equal((await new Client(ctx.base).post('/api/auth/login', { email: 'new.name@axiora.test', password: PASSWORD })).status, 200);
  // Saving the same email (e.g. editing only the name) is fine and keeps sessions.
  assert.equal((await c.admin.patch(`/api/users/${id}`, { email: 'new.name@axiora.test', name: 'Mover 2' })).status, 200);
});

test('idle timeout: sessions end 30 minutes after the last activity, capped at 12 hours', async () => {
  const user = new Client(ctx.base);
  await user.post('/api/auth/login', { email: 'qa@test.local', password: PASSWORD });
  const hash = ctx.db.prepare('SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(ctx.users.qa.id).token_hash;
  const row = () => ctx.db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hash);
  const minsLeft = () => (Date.parse(row().expires_at) - Date.now()) / 60000;
  const setExpiry = (msFromNow, createdMsAgo) => {
    const r = row();
    ctx.db.prepare('UPDATE sessions SET expires_at = ?, created_at = COALESCE(?, created_at) WHERE token_hash = ?')
      .run(new Date(Date.now() + msFromNow).toISOString(), createdMsAgo ? new Date(Date.now() - createdMsAgo).toISOString() : null, r.token_hash);
  };
  const probe = () => fetch(`${ctx.base}/api/auth/me`, { headers: { cookie: user.cookie, 'X-Session-Check': '1' } });

  assert.ok(minsLeft() > 29 && minsLeft() <= 30.1, `new session lasts 30 minutes (got ${minsLeft()})`);
  const meta = (await user.get('/api/meta')).data.session;
  assert.deepEqual(meta, { idleMinutes: 30, remembered: false });

  // Activity pushes the expiry forward again.
  setExpiry(5 * 60000);
  assert.equal((await user.get('/api/items')).status, 200);
  assert.ok(minsLeft() > 29, `activity extends the session (got ${minsLeft()})`);

  // The browser's idle probe does not count as activity.
  setExpiry(5 * 60000);
  assert.equal((await probe()).status, 200);
  assert.ok(minsLeft() < 6, 'probe does not extend');

  // Never beyond 12 hours after sign-in, however active.
  setExpiry(5 * 60000, 11 * 3600000 + 50 * 60000);
  await user.get('/api/items');
  assert.ok(minsLeft() > 9 && minsLeft() <= 10.1, `capped at 12 hours from sign-in (got ${minsLeft()})`);

  // Once idle time has passed, the session is gone.
  setExpiry(-1000);
  assert.equal((await user.get('/api/meta')).status, 401);
  assert.equal((await probe()).status, 401);
});

test('idle timeout does not apply to Remember me sessions', async () => {
  const user = new Client(ctx.base);
  await user.post('/api/auth/login', { email: 'qa@test.local', password: PASSWORD, remember: true });
  const r = ctx.db.prepare('SELECT * FROM sessions WHERE user_id = ? AND remember = 1 ORDER BY created_at DESC LIMIT 1').get(ctx.users.qa.id);
  assert.ok(r, 'stored as a remembered session');
  assert.deepEqual((await user.get('/api/meta')).data.session, { idleMinutes: 30, remembered: true });
  const after = ctx.db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(r.token_hash).expires_at;
  assert.equal(after, r.expires_at, 'activity does not shorten it to the idle window');
  assert.ok((Date.parse(after) - Date.now()) / 86400000 > 29);
});
