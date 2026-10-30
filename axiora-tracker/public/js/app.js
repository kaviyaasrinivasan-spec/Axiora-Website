import { api, ApiError, can, guard, html, icon, initials, label, logo, openDialog, field, state, toast } from './lib.js';

// Each route: [pattern, page module loader, extra params]. Order matters: literals before :params.
const ROUTES = [
  ['/', () => import('./pages/dashboard.js')],
  ['/items/new', () => import('./pages/item-form.js')],
  ['/items/:id/edit', () => import('./pages/item-form.js')],
  ['/items/:id', () => import('./pages/item-detail.js')],
  ['/items', () => import('./pages/items.js'), { preset: 'all' }],
  ['/requirements', () => import('./pages/items.js'), { preset: 'requirements' }],
  ['/defects', () => import('./pages/items.js'), { preset: 'defects' }],
  ['/my-work', () => import('./pages/items.js'), { preset: 'my' }],
  ['/qa-queue', () => import('./pages/items.js'), { preset: 'qa' }],
  ['/production-queue', () => import('./pages/items.js'), { preset: 'production' }],
  ['/deployed', () => import('./pages/items.js'), { preset: 'deployed' }],
  ['/verified', () => import('./pages/items.js'), { preset: 'verified' }],
  ['/ceo-dashboard', () => import('./pages/ceo-dashboard.js'), { admin: true }],
  ['/reports', () => import('./pages/reports.js')],
  ['/users', () => import('./pages/users.js'), { admin: true }],
  ['/settings', () => import('./pages/settings.js'), { admin: true }],
];

const NAV = [
  ['/', 'Dashboard', 'dashboard'],
  ['/items', 'All Items', 'list'],
  ['/requirements', 'Requirements', 'doc'],
  ['/defects', 'Defects', 'bug'],
  ['/my-work', 'My Work', 'user', 'my'],
  ['/qa-queue', 'QA Queue', 'shield', 'qa'],
  ['/production-queue', 'Production Queue', 'rocket', 'production'],
  ['/deployed', 'Deployed to Production', 'check'],
  ['/verified', 'Verified in Production', 'verified'],
  ['/ceo-dashboard', 'CEO Dashboard', 'crown', null, 'admin'],
  ['/reports', 'Reports', 'chart'],
];
const ADMIN_NAV = [
  ['/users', 'User Management', 'users'],
  ['/settings', 'Settings', 'settings'],
];

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, search = ''] = h.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(search)) };
}

function match(path) {
  for (const [pattern, load, extra] of ROUTES) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    const m = path.match(re);
    if (m) return { load, extra: extra || {}, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export function navigate(path) {
  if (location.hash === '#' + path) render();
  else location.hash = path;
}

// ---- Idle timeout -------------------------------------------------------------------------
// Activity in this tab (typing, clicking, scrolling, moving the mouse) keeps the server session
// alive with a light ping at most every 5 minutes. After the configured idle time with no activity,
// the tab asks the server whether the session still exists (that probe does not count as activity,
// so another active tab keeps everyone signed in) and shows the sign-in page if it has ended.
let lastActivity = Date.now();
let lastPing = Date.now();
let idleTimer = null;
for (const ev of ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']) {
  window.addEventListener(ev, () => {
    lastActivity = Date.now();
    const s = state.meta?.session;
    if (state.user && s && !s.remembered && lastActivity - lastPing > Math.min(5 * 60000, (s.idleMinutes * 60000) / 3)) {
      lastPing = lastActivity;
      fetch('api/auth/me', { credentials: 'same-origin' }).catch(() => {});
    }
  }, { passive: true, capture: true });
}

function startIdleWatch() {
  clearInterval(idleTimer);
  const s = state.meta?.session;
  if (!state.user || !s || s.remembered) return;
  idleTimer = setInterval(async () => {
    if (Date.now() - lastActivity < s.idleMinutes * 60000) return;
    let alive = false;
    try {
      alive = (await fetch('api/auth/me', { credentials: 'same-origin', headers: { 'X-Session-Check': '1' } })).ok;
    } catch {
      return; // offline: try again on the next tick
    }
    if (alive) { lastActivity = Date.now(); return; }
    clearInterval(idleTimer);
    state.user = null;
    state.meta = null;
    location.hash = '#/login?expired=1';
  }, 30000);
}

async function loadSession() {
  try {
    state.meta = await api('GET', 'api/meta');
    state.user = state.meta.user;
    lastActivity = Date.now();
    lastPing = Date.now();
    startIdleWatch();
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    state.user = null;
  }
}

export async function refreshMeta() {
  state.meta = await api('GET', 'api/meta');
}

function shell() {
  const app = document.getElementById('app');
  if (app.querySelector('.shell')) return app.querySelector('.shell');
  const u = state.user;
  app.innerHTML = String(html`
    <div class="shell">
      <aside class="sidebar" aria-label="Main navigation">
        <div class="brand">${logo(30)}<div><div class="brand-name">AXIORA</div><div class="brand-sub">LABS AI</div></div></div>
        <nav class="nav">
          ${NAV.filter((n) => !n[4] || can(n[4])).map(([href, text, ic, count]) => html`<a href="#${href}" data-nav="${href}">${icon(ic)}<span>${text}</span>${count ? html`<span class="count hidden" data-count="${count}"></span>` : ''}</a>`)}
          ${can('admin') ? html`<div class="nav-section">Administration</div>
            ${ADMIN_NAV.map(([href, text, ic]) => html`<a href="#${href}" data-nav="${href}">${icon(ic)}<span>${text}</span></a>`)}` : ''}
        </nav>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" data-menu aria-label="Open menu">${icon('menu')}</button>
          <div class="title">Change &amp; Defect Tracking</div>
          <div class="spacer"></div>
          <div class="user-chip">
            <span class="avatar">${initials(u.name)}</span>
            <div class="user-meta"><div>${u.name}</div><div class="role">${label.role(u.role)}</div></div>
            <button class="icon-btn" data-password title="Change password" aria-label="Change password">${icon('key')}</button>
            <button class="icon-btn" data-logout title="Sign out" aria-label="Sign out">${icon('logout')}</button>
          </div>
        </header>
        <main class="content" id="view"></main>
      </div>
    </div>`);
  const sh = app.querySelector('.shell');
  sh.querySelector('[data-menu]').addEventListener('click', () => sh.classList.toggle('nav-open'));
  sh.addEventListener('click', (e) => {
    if (sh.classList.contains('nav-open') && (e.target.closest('.nav a') || e.target === sh)) sh.classList.remove('nav-open');
  });
  sh.querySelector('[data-logout]').addEventListener('click', guard(async () => {
    await api('POST', 'api/auth/logout');
    state.user = null;
    state.meta = null;
    location.hash = '#/login';
  }));
  sh.querySelector('[data-password]').addEventListener('click', changePassword);
  return sh;
}

function changePassword() {
  openDialog({
    title: 'Change password',
    body: html`<div class="stack">
      ${field({ name: 'current_password', label: 'Current password', type: 'password', required: true })}
      ${field({ name: 'new_password', label: 'New password', type: 'password', required: true, help: 'At least 10 characters.' })}
    </div>`,
    submitLabel: 'Update password',
    onSubmit: async (form) => {
      await api('POST', 'api/auth/password', Object.fromEntries(new FormData(form)));
      toast('Password updated.', 'success');
    },
  });
}

async function updateCounts(sh) {
  for (const el of sh.querySelectorAll('[data-count]')) {
    try {
      const { total } = await api('GET', `api/items?view=${el.dataset.count}&pageSize=1`);
      el.textContent = total;
      el.classList.toggle('hidden', !total);
    } catch {
      el.classList.add('hidden');
    }
  }
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  // Opening the app without a page (e.g. axioralabs.ai/qa/) lands on My Work.
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/my-work');
  const { path, query } = parseHash();
  if (!state.user) await loadSession();
  if (seq !== renderSeq) return;

  if (!state.user || path === '/login') {
    if (state.user) return navigate('/');
    const app = document.getElementById('app');
    const mod = await import('./pages/login.js');
    clearInterval(idleTimer);
    mod.render(app, { expired: Boolean(query.expired), onLogin: async () => { await loadSession(); navigate(query.next || '/my-work'); } });
    return;
  }

  const sh = shell();
  const route = match(path);
  sh.querySelectorAll('[data-nav]').forEach((a) => {
    const href = a.dataset.nav;
    a.classList.toggle('active', href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  });
  const view = document.createElement('div');
  const container = sh.querySelector('#view');
  container.replaceChildren(view);
  window.scrollTo(0, 0);
  if (!route || (route.extra.admin && !can('admin'))) {
    view.innerHTML = String(html`<div class="card"><div class="card-body">${route ? 'You do not have access to this page.' : 'Page not found.'} <a href="#/">Go to the dashboard</a></div></div>`);
    return;
  }
  view.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const mod = await route.load();
    if (seq !== renderSeq) return;
    await mod.render(view, { params: { ...route.params, ...route.extra }, query, path, navigate });
  } catch (err) {
    if (seq !== renderSeq) return;
    console.error(err);
    view.innerHTML = String(html`<div class="card"><div class="card-body"><strong>Could not load this page.</strong> <span class="muted">${err.message}</span></div></div>`);
  }
  updateCounts(sh);
}

window.addEventListener('hashchange', render);
render();
