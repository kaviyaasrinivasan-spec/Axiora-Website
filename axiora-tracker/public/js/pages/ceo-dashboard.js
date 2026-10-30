import {
  api, categoryBadge, defaultProduct, fmtDateTime, html, icon, initials, label, optionsFrom, person, priorityBadge, productOptions, qs, raw,
  state, statusBadge,
} from '../lib.js';
import { periodRange } from './reports.js';

const PERIODS = { today: 'Today', week: 'This Week', month: 'This Month', custom: 'Custom' };
const FILTERS = ['product', 'category', 'assigned_to', 'priority'];
const SERIES = [['requirement', 'Requirements'], ['defect', 'Defects']];
const STATUS_COLORS = {
  new: '#64748b', assigned: '#0ea5e9', in_development: '#f97316', self_test: '#a855f7', ready_for_qa: '#2563eb',
  qa_in_progress: '#eab308', qa_rejected: '#ef4444', qa_approved: '#22c55e', ready_for_production: '#14b8a6', deployed: '#065f46', verified: '#84cc16',
};
const KPIS = [
  ['new_requirements', 'New Requirements', 'doc', 'blue'],
  ['new_defects', 'New Defects', 'bug', 'red', true],
  ['moved_to_development', 'Moved to Development', 'code', 'green'],
  ['moved_to_qa', 'Moved to QA', 'check', 'purple'],
  ['qa_approved', 'QA Approved', 'star', 'orange'],
  ['deployed', 'Deployed to Production', 'rocket', 'teal'],
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
const longDate = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const bucketLabel = (b) => (b.length === 7 ? `${MONTHS[Number(b.slice(5, 7)) - 1]} ${b.slice(2, 4)}` : dayLabel(b));

export async function render(view, { query }) {
  const period = PERIODS[query.period] ? query.period : 'today';
  const filters = Object.fromEntries(FILTERS.filter((k) => query[k]).map((k) => [k, query[k]]));
  if (defaultProduct(query)) filters.product = defaultProduct(query);
  const range = periodRange(period, query.from, query.to);
  const d = await api('GET', 'api/ceo-dashboard' + qs({ ...filters, ...range, tz: new Date().getTimezoneOffset() }));
  const go = (next) => { location.hash = '#/ceo-dashboard' + qs(next); };
  const current = { ...filters, period, ...(period === 'custom' ? { from: query.from, to: query.to } : {}) };
  // Item-list links carry the same product / type / developer / priority filters.
  const listLink = (extra) => (['deployed', 'verified'].includes(extra.status) ? `#/${extra.status}${qs({ ...filters, ...extra, status: undefined })}` : `#/items${qs({ ...filters, ...extra })}`);

  view.innerHTML = String(html`
    <div class="ceo">
      <div class="ceo-head">
        <div class="ceo-title"><span class="ceo-crown">${icon('crown')}</span>
          <div><h1>CEO Dashboard</h1><div class="sub">Change &amp; Defect Tracking</div></div></div>
        <div class="ceo-dates">
          <div class="seg" role="group" aria-label="Date range">${Object.entries(PERIODS).map(([k, text]) => html`
            <button type="button" class="${k === period ? 'active' : ''}" data-period="${k}" aria-pressed="${k === period}">${text}</button>`)}</div>
          <div class="ceo-range">${icon('calendar')}
            ${period === 'custom' ? html`<input type="date" data-date="from" value="${query.from || d.range.from}" max="${query.to || ''}" aria-label="Start date">
              <span class="muted">–</span><input type="date" data-date="to" value="${query.to || d.range.to}" min="${query.from || ''}" aria-label="End date">`
              : html`<span>${longDate(d.range.from)}</span><span class="muted">–</span><span>${longDate(d.range.to)}</span>`}
          </div>
        </div>
      </div>

      <form class="card ceo-filters" data-filters>
        ${filterSelect('product', 'Product', productOptions('All Products', true, 'all'), filters.product)}
        ${filterSelect('category', 'Type', optionsFrom(state.meta.categories, 'All Types'), filters.category)}
        ${filterSelect('assigned_to', 'Developer', [{ value: '', label: 'All Developers' }, ...developers()], filters.assigned_to)}
        ${filterSelect('priority', 'Priority', optionsFrom(state.meta.priorities, 'All Priorities'), filters.priority)}
        <button type="button" class="link ceo-reset" data-reset>Reset</button>
      </form>

      <div class="ceo-kpis">${KPIS.map(([key, text, ic, tone, inverse]) => kpiCard(d.kpis[key], text, ic, tone, inverse, d.range))}</div>

      <div class="ceo-row ceo-row-1">
        ${card('Items Raised (Requirements vs Defects)', chartNote(d.range), chartBox('raised', d.raised), legend())}
        ${card('Current Items by Status', 'Now', donut(d.statusNow, listLink))}
        ${card('Production Deployment', chartNote(d.range), chartBox('deployed', d.deployments), legend())}
      </div>

      <div class="ceo-row ceo-row-2">
        ${card('Developer-wise Completion (Deployed to Production)', rangeText(d.range), developerBars(d.developers))}
        ${card(`Items Completed by Status (${PERIODS[period]})`, rangeText(d.range), chartBox('completed', d.completed), legend())}
        ${pendingCard(d.pending, listLink)}
      </div>

      <section class="card ceo-card">
        <div class="ceo-card-head"><div><h2>Recently Completed Items (Moved to Production)</h2><div class="ceo-note">${rangeText(d.range)}</div></div>
          <a class="link" href="${listLink({ status: 'deployed', sort: 'updated' })}">View all</a></div>
        ${recentTable(d.recent)}
      </section>
    </div>`);

  // Charts are drawn at their container's real width, so text stays at its true size.
  const charts = {
    raised: [d.raised.map((r) => ({ ...r, label: bucketLabel(r.bucket) }))],
    deployed: [d.deployments.map((r) => ({ ...r, label: bucketLabel(r.bucket) }))],
    completed: [d.completed.map((r) => ({ ...r, label: COMPLETED[r.key] })), true],
  };
  view.querySelectorAll('[data-chart]').forEach((el) => {
    let width = 0;
    const draw = () => {
      const w = Math.round(el.clientWidth);
      if (!w || w === width) return;
      width = w;
      el.innerHTML = barSvg(w, ...charts[el.dataset.chart]);
    };
    draw();
    new ResizeObserver(draw).observe(el);
  });

  view.querySelector('.seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-period]');
    if (!b) return;
    const next = { ...filters, period: b.dataset.period };
    if (next.period === 'custom') Object.assign(next, { from: d.range.from, to: d.range.to });
    go(next);
  });
  view.querySelectorAll('[data-date]').forEach((input) => input.addEventListener('change', () => {
    let from = view.querySelector('[data-date=from]').value;
    let to = view.querySelector('[data-date=to]').value;
    if (from && to && from > to) [from, to] = [to, from];
    go({ ...filters, period: 'custom', from, to });
  }));
  const form = view.querySelector('[data-filters]');
  form.addEventListener('change', () => {
    const picked = Object.fromEntries([...new FormData(form)].filter(([, v]) => v));
    go({ ...current, ...Object.fromEntries(FILTERS.map((k) => [k, picked[k]])) });
  });
  view.querySelector('[data-reset]').addEventListener('click', () => go({}));
}

const COMPLETED = { dev_complete: 'Dev Complete', qa_approved: 'QA Approved', deployed: 'Deployed to Production' };

/** People who can be assigned development work (Settings → Workflow permissions). */
const developers = () => (state.meta?.users || [])
  .filter((u) => (state.meta?.workflowRoles?.start_development || ['developer', 'admin']).includes(u.role))
  .map((u) => ({ value: u.id, label: u.active ? u.name : `${u.name} (inactive)` }));

const filterSelect = (name, text, options, value) => html`<label class="ceo-filter"><span>${text}</span>
  <select name="${name}">${options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value ?? '') ? raw('selected') : ''}>${o.label}</option>`)}</select></label>`;

const card = (title, note, body, extra = '') => html`<section class="card ceo-card">
  <div class="ceo-card-head"><div><h2>${title}</h2>${note ? html`<div class="ceo-note">${note}</div>` : ''}</div>${extra}</div>${body}</section>`;

const rangeText = (r) => (r.from === r.to ? longDate(r.from) : `${longDate(r.from)} – ${longDate(r.to)}`);
const chartNote = (r) => (r.chart.from !== r.from ? `Last 7 days · ${rangeText(r.chart)}` : rangeText(r.chart)) + (r.chart.unit === 'month' ? ' · by month' : '');

const legend = () => html`<div class="ceo-legend">${SERIES.map(([k, text]) => html`<span><i class="sw sw-${k}"></i>${text}</span>`)}</div>`;

function kpiCard(k, text, ic, tone, inverse, r) {
  const diff = k.value - k.previous;
  const pct = k.previous ? Math.round((diff / k.previous) * 100) : null;
  const good = inverse ? diff < 0 : diff > 0;
  const change = diff === 0 ? html`<span class="kpi-delta flat">0%</span>`
    : html`<span class="kpi-delta ${good ? 'up' : 'down'}">${diff > 0 ? '▲' : '▼'} ${pct === null ? `${diff > 0 ? '+' : ''}${diff}` : `${pct > 0 ? '+' : ''}${pct}%`}</span>`;
  const prevName = r.days === 1 ? 'previous day' : `previous ${r.days} days`;
  return html`<div class="kpi kpi-${tone}" title="Previous period: ${rangeText(r.previous)}">
    <span class="kpi-icon">${icon(ic)}</span>
    <div class="kpi-body"><div class="kpi-label">${text}</div>
      <div class="kpi-main"><span class="kpi-value">${k.value}</span>${change}</div>
      <div class="kpi-sub">vs ${prevName} (${k.previous})</div></div>
  </div>`;
}

/** Rounds an axis maximum up to a tidy value with 4–5 gridlines. */
function niceScale(max) {
  if (max <= 4) return { top: 4, step: 1 };
  const target = max / 4;
  const mag = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= target);
  return { top: Math.ceil(max / step) * step, step };
}

const chartBox = (id, rows) => {
  const total = rows.reduce((a, r) => a + r.requirement + r.defect, 0);
  return html`<div class="ceo-chart-wrap"><div class="ceo-chart" data-chart="${id}" data-total="${total}"></div>
    ${total ? '' : html`<div class="ceo-chart-empty">Nothing in this period</div>`}</div>`;
};

/** Grouped bar chart (requirements vs defects) as inline SVG; every bar has a hover tooltip. */
function barSvg(W, rows, wideGroups = false) {
  const H = 230; const L = 30; const R = 6; const T = 18; const B = wideGroups ? 40 : 26;
  const max = Math.max(0, ...rows.flatMap((r) => [r.requirement, r.defect]));
  const { top, step } = niceScale(max);
  const plotW = W - L - R; const plotH = H - T - B;
  const slot = plotW / rows.length;
  const barW = Math.max(2, Math.min(wideGroups ? 46 : 26, (slot * (rows.length > 12 ? 0.8 : 0.62) - 2) / 2));
  const y = (v) => T + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(rows.length / Math.max(2, Math.floor(plotW / (wideGroups ? 90 : 46))));
  const showValues = slot >= 30;
  const bar = (x, v, k, r) => {
    const h = (v / top) * plotH;
    if (!v) return '';
    const rr = Math.min(4, h, barW / 2);
    const yTop = T + plotH - h;
    return `<path class="bar bar-${k}" d="M${x},${T + plotH} V${yTop + rr} q0,-${rr} ${rr},-${rr} h${barW - 2 * rr} q${rr},0 ${rr},${rr} V${T + plotH} Z"><title>${esc(r.label)} · ${k === 'requirement' ? 'Requirements' : 'Defects'}: ${v}</title></path>`
      + (showValues ? `<text class="bar-value" x="${x + barW / 2}" y="${yTop - 5}" text-anchor="middle">${v}</text>` : '');
  };
  let svg = '';
  for (let v = 0; v <= top + 1e-9; v += step) {
    svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(2)}</text>`;
  }
  rows.forEach((r, i) => {
    const cx = L + slot * i + slot / 2;
    svg += bar(cx - barW - 1, r.requirement, 'requirement', r) + bar(cx + 1, r.defect, 'defect', r);
    if (i % labelEvery === 0) {
      const words = r.label.split(' ');
      const lines = wideGroups && words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [r.label];
      svg += lines.map((t, n) => `<text class="axis x" x="${cx}" y="${T + plotH + 17 + n * 14}" text-anchor="middle">${esc(t)}</text>`).join('');
    }
  });
  svg += `<line class="baseline" x1="${L}" x2="${W - R}" y1="${T + plotH}" y2="${T + plotH}"/>`;
  const desc = rows.map((r) => `${r.label}: ${r.requirement} requirements, ${r.defect} defects`).join('; ');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">${svg}</svg>`;
}

function donut(counts, listLink) {
  const entries = Object.entries(counts);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const R = 70; const C = 2 * Math.PI * R; const gap = total && entries.filter(([, n]) => n).length > 1 ? 2 : 0;
  let offset = 0; let segs = ''; let labels = '';
  for (const [s, n] of entries) {
    if (!n) continue;
    const len = (n / total) * C;
    segs += `<circle r="${R}" cx="100" cy="100" fill="none" stroke="${STATUS_COLORS[s]}" stroke-width="34"
      stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"><title>${esc(label.status(s))}: ${n}</title></circle>`;
    const pct = Math.round((n / total) * 100);
    if (pct >= 5) {
      const a = ((offset + len / 2) / C) * 2 * Math.PI - Math.PI / 2;
      labels += `<text class="donut-pct" x="${100 + R * Math.cos(a)}" y="${100 + R * Math.sin(a) + 4}" text-anchor="middle">${pct}%</text>`;
    }
    offset += len;
  }
  if (!total) segs = `<circle r="${R}" cx="100" cy="100" fill="none" stroke="var(--grid)" stroke-width="34"/>`;
  return html`<div class="ceo-donut">
    <svg viewBox="0 0 200 200" role="img" aria-label="${entries.map(([s, n]) => `${label.status(s)}: ${n}`).join(', ')}">${raw(segs + labels)}
      <text class="donut-total" x="100" y="102" text-anchor="middle">${total}</text><text class="donut-sub" x="100" y="122" text-anchor="middle">Total Items</text></svg>
    <ul class="donut-legend">${entries.map(([s, n]) => html`<li><a href="${listLink({ status: s })}"><i style="background:${STATUS_COLORS[s]}"></i><span>${label.status(s)}</span><strong>${n}</strong></a></li>`)}</ul>
  </div>`;
}

function developerBars(rows) {
  if (!rows.length) return html`<div class="ceo-chart-empty static">No deployments in this period</div>`;
  const max = Math.max(...rows.map((r) => r.deployed));
  return html`<div class="dev-bars"><div class="dev-bars-head">Count</div>${rows.map((r) => html`<div class="dev-bar" title="${r.name}: ${r.deployed} deployed">
    <span class="avatar">${initials(r.name)}</span><span class="dev-name">${r.name}</span>
    <span class="dev-track"><span style="width:${(r.deployed / max) * 100}%"></span></span><strong>${r.deployed}</strong></div>`)}</div>`;
}

function pendingCard(p, listLink) {
  const rows = [
    ['unassigned', 'Awaiting Developer Assignment', 'clock', { status: 'new' }],
    ['overdue_development', 'In Development (Overdue)', 'code', { status: 'assigned,in_development,self_test', overdue: 1 }],
    ['awaiting_qa', 'Awaiting QA', 'clock', { status: 'ready_for_qa,qa_in_progress' }],
    ['qa_rejected', 'QA Rejected (To be Fixed)', 'alert', { status: 'qa_rejected' }],
    ['awaiting_production', 'QA Approved (Waiting for Production)', 'package', { status: 'qa_approved,ready_for_production' }],
    ['critical_defects', 'Critical / Blocker Open Defects', 'alert', { category: 'defect', priority: 'blocker,critical', open: 1 }],
  ];
  return html`<section class="card ceo-card ceo-pending">
    <div class="ceo-card-head"><div><h2>Pending &amp; Risks</h2><div class="ceo-note">Now</div></div></div>
    <ul>${rows.map(([k, text, ic, link]) => html`<li><a href="${listLink(link)}">${icon(ic)}<span>${text}</span><strong>${p[k]}</strong></a></li>`)}</ul>
  </section>`;
}

function recentTable(rows) {
  if (!rows.length) return html`<div class="ceo-chart-empty static">No items were deployed to production in this period</div>`;
  return html`<div class="table-wrap"><table class="ceo-table">
    <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Product</th><th>Priority</th><th>Assigned To</th><th>Completed By</th><th>Completion Date</th><th>Status</th></tr></thead>
    <tbody>${rows.map((i) => html`<tr>
      <td class="key"><a href="#/items/${i.id}">${i.item_key}</a></td><td class="title-cell">${i.title}</td><td>${categoryBadge(i.category)}</td>
      <td>${i.product_name}</td><td>${priorityBadge(i.priority)}</td><td>${person(i.assigned_name)}</td><td>${person(i.completed_by_name)}</td>
      <td class="nowrap">${fmtDateTime(i.completed_at)}</td><td>${statusBadge(i.status)}</td></tr>`)}</tbody>
  </table></div>`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
