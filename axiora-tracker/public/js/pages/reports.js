import { api, defaultProduct, emptyState, field, fmtDateTime, html, icon, label, optionsFrom, productOptions, qs, state, statusBadge } from '../lib.js';

const FILTERS = ['product', 'category', 'period', 'from', 'to'];
const PERIODS = { '': 'All time', today: 'Today', week: 'This week', month: 'This month', custom: 'Custom' };
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Calendar dates (viewer's local time) for a period; weeks start on Monday. */
export function periodRange(period, from, to) {
  const now = new Date();
  const today = ymd(now);
  if (period === 'today') return { from: today, to: today };
  if (period === 'week') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))), to: today };
  if (period === 'month') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (period === 'custom') return { from, to };
  return {};
}

// A fresh load of the page (opening it or refreshing) starts on the default product.
let firstRender = true;
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

export async function render(view, { query }) {
  if (firstRender) {
    firstRender = false;
    if (query.product) {
      const { product, ...rest } = query;
      history.replaceState(null, '', '#/reports' + qs(rest));
      query = rest;
    }
  }
  const filters = Object.fromEntries(FILTERS.filter((k) => query[k]).map((k) => [k, query[k]]));
  if (defaultProduct(query)) filters.product = defaultProduct(query);
  if (!filters.period && (filters.from || filters.to)) filters.period = 'custom';
  if (filters.period !== 'custom') { delete filters.from; delete filters.to; }
  const range = periodRange(filters.period, filters.from, filters.to);
  const scope = { product: filters.product, category: filters.category, ...range };
  const r = await api('GET', 'api/reports' + qs({ ...scope, tz: range.from || range.to ? new Date().getTimezoneOffset() : '' }));
  const statuses = Object.keys(state.meta.statuses);
  const products = [...new Set(r.matrix.map((m) => m.product))];
  const cell = (p, s) => r.matrix.find((m) => m.product === p && m.status === s)?.n || 0;
  const productTotal = (p) => r.matrix.filter((m) => m.product === p).reduce((a, m) => a + m.n, 0);

  view.innerHTML = String(html`
    <div class="page-head">
      <div><h1>Reports</h1><div class="sub">Status, quality and delivery figures computed from tracker records.</div></div>
      <div class="page-actions"><a class="btn" href="api/items/export.csv${qs(scope)}">${icon('download')} Export items (CSV)</a></div>
    </div>
    <form class="card filters" data-filters style="margin-bottom:16px">
      ${field({ name: 'product', label: 'Product', type: 'select', options: productOptions('All products', true, 'all'), value: filters.product })}
      ${field({ name: 'category', label: 'Type', type: 'select', options: optionsFrom(state.meta.categories, 'All types'), value: filters.category })}
      ${field({ name: 'period', label: 'Date', type: 'select', options: Object.entries(PERIODS).map(([value, text]) => ({ value, label: text })), value: filters.period || '' })}
      ${filters.period === 'custom' ? html`<div class="field"><label>From – to</label><span class="date-pair">
        <input type="date" name="from" value="${filters.from || ''}" max="${filters.to || ''}" aria-label="Start date"><span class="muted">–</span>
        <input type="date" name="to" value="${filters.to || ''}" min="${filters.from || ''}" aria-label="End date"></span></div>` : ''}
      ${range.from || range.to ? html`<div class="small muted report-range">${rangeText(range)}</div>` : ''}
    </form>

    <div class="stats">
      ${stat('QA verifications', r.qa.total || 0)}
      ${stat('Approved', r.qa.approved || 0)}
      ${stat('Rejected', r.qa.rejected || 0)}
      ${stat('Approval rate', pct(r.qa.approved || 0, r.qa.total || 0))}
      ${stat('First-time pass rate', pct(r.qa.first_pass, r.qa.verified_items), 'items approved on their first QA attempt')}
      ${r.cycleTime.map((c) => stat(`Avg. days to deploy (${label.category(c.category)})`, c.avg_days ?? '—', `${c.deployed} deployed`))}
    </div>

    <section class="card" style="margin-bottom:16px">
      <div class="card-head"><h2>Status by product</h2></div>
      ${products.length ? html`<div class="table-wrap"><table>
        <thead><tr><th>Product</th>${statuses.map((s) => html`<th class="num">${label.status(s)}</th>`)}<th class="num">Total</th></tr></thead>
        <tbody>${products.map((p) => html`<tr><td><strong>${p}</strong></td>${statuses.map((s) => html`<td class="num">${cell(p, s) || html`<span class="muted">0</span>`}</td>`)}<td class="num"><strong>${productTotal(p)}</strong></td></tr>`)}</tbody>
      </table></div>` : html`<div class="card-body">${emptyState('No items for these filters')}</div>`}
    </section>

    <div class="grid grid-2" style="margin-bottom:16px">
      <section class="card">
        <div class="card-head"><h2>Developer quality</h2></div>
        ${r.developers.length ? html`<div class="table-wrap"><table>
          <thead><tr><th>Developer</th><th class="num">Assigned</th><th class="num">Deployed</th><th class="num">Self-test failures</th><th class="num">QA rejections</th></tr></thead>
          <tbody>${r.developers.map((x) => html`<tr><td>${x.name}</td><td class="num">${x.assigned}</td><td class="num">${x.deployed}</td><td class="num">${x.self_test_failures}</td><td class="num">${x.qa_rejections}</td></tr>`)}</tbody>
        </table></div>` : html`<div class="card-body">${emptyState('No assigned items')}</div>`}
      </section>
      <section class="card">
        <div class="card-head"><h2>Most rejected items</h2></div>
        ${r.mostRejected.length ? html`<div class="table-wrap"><table>
          <thead><tr><th>Item</th><th>Status</th><th class="num">Rejections</th></tr></thead>
          <tbody>${r.mostRejected.map((x) => html`<tr><td><a href="#/items/${x.id}">${x.item_key}</a> ${x.title}<div class="small muted">${x.assigned_name || 'Unassigned'}</div></td><td>${statusBadge(x.status)}</td><td class="num">${x.rejections}</td></tr>`)}</tbody>
        </table></div>` : html`<div class="card-body">${emptyState('No QA rejections', '', 'check')}</div>`}
      </section>
    </div>`);

  const form = view.querySelector('[data-filters]');
  form.addEventListener('change', () => {
    const next = Object.fromEntries([...new FormData(form)].filter(([, v]) => v));
    if (next.period !== 'custom') { delete next.from; delete next.to; }
    if (next.from && next.to && next.from > next.to) [next.from, next.to] = [next.to, next.from];
    location.hash = '#/reports' + qs(next);
  });
}

function rangeText({ from, to }) {
  const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (from && to) return from === to ? `Showing ${fmt(from)}` : `Showing ${fmt(from)} – ${fmt(to)}`;
  return from ? `Showing from ${fmt(from)}` : `Showing up to ${fmt(to)}`;
}

const stat = (text, value, sub) => html`<div class="stat"><span><span class="stat-label">${text}</span><div class="stat-value">${value}</div>${sub ? html`<span class="small muted">${sub}</span>` : ''}</span></div>`;
