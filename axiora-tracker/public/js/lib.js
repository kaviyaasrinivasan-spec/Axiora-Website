// Shared client helpers: safe HTML templating, API calls, formatting, dialogs and form utilities.

// ---------- Escaping templating ----------
// html`...` escapes every interpolated value unless it is itself the result of html`` or raw().
class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
function fmt(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join('');
  return esc(v);
}
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += fmt(values[i]) + strings[i + 1];
  return new Raw(out);
}

// ---------- App state ----------
export const state = { meta: null, user: null };
export const can = (perm) => Boolean(state.meta?.permissions?.[perm]);
export const label = {
  status: (s) => state.meta?.statuses[s] ?? s,
  planning: (s) => state.meta?.planningStatuses?.[s] ?? s,
  priority: (p) => state.meta?.priorities[p] ?? p,
  category: (c) => state.meta?.categories[c] ?? c,
  role: (r) => state.meta?.roles[r] ?? r,
};

// ---------- API ----------
export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `Request failed (${status})`);
    this.status = status;
    this.fields = data?.fields;
  }
}

export async function api(method, url, body) {
  const opts = { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'axiora-tracker' } };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch {
    throw new ApiError(0, { error: 'Cannot reach the server. Check your connection.' });
  }
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  if (res.status === 401 && !url.startsWith('api/auth/')) {
    state.user = null;
    location.hash = '#/login?expired=1';
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

// ---------- Formatting ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(value) {
  if (!value) return '—';
  const d = value.length === 10 ? new Date(value + 'T00:00:00') : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${fmtDate(value)}, ${hh}:${mm}`;
}
export function timeAgo(value) {
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(value);
}
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const fmtSize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

// ---------- Icons (inline SVG, stroke = currentColor) ----------
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 7l-3 2M5 7l3 2M19 13h-3M5 13h3M19 19l-3-2M5 19l3-2M12 6V3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  verified: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/>',
  package: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M21 21v-2a4 4 0 0 0-3-3.9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  paperclip: '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  play: '<path d="m6 3 14 9-14 9z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A9.6 9.6 0 0 1 12 4c6.4 0 10 8 10 8a17.6 17.6 0 0 1-2.2 3.2M6.6 6.6C3.6 8.6 2 12 2 12s3.6 8 10 8a9.5 9.5 0 0 0 5.4-1.6M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  arrowUp: '<path d="m18 15-6-6-6 6"/>',
  arrowsUp: '<path d="m17 11-5-5-5 5M17 18l-5-5-5 5"/>',
  minus: '<path d="M5 12h14"/>',
  crown: '<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5z"/><path d="M5 21h14"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/>',
  star: '<path d="m12 2.8 2.9 5.9 6.4.9-4.7 4.5 1.1 6.4L12 17.5l-5.7 3 1.1-6.4-4.7-4.5 6.4-.9z"/>',
  arrowDown: '<path d="m6 9 6 6 6-6"/>',
};
export const icon = (name, cls = '') => raw(
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`,
);
export const logo = (size = 30) => raw(
  `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 4 36h8l8-17 8 17h8z" fill="#2f7bff"/><path d="M20 19 14 32h12z" fill="#9cc2ff"/></svg>`,
);

// ---------- Badges ----------
export const planningBadge = (s) => html`<span class="plan plan-${s}">${label.planning(s)}</span>`;
export const statusBadge = (s) => html`<span class="badge st-${s}">${label.status(s)}</span>`;
const PRI_ICON = { blocker: 'ban', critical: 'arrowsUp', high: 'arrowUp', medium: 'minus', low: 'arrowDown' };
export const priorityBadge = (p) => html`<span class="pri pri-${p}">${icon(PRI_ICON[p])}${label.priority(p)}</span>`;
export const categoryBadge = (c) => html`<span class="cat cat-${c}">${label.category(c)}</span>`;
export const person = (name) => (name ? html`<span class="row nowrap"><span class="avatar sm">${initials(name)}</span>${name}</span>` : html`<span class="muted">Unassigned</span>`);

export function emptyState(title, text = '', iconName = 'inbox') {
  return html`<div class="empty">${icon(iconName)}<strong>${title}</strong>${text}</div>`;
}

export function fileList(files) {
  if (!files?.length) return '';
  return html`<div class="files">${files.map((f) => html`
    <a class="file" href="api/attachments/${f.id}" target="_blank" rel="noopener" title="${f.original_name} · ${fmtSize(f.size)}">
      ${f.mime.startsWith('image/') ? html`<img src="api/attachments/${f.id}" alt="" loading="lazy">` : icon('paperclip')}
      <span>${f.original_name}</span>
    </a>`)}</div>`;
}

// ---------- Toasts ----------
export function toast(message, kind = '') {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = document.createElement('div');
    box.className = 'toasts';
    box.setAttribute('role', 'status');
    document.body.append(box);
  }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = message;
  box.append(t);
  setTimeout(() => t.remove(), 4200);
}

// ---------- Form helpers ----------
export function field({ name, label: text, type = 'text', required = false, value = '', options, help, placeholder = '', rows, full, attrs = '', list }) {
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  let control;
  if (type === 'select') {
    control = html`<select id="${id}" name="${name}" ${raw(attrs)} ${required ? raw('required') : ''}>
      ${options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value ?? '') ? raw('selected') : ''}>${o.label}</option>`)}
    </select>`;
  } else if (type === 'textarea') {
    control = html`<textarea id="${id}" name="${name}" rows="${rows || 4}" placeholder="${placeholder}" ${raw(attrs)} ${required ? raw('required') : ''}>${value ?? ''}</textarea>`;
  } else if (type === 'radio') {
    control = html`<div class="radio-row" role="radiogroup">${options.map((o) => html`
      <label><input type="radio" name="${name}" value="${o.value}" ${String(o.value) === String(value) ? raw('checked') : ''} ${raw(attrs)}> ${o.label}</label>`)}</div>`;
  } else if (type === 'file') {
    const u = state.meta?.uploads;
    control = dropzone(id);
    help = help ?? (u ? `Up to ${u.maxFiles} files per save, ${u.maxMb} MB each. Images, PDF, Office documents, text, CSV, ZIP.` : '');
  } else if (type === 'password') {
    control = passwordInput({ id, name, autocomplete: 'new-password', required });
  } else {
    control = html`<input id="${id}" type="${type}" name="${name}" value="${value ?? ''}" placeholder="${placeholder}" ${list ? raw(`list="${esc(list)}"`) : ''} ${raw(attrs)} ${required ? raw('required') : ''}>`;
  }
  const lbl = type === 'radio' ? html`<span class="label">${text}${required ? html`<span class="req">*</span>` : ''}</span>`
    : html`<label for="${id}">${text}${required ? html`<span class="req">*</span>` : ''}</label>`;
  return html`<div class="field ${full ? 'full' : ''}" data-field="${type === 'file' ? 'files' : name}">${lbl}${control}${help ? html`<span class="help">${help}</span>` : ''}</div>`;
}

export function clearErrors(form) {
  form.querySelectorAll('.field-error, .form-error').forEach((el) => el.remove());
  form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
}

export function showErrors(form, err, container = form) {
  clearErrors(form);
  const box = document.createElement('div');
  box.className = 'form-error';
  box.setAttribute('role', 'alert');
  box.textContent = err.message;
  container.prepend(box);
  for (const [name, msg] of Object.entries(err.fields || {})) {
    const f = form.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (!f) continue;
    f.classList.add('invalid');
    const e = document.createElement('span');
    e.className = 'field-error';
    e.textContent = msg;
    f.append(e);
  }
  form.querySelector('.invalid input, .invalid select, .invalid textarea')?.focus();
}

/** Builds a JSON object or FormData (when files are chosen) from a form. */
export function formPayload(form, extra = {}) {
  const fd = new FormData(form);
  const files = [
    ...fd.getAll('files').filter((f) => f instanceof File && f.size > 0),
    ...[...form.querySelectorAll('[data-dropzone]')].flatMap((dz) => dropzoneFiles(dz)),
  ];
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  if (files.length) {
    fd.delete('files');
    // "files[]": PHP keeps only the last file of a repeated plain "files" field.
    files.forEach((f) => fd.append('files[]', f));
    return fd;
  }
  fd.delete('files');
  return Object.fromEntries(fd.entries());
}

// ---------- Dialogs ----------
/**
 * Opens a modal form. `onSubmit(form, submitterValue)` may throw ApiError to keep the dialog
 * open with field errors; resolving closes it and resolves the returned promise with its value.
 */
export function openDialog({ title, body, submitLabel = 'Save', submitClass = 'btn-primary', buttons, cancelLabel = 'Cancel', onSubmit, wide = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    if (wide) dlg.style.width = 'min(760px, calc(100vw - 32px))';
    const btns = buttons || [{ label: submitLabel, cls: submitClass, value: 'submit' }];
    dlg.innerHTML = String(html`
      <form method="dialog" novalidate>
        <div class="dialog-head"><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
        <div class="dialog-body">${body}</div>
        <div class="dialog-foot">
          <button type="button" class="btn" data-close>${cancelLabel}</button>
          ${btns.map((b) => html`<button type="submit" class="btn ${b.cls || 'btn-primary'}" value="${b.value}" ${b.disabled ? raw('disabled') : ''} data-btn="${b.value}">${b.label}</button>`)}
        </div>
      </form>`);
    document.body.append(dlg);
    const form = dlg.querySelector('form');
    let result;
    const close = (value) => { result = value; dlg.close(); };
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(undefined)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = e.submitter?.value || 'submit';
      const buttonsEls = form.querySelectorAll('button');
      buttonsEls.forEach((b) => { b.disabled = true; });
      try {
        const out = onSubmit ? await onSubmit(form, value) : value;
        close(out ?? value);
      } catch (err) {
        buttonsEls.forEach((b) => { b.disabled = false; });
        if (err instanceof ApiError) showErrors(form, err, dlg.querySelector('.dialog-body'));
        else throw err;
      }
    });
    dlg.showModal();
    dlg.querySelector('.dialog-body input:not([type=hidden]), .dialog-body select, .dialog-body textarea')?.focus();
  });
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  return openDialog({
    title,
    body: html`<p>${message}</p>`,
    submitLabel: confirmLabel,
    submitClass: danger ? 'btn-danger' : 'btn-primary',
    onSubmit: onConfirm ? async () => { await onConfirm(); return true; } : () => true,
  });
}

/** Wraps an async UI handler so failures become a toast instead of an unhandled rejection. */
export const guard = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    toast(err.message || 'Something went wrong.', 'error');
    return undefined;
  }
};

/** Options for selects. */
export const productOptions = (withAll, includeInactive = false, allValue = '') => [
  ...(withAll ? [{ value: allValue, label: withAll }] : []),
  ...(state.meta?.products || []).filter((p) => includeInactive || p.active).map((p) => ({ value: p.id, label: p.name })),
];
export const developerOptions = (withAll, allValue = '') => [
  ...(withAll ? [{ value: allValue, label: withAll }] : []),
  ...(state.meta?.users || []).filter((u) => u.active && (state.meta?.workflowRoles?.start_development || ['developer', 'admin']).includes(u.role))
    .map((u) => ({ value: u.id, label: u.name })),
];
/** Active users whose role may verify changes (Settings → Workflow permissions → Start QA verification). */
export const qaOptions = (withAll, allValue = '', exclude = null) => [
  ...(withAll ? [{ value: allValue, label: withAll }] : []),
  ...(state.meta?.users || []).filter((u) => u.active && (state.meta?.workflowRoles?.start_qa || ['qa', 'admin']).includes(u.role) && u.id !== exclude)
    .map((u) => ({ value: u.id, label: u.role === 'admin' ? `${u.name} (Admin)` : u.name })),
];

/** CARGORA, the default product, when it is configured and active. */
export const defaultProductId = () => (state.meta?.products || []).find((p) => p.active && p.name.toLowerCase() === 'cargora')?.id;

/** Product filter value: CARGORA unless the URL says otherwise ("all" means every product). */
export const defaultProduct = (query) => query.product || (defaultProductId() ? String(defaultProductId()) : '');

/** Password input with a show/hide toggle (handled by the document-level listener below). */
export function passwordInput({ id, name, autocomplete = 'current-password', required = true }) {
  return html`<span class="pw-wrap"><input id="${id}" type="password" name="${name}" autocomplete="${autocomplete}" ${required ? raw('required') : ''}>
    <button type="button" class="pw-toggle" data-toggle-password aria-label="Show password" title="Show password">${icon('eye')}</button></span>`;
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-toggle-password]');
  if (!btn) return;
  const input = btn.parentElement.querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = String(icon(show ? 'eyeOff' : 'eye'));
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  btn.title = show ? 'Hide password' : 'Show password';
  input.focus();
});

/**
 * Developer filter value for list pages: a signed-in developer starts on their own items.
 * An explicit choice in the URL wins; "all" means every developer.
 */
export const defaultAssignee = (query) => query.assigned_to || (state.user?.role === 'developer' ? String(state.user.id) : '');
export const optionsFrom = (map, withAll) => [
  ...(withAll ? [{ value: '', label: withAll }] : []),
  ...Object.entries(map).map(([value, l]) => ({ value, label: l })),
];

// ---------- Upload area ----------
// Replaces the browser's file input, which forgets earlier picks. Files chosen with the picker,
// dropped onto the area or pasted (Ctrl+V) are all added to one list that stays until the user
// removes a file or the form is saved. formPayload() sends every file in the list.
const zoneFiles = new WeakMap();
const zoneUrls = new WeakMap();

export const dropzoneFiles = (dz) => zoneFiles.get(dz) || [];

function dropzone(id) {
  const exts = state.meta?.uploads?.extensions || [];
  return html`<div class="dropzone" data-dropzone tabindex="0" role="group" aria-label="Attachments: drop, paste or choose files">
    <input id="${id}" type="file" multiple hidden data-dropzone-input accept="${exts.map((e) => '.' + e).join(',')}">
    <div class="dz-prompt">${icon('paperclip')}<span><strong>Drag &amp; drop files here</strong>, paste with Ctrl+V, or
      <button type="button" class="link-btn" data-dropzone-browse>choose files</button></span></div>
    <ul class="dz-list" aria-live="polite"></ul>
  </div>`;
}

const pad = (n) => String(n).padStart(2, '0');
function namePasted(file, i) {
  // Screenshots arrive as "image.png" every time; give each a distinct, readable name.
  if (file.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(file.name)) return file;
  const d = new Date();
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const name = `pasted-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${i ? `-${i + 1}` : ''}.${ext}`;
  return new File([file], name, { type: file.type, lastModified: Date.now() });
}

export function addDropzoneFiles(dz, incoming) {
  const u = state.meta?.uploads || { extensions: [], maxMb: 10, maxFiles: 10 };
  const files = dropzoneFiles(dz);
  const problems = [];
  for (const f of incoming) {
    if (!(f instanceof File)) continue;
    const ext = f.name.includes('.') ? f.name.split('.').pop().toLowerCase() : '';
    if (!u.extensions.includes(ext)) { problems.push(`"${f.name}" is not an allowed file type.`); continue; }
    if (f.size > u.maxMb * 1048576) { problems.push(`"${f.name}" is larger than ${u.maxMb} MB.`); continue; }
    if (files.some((x) => x.name === f.name && x.size === f.size && x.lastModified === f.lastModified)) continue;
    if (files.length >= u.maxFiles) { problems.push(`You can attach up to ${u.maxFiles} files per save. Save, then add more.`); break; }
    files.push(f);
  }
  zoneFiles.set(dz, files);
  renderDropzone(dz);
  if (problems.length) toast(problems.join(' '), 'error');
}

function renderDropzone(dz) {
  const files = dropzoneFiles(dz);
  const urls = zoneUrls.get(dz) || new Map();
  for (const [f, url] of urls) if (!files.includes(f)) { URL.revokeObjectURL(url); urls.delete(f); }
  for (const f of files) if (f.type.startsWith('image/') && !urls.has(f)) urls.set(f, URL.createObjectURL(f));
  zoneUrls.set(dz, urls);
  dz.querySelector('.dz-list').innerHTML = String(html`${files.map((f, i) => html`<li>
    ${urls.has(f) ? html`<img src="${urls.get(f)}" alt="">` : html`<span class="dz-icon">${icon('paperclip')}</span>`}
    <span class="dz-name" title="${f.name}">${f.name}</span><span class="dz-size">${fmtSize(f.size)}</span>
    <button type="button" class="icon-btn dz-remove" data-dz-remove="${i}" aria-label="Remove ${f.name}" title="Remove">${icon('x')}</button>
  </li>`)}`);
  dz.classList.toggle('has-files', files.length > 0);
}

function removeDropzoneFile(dz, index) {
  const files = dropzoneFiles(dz).filter((_, i) => i !== index);
  zoneFiles.set(dz, files);
  renderDropzone(dz);
}

const zoneOf = (el) => (el instanceof Element ? el.closest('[data-dropzone]') : null);

document.addEventListener('click', (e) => {
  const browse = e.target.closest?.('[data-dropzone-browse]');
  if (browse) { zoneOf(browse).querySelector('[data-dropzone-input]').click(); return; }
  const remove = e.target.closest?.('[data-dz-remove]');
  if (remove) { removeDropzoneFile(zoneOf(remove), Number(remove.dataset.dzRemove)); return; }
  const dz = zoneOf(e.target);
  if (dz && !e.target.closest('button, input')) dz.focus(); // focused area receives Ctrl+V
});
document.addEventListener('keydown', (e) => {
  const dz = zoneOf(e.target);
  if (dz && e.target === dz && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    dz.querySelector('[data-dropzone-input]').click();
  }
});
document.addEventListener('change', (e) => {
  if (!e.target.matches?.('[data-dropzone-input]')) return;
  addDropzoneFiles(zoneOf(e.target), [...e.target.files]);
  e.target.value = ''; // allow choosing the same file again after removing it
});
// Drag & drop. Drops outside an upload area are swallowed so a stray file never replaces the page.
for (const type of ['dragenter', 'dragover']) {
  document.addEventListener(type, (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    e.preventDefault();
    const dz = zoneOf(e.target);
    e.dataTransfer.dropEffect = dz ? 'copy' : 'none';
    document.querySelectorAll('.dropzone.dragover').forEach((z) => { if (z !== dz) z.classList.remove('dragover'); });
    dz?.classList.add('dragover');
  });
}
document.addEventListener('dragleave', (e) => {
  const dz = zoneOf(e.target);
  if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
});
document.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  const dz = zoneOf(e.target);
  document.querySelectorAll('.dropzone.dragover').forEach((z) => z.classList.remove('dragover'));
  if (dz) addDropzoneFiles(dz, [...e.dataTransfer.files]);
});
// Paste: into the focused upload area, or, when a screenshot is pasted while working in a form,
// into that form's upload area (or the only one on screen).
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (!files.length) return;
  const active = document.activeElement;
  const scope = active?.closest?.('form, dialog') || document.querySelector('dialog[open]') || document;
  const zones = [...scope.querySelectorAll('[data-dropzone]')];
  const dz = zoneOf(active) || (zones.length === 1 ? zones[0] : null);
  if (!dz) return;
  e.preventDefault();
  addDropzoneFiles(dz, files.map(namePasted));
  dz.focus();
});
