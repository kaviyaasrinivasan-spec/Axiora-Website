import { api, ApiError, can, defaultProductId, developerOptions, field, formPayload, html, optionsFrom, productOptions, showErrors, state, toast } from '../lib.js';

const ENVIRONMENTS = ['Production', 'Staging', 'QA / Test', 'Development', 'Customer site'];

export async function render(view, { params, query, navigate }) {
  const editing = Boolean(params.id);
  // New items default to CARGORA, the main product, when it is configured and active.
  let item = { category: query.category || 'requirement', priority: 'medium', requested_by: state.user.name, product_id: defaultProductId() };
  if (editing) {
    const detail = await api('GET', `api/items/${params.id}`);
    if (!detail.canEdit) {
      view.innerHTML = String(html`<div class="card"><div class="card-body">This item cannot be edited at its current stage. <a href="#/items/${params.id}">Back to item</a></div></div>`);
      return;
    }
    item = detail.item;
  } else if (!can('createItem')) {
    view.innerHTML = String(html`<div class="card"><div class="card-body">Your role cannot create items. Ask an Admin or QA Engineer to raise it.</div></div>`);
    return;
  }

  const moduleOptions = (productId) => {
    const p = state.meta.products.find((x) => String(x.id) === String(productId));
    return (p?.modules || []).filter((m) => m.active).map((m) => html`<option value="${m.name}"></option>`);
  };
  const userNames = state.meta.users.filter((u) => u.active).map((u) => html`<option value="${u.name}"></option>`);

  view.innerHTML = String(html`
    <div class="breadcrumb"><a href="#/items">All Items</a> › ${editing ? html`<a href="#/items/${item.id}">${item.item_key}</a> › Edit` : 'New Item'}</div>
    <div class="page-head"><div><h1>${editing ? `Edit ${item.item_key}` : 'Create New Item'}</h1>
      <div class="sub">Fields marked <span class="req">*</span> are required.</div></div></div>
    <form class="card" novalidate data-form>
      <div class="card-body">
        <div class="form-grid">
          ${editing ? html`<div class="field full"><span class="label">Item type</span><div>${item.category === 'defect' ? 'Defect' : 'Requirement'}</div></div>`
            : field({ name: 'category', label: 'Item type', type: 'radio', required: true, value: item.category, full: true,
              options: [{ value: 'requirement', label: 'Requirement — a new feature or change' }, { value: 'defect', label: 'Defect — something is broken' }] })}
          ${field({ name: 'title', label: 'Title', required: true, value: item.title, full: true, placeholder: 'Short summary, e.g. "Add filter in New Jobs"', attrs: 'maxlength="200"' })}
          ${field({ name: 'product_id', label: 'Product', type: 'select', required: true, value: item.product_id, options: productOptions('Select product') })}
          ${field({ name: 'module', label: 'Module / Feature', value: item.module, list: 'module-list', placeholder: 'e.g. ERP Integration' })}
          ${field({ name: 'priority', label: 'Priority', type: 'select', required: true, value: item.priority, options: optionsFrom(state.meta.priorities) })}
          ${editing ? '' : field({ name: 'planning_status', label: 'Planning Status', type: 'select', value: 'backlog', options: optionsFrom(state.meta.planningStatuses),
            help: 'Separate from the workflow status. Defaults to Backlog.' })}
          ${field({ name: 'requested_by', label: 'Requested By', required: true, value: item.requested_by, list: 'user-list', help: 'Who asked for this? Can be a customer or colleague.' })}
          ${!editing && can('assign') ? field({ name: 'assigned_to', label: 'Assign to developer', type: 'select', options: developerOptions('Assign later'), help: 'Optional. You can assign it later.',
            value: state.user.role === 'developer' ? state.user.id : '' }) : ''}
          ${field({ name: 'due_date', label: 'Due date', type: 'date', value: item.due_date, help: 'Optional. Used for overdue tracking.' })}
          ${field({ name: 'description', label: 'Description', type: 'textarea', required: true, value: item.description, full: true, rows: 4, placeholder: 'Describe the request or problem in detail.' })}
        </div>

        <div class="form-grid" data-section="defect" style="margin-top:14px">
          <div class="section-title full">Defect details</div>
          ${field({ name: 'steps_to_reproduce', label: 'Steps to reproduce', type: 'textarea', required: true, value: item.steps_to_reproduce, full: true, placeholder: '1. Go to …\n2. Click …\n3. Observe …' })}
          ${field({ name: 'expected_behaviour', label: 'Expected behaviour', type: 'textarea', required: true, value: item.expected_behaviour, rows: 3 })}
          ${field({ name: 'actual_behaviour', label: 'Actual behaviour', type: 'textarea', required: true, value: item.actual_behaviour, rows: 3 })}
          ${field({ name: 'environment', label: 'Environment', value: item.environment, list: 'env-list', placeholder: 'Where did it happen?' })}
        </div>

        <div class="form-grid" data-section="requirement" style="margin-top:14px">
          <div class="section-title full">Requirement details</div>
          ${field({ name: 'business_requirement', label: 'Business requirement', type: 'textarea', value: item.business_requirement, full: true, rows: 3, placeholder: 'Why is this needed? Who benefits?' })}
          ${field({ name: 'expected_behaviour', label: 'Expected behaviour', type: 'textarea', value: item.expected_behaviour, rows: 3 })}
          ${field({ name: 'acceptance_criteria', label: 'Acceptance criteria', type: 'textarea', required: true, value: item.acceptance_criteria, rows: 3, placeholder: 'How will QA know it is done? One point per line.' })}
        </div>

        ${editing ? '' : html`<div class="form-grid" style="margin-top:14px">${field({ name: 'files', label: 'Attachments', type: 'file', full: true })}</div>`}

        <datalist id="module-list">${moduleOptions(item.product_id)}</datalist>
        <datalist id="user-list">${userNames}</datalist>
        <datalist id="env-list">${ENVIRONMENTS.map((e) => html`<option value="${e}"></option>`)}</datalist>

        <div class="form-actions">
          <a class="btn" href="${editing ? `#/items/${item.id}` : '#/items'}">Cancel</a>
          <button class="btn btn-primary" type="submit">${editing ? 'Save Changes' : 'Create Item'}</button>
        </div>
      </div>
    </form>`);

  const form = view.querySelector('[data-form]');
  const syncCategory = () => {
    const cat = editing ? item.category : form.querySelector('[name=category]:checked')?.value;
    for (const sec of form.querySelectorAll('[data-section]')) {
      const on = sec.dataset.section === cat;
      sec.classList.toggle('hidden', !on);
      // Disabled controls are left out of the submitted form, so only the visible section's fields are sent.
      sec.querySelectorAll('input, textarea, select').forEach((el) => { el.disabled = !on; });
    }
  };
  syncCategory();
  form.addEventListener('change', (e) => {
    if (e.target.name === 'category') syncCategory();
    if (e.target.name === 'product_id') form.querySelector('#module-list').innerHTML = String(html`${moduleOptions(e.target.value)}`);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      if (editing) {
        const body = formPayload(form);
        await api('PATCH', `api/items/${item.id}`, body);
        toast('Changes saved.', 'success');
        navigate(`/items/${item.id}`);
      } else {
        const { id } = await api('POST', 'api/items', formPayload(form));
        toast('Item created.', 'success');
        navigate(`/items/${id}`);
      }
    } catch (err) {
      btn.disabled = false;
      if (err instanceof ApiError) showErrors(form, err, form.querySelector('.card-body'));
      else throw err;
    }
  });
}
