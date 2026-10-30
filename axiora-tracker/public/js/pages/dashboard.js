import {
  api, defaultAssignee, defaultProduct, developerOptions, emptyState, field, html, icon, label, optionsFrom, person, priorityBadge, productOptions, qs, state,
  statusBadge, timeAgo, fmtDate,
} from '../lib.js';

const CARDS = [
  ['total', 'Total Items', 'list', '#e8f0fe', '#1d5fe0', {}],
  ['requirements', 'Requirements', 'doc', '#e8f0fe', '#1d4ed8', { category: 'requirement' }],
  ['defects', 'Defects', 'bug', '#fdecec', '#b91c1c', { category: 'defect' }],
  ['new', 'New Items', 'inbox', '#eef1f5', '#475569', { status: 'new' }],
  ['in_development', 'In Development', 'code', '#fff3e0', '#b45309', { status: 'in_development,self_test' }, 'incl. self-test'],
  ['awaiting_qa', 'Awaiting QA', 'clock', '#e3edff', '#1d4ed8', { status: 'ready_for_qa,qa_in_progress' }, 'ready + in progress'],
  ['qa_rejected', 'QA Rejected', 'alert', '#fee2e2', '#b91c1c', { status: 'qa_rejected' }],
  ['qa_approved', 'QA Approved', 'check', '#dcfce7', '#15803d', { status: 'qa_approved' }],
  ['ready_for_production', 'Ready for Production', 'rocket', '#d5f5f0', '#0f766e', { status: 'ready_for_production' }],
  ['deployed', 'Deployed to Production', 'package', '#cdf3df', '#065f46', { status: 'deployed' }],
  ['verified', 'Verified in Production', 'verified', '#d9f2e6', '#14532d', { status: 'verified' }],
];
const FILTERS = ['product', 'category', 'assigned_to', 'from', 'to'];
// Axis labels for the status chart; the tooltip and hidden table carry the full names.
const SHORT_STATUS = {
  new: 'New', assigned: 'Assigned', in_development: 'In Dev', self_test: 'Self-Test', ready_for_qa: 'Ready QA',
  qa_in_progress: 'In QA', qa_rejected: 'Rejected', qa_approved: 'Approved', ready_for_production: 'Ready Prod', deployed: 'Deployed', verified: 'Verified',
};

export async function render(view, { query }) {
  const filters = Object.fromEntries(FILTERS.filter((k) => query[k]).map((k) => [k, query[k]]));
  if (defaultProduct(query)) filters.product = defaultProduct(query);
  if (defaultAssignee(query)) filters.assigned_to = defaultAssignee(query);
  const d = await api('GET', 'api/dashboard' + qs(filters));
  const link = (extra) => (['deployed', 'verified'].includes(extra.status) ? `#/${extra.status}` + qs({ ...filters, ...extra, status: undefined }) : '#/items' + qs({ ...filters, ...extra }));
  const statusKeys = Object.keys(state.meta.statuses);

  view.innerHTML = String(html`
    <div class="page-head">
      <div><h1>Dashboard</h1><div class="sub">Live counts from the tracker. Click any number to see the matching items.</div></div>
    </div>
    <form class="card filters" data-filters style="margin-bottom:16px">
      ${field({ name: 'product', label: 'Product', type: 'select', options: productOptions('All products', true, 'all'), value: filters.product })}
      ${field({ name: 'category', label: 'Type', type: 'select', options: optionsFrom(state.meta.categories, 'All types'), value: filters.category })}
      ${field({ name: 'assigned_to', label: 'Developer', type: 'select', options: developerOptions('All developers', 'all'), value: filters.assigned_to })}
      <div class="field"><label>Created between</label><span class="date-pair">
        <input type="date" name="from" value="${filters.from || ''}" aria-label="From date"><span class="muted">–</span>
        <input type="date" name="to" value="${filters.to || ''}" aria-label="To date"></span></div>
      ${Object.keys(filters).length ? html`<div class="field"><span class="label">&nbsp;</span><a class="btn btn-ghost" href="#/">Clear filters</a></div>` : ''}
    </form>

    <div class="stats">
      ${CARDS.map(([key, text, ic, bg, fg, extra, sub]) => html`
        <a class="stat" href="${link(extra)}">
          <span class="stat-icon" style="background:${bg};color:${fg}">${icon(ic)}</span>
          <span><span class="stat-label">${text}</span><div class="stat-value">${d.cards[key]}</div>${sub ? html`<span class="small muted">${sub}</span>` : ''}</span>
        </a>`)}
    </div>

    <div class="grid grid-2" style="margin-bottom:16px">
      <section class="card">
        <div class="card-head"><h2>Items by status</h2><span class="small muted">${d.cards.total} items</span></div>
        <div class="card-body">${d.cards.total ? columnChart(statusKeys.map((s) => ({ label: label.status(s), short: SHORT_STATUS[s], value: d.byStatus[s] || 0, href: link({ status: s }) }))) : emptyState('No items yet')}</div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Open items by priority</h2><span class="small muted">not yet deployed</span></div>
        <div class="card-body">${barList(Object.keys(state.meta.priorities).map((p) => ({ label: label.priority(p), value: d.openByPriority[p] || 0, href: link({ priority: p, open: 1 }) })))}</div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Items by product</h2></div>
        <div class="card-body">${d.byProduct.length ? barList(d.byProduct.map((p) => ({ label: p.name, value: p.total, href: link({ product: p.id }), tip: `${p.name}: ${p.total} total, ${p.open} open` }))) : emptyState('No items yet')}</div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Developer workload</h2></div>
        <div class="table-wrap">${d.byDeveloper.length ? html`<table>
          <thead><tr><th>Developer</th><th class="num">With dev</th><th class="num">In QA</th><th class="num">Rejected</th><th class="num">Approved</th><th class="num">Deployed</th></tr></thead>
          <tbody>${d.byDeveloper.map((r) => html`<tr>
            <td><a href="${link({ assigned_to: r.id })}">${person(r.name)}</a></td>
            <td class="num">${r.with_developer}</td><td class="num">${r.in_qa}</td><td class="num">${r.rejected}</td><td class="num">${r.approved}</td><td class="num">${r.deployed}</td>
          </tr>`)}</tbody></table>` : html`<div class="card-body">${emptyState('No assigned items')}</div>`}</div>
      </section>
    </div>

    <div class="grid grid-2">
      ${listCard('Awaiting QA', d.awaitingQa, link({ status: 'ready_for_qa,qa_in_progress' }), 'Nothing is waiting for QA.', (i) => statusBadge(i.status))}
      ${listCard(`Blocker, critical & high defects open (${d.urgentDefects.total})`, d.urgentDefects.items, link({ category: 'defect', priority: 'blocker,critical,high', open: 1 }), 'No urgent defects. 🎉', (i) => priorityBadge(i.priority))}
      ${listCard('Recently updated', d.recent, link({}), 'No activity yet.', (i) => html`<span class="small muted nowrap">${timeAgo(i.updated_at)}</span>`)}
      ${listCard(`Overdue (${d.overdue.total})`, d.overdue.items, link({ overdue: 1 }), 'Nothing is overdue. Set a due date on items to track this.', (i) => html`<span class="small nowrap pri-critical">Due ${fmtDate(i.due_date)}</span>`)}
    </div>`);

  const form = view.querySelector('[data-filters]');
  form.addEventListener('change', () => {
    const next = Object.fromEntries([...new FormData(form)].filter(([, v]) => v));
    location.hash = '#/' + qs(next);
  });
}

function columnChart(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return html`
    <div class="cols" role="img" aria-label="Items by status column chart">
      ${rows.map((r) => html`<a class="col" href="${r.href}" data-tip="${r.label}: ${r.value}">
        <span class="val">${r.value}</span>
        <span class="bar" style="height:${(r.value / max) * 100}%"></span>
      </a>`)}
    </div>
    <div class="col-labels" aria-hidden="true">${rows.map((r) => html`<span>${r.short || r.label}</span>`)}</div>
    <table class="sr-only"><tbody>${rows.map((r) => html`<tr><th>${r.label}</th><td>${r.value}</td></tr>`)}</tbody></table>`;
}

function barList(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return html`<div class="hbars">${rows.map((r) => html`
    <a class="hbar" href="${r.href}" data-tip="${r.tip || `${r.label}: ${r.value}`}">
      <span class="name">${r.label}</span>
      <span class="track"><span class="fill" style="width:${(r.value / max) * 85}%"></span><span class="v">${r.value}</span></span>
    </a>`)}</div>`;
}

function listCard(title, items, href, emptyText, right) {
  return html`<section class="card">
    <div class="card-head"><h2>${title}</h2><a class="link" href="${href}">View all</a></div>
    <div class="card-body">${items.length ? html`<ul class="mini-list">${items.map((i) => html`<li>
      <div class="grow"><a class="t" href="#/items/${i.id}">${i.title}</a>
        <span class="k">${i.item_key} · ${i.product_name} · ${i.assigned_name || 'Unassigned'}</span></div>
      ${right(i)}
    </li>`)}</ul>` : emptyState(emptyText, '', 'check')}</div>
  </section>`;
}
