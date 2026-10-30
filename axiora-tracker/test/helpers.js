import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point data/uploads at a throwaway directory before the app modules read config.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'axiora-tracker-test-'));
process.env.DATA_DIR = tmp;
process.env.NODE_ENV = 'test';

const { openDb, migrate } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { createUser, saveProduct } = await import('../src/services/admin.js');

export const PASSWORD = 'correct-horse-battery';
const TEST_USERS = [['admin', 'admin'], ['dev', 'developer'], ['dev2', 'developer'], ['qa', 'qa'], ['qa2', 'qa'], ['rm', 'release_manager']];

export async function startTestServer() {
  if (process.env.TARGET === 'php') return startPhpServer();
  const db = openDb(':memory:');
  migrate(db);
  const users = {};
  for (const [key, role] of TEST_USERS) {
    const id = createUser(db, null, { name: key.toUpperCase(), email: `${key}@test.local`, role, password: PASSWORD });
    users[key] = { id, email: `${key}@test.local` };
  }
  const productId = saveProduct(db, users.admin, null, { name: 'CARGORA' });
  const server = await new Promise((resolve) => {
    const s = createApp(db).listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = () => new Promise((resolve) => server.close(() => { db.close(); resolve(); }));
  return { db, base, users, productId, close, tmp };
}

/**
 * Runs the same suite against the PHP backend (TARGET=php, PHP_BIN=path/to/php) through
 * PHP's built-in server, mounted at /qa exactly like the live site.
 */
async function startPhpServer() {
  const { spawn, execFileSync } = await import('node:child_process');
  const { DatabaseSync } = await import('node:sqlite');
  const php = process.env.PHP_BIN || 'php';
  const root = path.resolve(import.meta.dirname, '..');
  const env = { ...process.env, DATA_DIR: tmp };
  const cli = (args, extraEnv = {}) => JSON.parse(execFileSync(php, ['php/cli.php', ...args], { cwd: root, env: { ...env, ...extraEnv } }).toString());
  const users = {};
  for (const [key, role] of TEST_USERS) {
    users[key] = { id: cli(['create-user', '--name', key.toUpperCase(), '--email', `${key}@test.local`, '--role', role], { AXT_PASSWORD: PASSWORD }).id, email: `${key}@test.local` };
  }
  const productId = cli(['create-product', '--name', 'CARGORA']).id;
  const port = 20000 + Math.floor(Math.random() * 20000);
  const proc = spawn(php, ['-S', `127.0.0.1:${port}`, 'php/dev-router.php'], { cwd: root, env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}/qa`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  const db = new DatabaseSync(path.join(tmp, 'tracker.db'));
  const close = async () => { db.close(); proc.kill(); };
  return { db, base, users, productId, close, tmp };
}

export class Client {
  constructor(base) {
    this.base = base;
    this.cookie = '';
  }

  async request(method, url, body, { csrf = true, form = false } = {}) {
    const headers = {};
    if (this.cookie) headers.cookie = this.cookie;
    if (csrf) headers['X-Requested-With'] = 'axiora-tracker';
    let payload;
    if (form) {
      payload = new FormData();
      for (const [k, v] of Object.entries(body || {})) {
        if (k === 'files') for (const f of v) payload.append('files[]', new Blob([f.content]), f.name);
        else payload.append(k, String(v));
      }
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(this.base + url, { method, headers, body: payload });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data };
  }

  get(url) { return this.request('GET', url); }
  post(url, body, opts) { return this.request('POST', url, body ?? {}, opts); }
  patch(url, body) { return this.request('PATCH', url, body); }
  del(url, body) { return this.request('DELETE', url, body); }

  async login(email) {
    const res = await this.post('/api/auth/login', { email, password: PASSWORD });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(res.data)}`);
    return this;
  }
}

export async function clients(ctx) {
  const out = {};
  for (const [key, u] of Object.entries(ctx.users)) out[key] = await new Client(ctx.base).login(u.email);
  out.anon = new Client(ctx.base);
  return out;
}

export function defectInput(productId, extra = {}) {
  return {
    category: 'defect', title: 'ERP submission error', description: 'Success shown without ERP job number.',
    product_id: productId, module: 'ERP Integration', priority: 'critical', requested_by: 'Senthil',
    steps_to_reproduce: '1. Open ERP page\n2. Submit', expected_behaviour: 'Job number shown', actual_behaviour: 'No job number',
    environment: 'Production', ...extra,
  };
}

export const today = () => new Date().toISOString().slice(0, 10);
