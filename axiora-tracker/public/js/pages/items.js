import {
  api, can, categoryBadge, defaultAssignee, defaultProduct, developerOptions, qaOptions, emptyState, fmtDate, guard, label, html, icon, optionsFrom, person, priorityBadge, productOptions,
  qs, state, statusBadge, toast,
} from '../lib.js';

const PRESETS = {
  // Items in production are listed only under Deployed to Production / Verified in Production.
  all: { title: 'All Items', sub: 'Every requirement and defect that is not yet in production.', fixed: { open: 1 }, hideStatuses: ['deployed', 'verified'] },
  requirements: { title: 'Requirements', sub: 'New features and changes requested, not yet in production.', fixed: { category: 'requirement', open: 1 }, hideStatuses: ['deployed', 'verified'] },
  defects: { title: 'Defects', sub: 'Problems reported in the products, not yet fixed in production.', fixed: { category: 'defect', open: 1 }, hideStatuses: ['deployed', 'verified'] },
  my: { title: 'My Work', sub: 'Items waiting for you to act.', fixed: { view: 'my' }, empty: 'Nothing needs your attention right now.' },
  qa: { title: 'QA Queue', sub: 'Changes submitted for verification and verifications in progress.', fixed: { view: 'qa' }, empty: 'No items are waiting for QA.' },
  production: { title: 'Production Queue', sub: 'QA-approved changes waiting to be moved to production.', fixed: { view: 'production' }, empty: 'No approved items are waiting for production.' },
  verified: { title: 'Verified in Production', sub: 'Changes confirmed working in production.', fixed: { status: 'verified' }, empty: 'No items have been verified in production yet.' },
  deployed: { title: 'Deployed to Production', sub: 'Requirements and defects that are live in production.', fixed: { status: 'deployed' }, empty: 'Nothing has been moved to production yet.' },
};
const FILTER_KEYS = ['q', 'product', 'category', 'status', 'planning', 'priority', 'assigned_to', 'qa', 'requested_by', 'from', 'to', 'overdue', 'open', 'sort', 'page'];

// Each list page remembers its last filters (per user, per page) in the browser, so they survive
// opening an item, the breadcrumb or sidebar links, other pages and a refresh. Explicit filters in
// the address (e.g. from a dashboard link) take priority and become the remembered set.
const savedFilters = (preset) => {
  const key = `axt.filters.${state.user.id}.${preset}`;
  return {
    get() { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
    set(value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
    clear() { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } },
  };
};

export async function render(view, { params, query, path }) {
  const preset = PRESETS[params.preset] || PRESETS.all;
  const memory = savedFilters(params.preset || 'all');
  if (!Object.keys(query).length && memory.get()) {
    query = memory.get();
    history.replaceState(null, '', '#' + path + qs(query));
  }
  const filters = Object.fromEntries(FILTER_KEYS.filter((k) => query[k]).map((k) => [k, query[k]]));
  if (defaultProduct(query)) filters.product = defaultProduct(query);
  if (defaultAssignee(query)) filters.assigned_to = defaultAssignee(query);
  // On the QA Queue a QA engineer starts on their own items plus unassigned ones they can pick up.
  if (params.preset === 'qa' && !query.qa && state.user.role === 'qa') filters.qa = 'mine_open';
  const hidden = preset.hideStatuses || [];
  if (hidden.includes(filters.status)) delete filters.status;
  const statusOptions = [
    { value: '', label: 'All statuses' },
    ...Object.entries(state.meta.statuses).filter(([value]) => !hidden.includes(value)).map(([value, l]) => ({ value, label: l })),
  ];
  // Grouped status filters from dashboard links show up as an extra option.
  if (filters.status && !state.meta.statuses[filters.status]) statusOptions.push({ value: filters.status, label: 'Selected statuses' });
  const priorityOptions = [...optionsFrom(state.meta.priorities, 'All priorities')];
  if (filters.priority && !state.meta.priorities[filters.priority]) priorityOptions.push({ value: filters.priority, label: 'Selected priorities' });

  const sel = (name, options, value) => html`<select name="${name}" aria-label="${name}">${options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value ?? '') ? 'selected' : ''}>${o.label}</option>`)}</select>`;
  view.innerHTML = String(html`
    <div class="page-head">
      <div><h1>${preset.title}</h1><div class="sub">${preset.sub}</div></div>
      <div class="page-actions">
        <a class="btn" data-export href="#">${icon('download')} Export CSV</a>
        ${can('createItem') ? html`<a class="btn btn-primary" href="#/items/new${preset.fixed.category ? `?category=${preset.fixed.category}` : ''}">${icon('plus')} New Item</a>` : ''}
      </div>
    </div>
    <div class="card">
      <form class="filters" data-filters>
        <input type="search" name="q" placeholder="Search by ID, title or keyword…" value="${filters.q || ''}" aria-label="Search">
        ${sel('product', productOptions('All products', true, 'all'), filters.product)}
        ${preset.fixed.category ? '' : sel('category', optionsFrom(state.meta.categories, 'All types'), filters.category)}
        ${preset.fixed.status ? '' : sel('status', statusOptions, filters.status)}
        ${sel('planning', optionsFrom(state.meta.planningStatuses, 'All planning'), filters.planning)}
        ${sel('priority', priorityOptions, filters.priority)}
        ${sel('assigned_to', [...developerOptions('All developers', 'all'), { value: 'none', label: 'Unassigned' }], filters.assigned_to)}
        ${params.preset === 'qa' ? sel('qa', [...qaOptions('All QA engineers', 'all'), { value: 'mine_open', label: 'Mine + unassigned' },
          { value: 'none', label: 'No QA assigned' }], filters.qa) : ''}
        ${sel('requested_by', [{ value: '', label: 'All requesters' }, ...state.meta.requesters.map((r) => ({ value: r, label: r }))], filters.requested_by)}
        <span class="date-pair"><input type="date" name="from" value="${filters.from || ''}" aria-label="Created from" title="Created from">
          <span class="muted">–</span><input type="date" name="to" value="${filters.to || ''}" aria-label="Created to" title="Created to"></span>
        ${sel('sort', [{ value: '', label: 'Recently updated' }, { value: 'created', label: 'Newest first' }, { value: 'priority', label: 'Priority' }, { value: 'due', label: 'Due date' }], filters.sort)}
        ${['overdue', 'open'].filter((k) => filters[k]).map((k) => html`<input type="hidden" name="${k}" value="${filters[k]}">`)}
        ${Object.keys(filters).length ? html`<a class="btn btn-ghost btn-sm" href="#${path}" data-reset>Reset</a>` : ''}
      </form>
      <div data-results><div class="loading">Loading…</div></div>
    </div>`);

  const form = view.querySelector('[data-filters]');
  const results = view.querySelector('[data-results]');
  let current = { ...filters };

  const load = async () => {
    const data = await api('GET', 'api/items' + qs({ ...current, ...preset.fixed, pageSize: 25 }));
    memory.set(current);
    // Only rewrite the address if the user is still on this list (they may have opened an item meanwhile).
    if (location.hash === '#' + path || location.hash.startsWith(`#${path}?`)) history.replaceState(null, '', '#' + path + qs(current));
    view.querySelector('[data-export]').href = 'api/items/export.csv' + qs({ ...current, ...preset.fixed });
    results.innerHTML = String(table(data, preset, params.preset === 'qa'));
  };

  let timer;
  const apply = () => {
    current = Object.fromEntries([...new FormData(form)].filter(([, v]) => v));
    load();
  };
  form.addEventListener('change', apply);
  // Reset forgets the remembered filters and goes back to the page's defaults.
  form.addEventListener('click', (e) => {
    if (!e.target.closest('[data-reset]')) return;
    e.preventDefault();
    memory.clear();
    location.hash = '#' + path;
  });
  form.q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(apply, 300); });
  form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
  results.addEventListener('click', (e) => {
    const pg = e.target.closest('[data-page]');
    if (pg) { current.page = pg.dataset.page; load(); return; }
    const tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('a, select')) location.hash = tr.dataset.href;
  });
  // Priority can be changed right in the list by people allowed to edit the item; it is saved like
  // an edit on the item page and appears in the item's History.
  results.addEventListener('change', guard(async (e) => {
    const sel = e.target.closest('select[data-priority-id]');
    if (!sel) return;
    const previous = sel.dataset.current;
    sel.disabled = true;
    try {
      await api('PATCH', `api/items/${sel.dataset.priorityId}`, { priority: sel.value });
      sel.dataset.current = sel.value;
      sel.className = `pri-select pri-inline pri-${sel.value}`;
      toast(`${sel.dataset.key}: priority set to ${label.priority(sel.value)}.`, 'success');
    } catch (err) {
      sel.value = previous;
      throw err;
    } finally {
      sel.disabled = false;
    }
  }));
  // Planning Status can be changed right in the list. It is only a label: the workflow is untouched.
  results.addEventListener('change', guard(async (e) => {
    const sel = e.target.closest('select[data-planning-id]');
    if (!sel) return;
    const previous = sel.dataset.current;
    sel.disabled = true;
    try {
      await api('POST', `api/items/${sel.dataset.planningId}/planning`, { planning_status: sel.value });
      sel.dataset.current = sel.value;
      sel.className = `plan-select plan-inline plan-${sel.value}`;
      toast(`${sel.dataset.key}: planning status set to ${label.planning(sel.value)}.`, 'success');
    } catch (err) {
      sel.value = previous;
      throw err;
    } finally {
      sel.disabled = false;
    }
  }));
  await load();
}

function table(data, preset, showQa) {
  if (!data.items.length) {
    return html`<div class="card-body">${emptyState(preset.empty || 'No items match these filters.', 'Try clearing a filter or searching for something else.', 'search')}</div>`;
  }
  return html`
    <div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Product</th><th>Priority</th><th>Status</th><th>Planning</th><th>Assigned To</th>${showQa ? html`<th>QA</th>` : ''}<th>Updated</th></tr></thead>
      <tbody>${data.items.map((i) => html`<tr class="clickable" data-href="#/items/${i.id}">
        <td class="key"><a href="#/items/${i.id}">${i.item_key}</a></td>
        <td class="title-cell">${i.title}${i.due_date && !['deployed', 'verified'].includes(i.status) ? html`<div class="small muted">Due ${fmtDate(i.due_date)}</div>` : ''}</td>
        <td>${categoryBadge(i.category)}</td>
        <td class="nowrap">${i.product_name}${i.module ? html`<div class="small muted">${i.module}</div>` : ''}</td>
        <td>${i.can_edit ? html`<select class="pri-select pri-inline pri-${i.priority}" data-priority-id="${i.id}" data-key="${i.item_key}"
          data-current="${i.priority}" aria-label="Priority for ${i.item_key}">
          ${Object.entries(state.meta.priorities).map(([v, l]) => html`<option value="${v}" ${v === i.priority ? 'selected' : ''}>${l}</option>`)}
        </select>` : priorityBadge(i.priority)}</td>
        <td>${statusBadge(i.status)}</td>
        <td><select class="plan-select plan-inline plan-${i.planning_status}" data-planning-id="${i.id}" data-key="${i.item_key}"
          data-current="${i.planning_status}" aria-label="Planning status for ${i.item_key}">
          ${Object.entries(state.meta.planningStatuses).map(([v, l]) => html`<option value="${v}" ${v === i.planning_status ? 'selected' : ''}>${l}</option>`)}
        </select></td>
        <td>${person(i.assigned_name)}</td>
        ${showQa ? html`<td>${i.qa_name ? person(i.qa_name) : html`<span class="muted">Not assigned</span>`}</td>` : ''}
        <td class="nowrap small">${fmtDate(i.updated_at)}</td>
      </tr>`)}</tbody>
    </table></div>
    <div class="pager">
      <span class="small muted">Showing ${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total}</span>
      <span class="row">
        <button class="btn btn-sm" type="button" data-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>Previous</button>
        <span class="small">Page ${data.page} of ${data.pages}</span>
        <button class="btn btn-sm" type="button" data-page="${data.page + 1}" ${data.page >= data.pages ? 'disabled' : ''}>Next</button>
      </span>
    </div>`;
}
