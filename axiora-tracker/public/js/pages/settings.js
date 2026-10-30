import { api, ApiError, field, guard, html, icon, label, openDialog, raw, state, toast } from '../lib.js';
import { refreshMeta } from '../app.js';

export async function render(view) {
  let { products } = await api('GET', 'api/products');
  let { permissions } = await api('GET', 'api/workflow-permissions');
  const roles = Object.keys(state.meta.roles);
  const draw = () => {
    view.innerHTML = String(html`
      <div class="page-head">
        <div><h1>Settings</h1><div class="sub">Products and modules that items can be raised against.</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-do="add-product">${icon('plus')} Add Product</button></div>
      </div>
      <div class="grid grid-2">${products.map((p) => html`
        <section class="card">
          <div class="card-head">
            <h2>${p.name} ${p.active ? '' : html`<span class="badge st-new">Inactive</span>`}</h2>
            <span class="row">
              <button class="btn btn-sm" data-do="edit-product" data-id="${p.id}">Edit</button>
              <button class="btn btn-sm" data-do="add-module" data-id="${p.id}">${icon('plus')} Module</button>
            </span>
          </div>
          <div class="card-body">${p.modules.length ? html`<ul class="mini-list">${p.modules.map((m) => html`<li>
            <span class="grow">${m.name} ${m.active ? '' : html`<span class="small muted">(inactive)</span>`}</span>
            <button class="btn btn-sm btn-ghost" data-do="edit-module" data-id="${m.id}" data-product="${p.id}">Edit</button>
          </li>`)}</ul>` : html`<p class="muted small">No modules yet. Modules are suggestions on the item form; people can still type their own.</p>`}</div>
        </section>`)}</div>
      <div class="card" style="margin-top:16px"><div class="card-body small muted">
        Priorities (Blocker, Critical, High, Medium, Low) and the workflow statuses are fixed so that reports stay comparable over time.
        Deactivating a product hides it from new items but keeps its history.
      </div></div>
      ${permissionsCard()}`);
  };
  function permissionsCard() {
    const groups = [...new Set(permissions.map((x) => x.group))];
    const same = (a, b) => [...a].sort().join() === [...b].sort().join();
    return html`<section class="card" style="margin-top:16px" data-perms>
      <div class="card-head">
        <h2>Developer &amp; QA pickers</h2>
        <span class="row">
          <button class="btn btn-sm" data-do="reset-perms">Restore defaults</button>
          <button class="btn btn-sm btn-primary" data-do="save-perms">Save</button>
        </span>
      </div>
      <div class="card-body small muted" style="padding-bottom:0">Every signed-in user can move items through every workflow step, whatever their role or assignment.
        These settings only choose which roles appear in the Developer and QA engineer pickers.</div>
      <div class="table-wrap"><table class="perm-table">
        <thead><tr><th>Picker</th>${roles.map((r) => html`<th class="perm-role">${label.role(r)}</th>`)}</tr></thead>
        <tbody>${groups.map((g) => html`
          <tr class="perm-group"><td colspan="${roles.length + 1}">${g}</td></tr>
          ${permissions.filter((x) => x.group === g).map((x) => html`<tr data-perm="${x.key}">
            <td><strong>${x.label}</strong>${same(x.roles, x.defaultRoles) ? '' : html` <span class="badge plain st-in_development">Changed</span>`}
              ${x.note ? html`<div class="small muted">${x.note}</div>` : ''}<div class="field-error small" data-perm-error="${x.key}"></div></td>
            ${roles.map((r) => html`<td class="perm-role"><input type="checkbox" aria-label="${label.role(r)}: ${x.label}" data-perm-key="${x.key}" value="${r}"
              ${x.roles.includes(r) ? raw('checked') : ''}></td>`)}
          </tr>`)}`)}
        </tbody>
      </table></div>
    </section>`;
  }

  const collectPermissions = () => Object.fromEntries(permissions.map((x) => [x.key,
    [...view.querySelectorAll(`[data-perm-key="${x.key}"]:checked`)].map((c) => c.value)]));
  const savePermissions = async (payload, message) => {
    view.querySelectorAll('[data-perm-error]').forEach((el) => { el.textContent = ''; });
    try {
      ({ permissions } = await api('PUT', 'api/workflow-permissions', { permissions: payload }));
      draw();
      await refreshMeta();
      toast(message, 'success');
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      for (const [key, msg] of Object.entries(err.fields || {})) {
        const el = view.querySelector(`[data-perm-error="${key}"]`);
        if (el) el.textContent = msg;
      }
      toast(err.message, 'error');
    }
  };

  draw();

  const save = async (promise, msg) => {
    const res = await promise;
    if (res?.products) { products = res.products; draw(); await refreshMeta(); toast(msg, 'success'); }
  };
  const activeField = (active) => field({ name: 'active', label: 'Status', type: 'select', value: active ? '1' : '0', options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }] });

  view.addEventListener('click', guard(async (e) => {
    const el = e.target.closest('[data-do]');
    if (!el) return;
    const p = products.find((x) => String(x.id) === (el.dataset.product || el.dataset.id));
    switch (el.dataset.do) {
      case 'save-perms':
        return savePermissions(collectPermissions(), 'Picker settings saved.');
      case 'reset-perms': {
        const ok = await openDialog({
          title: 'Restore default picker settings?',
          body: html`<p>Both pickers go back to their default roles. This is recorded in the audit log.</p>`,
          submitLabel: 'Restore defaults',
          onSubmit: () => true,
        });
        if (ok) return savePermissions(Object.fromEntries(permissions.map((x) => [x.key, x.defaultRoles])), 'Default picker settings restored.');
        return undefined;
      }
      case 'add-product':
        return save(openDialog({
          title: 'Add Product', body: field({ name: 'name', label: 'Product name', required: true }), submitLabel: 'Add',
          onSubmit: (form) => api('POST', 'api/products', { name: form.name.value }),
        }), 'Product added.');
      case 'edit-product':
        return save(openDialog({
          title: `Edit ${p.name}`,
          body: html`<div class="stack">${field({ name: 'name', label: 'Product name', required: true, value: p.name })}${activeField(p.active)}</div>`,
          onSubmit: (form) => api('PATCH', `api/products/${p.id}`, Object.fromEntries(new FormData(form))),
        }), 'Product updated.');
      case 'add-module':
        return save(openDialog({
          title: `Add module to ${p.name}`, body: field({ name: 'name', label: 'Module name', required: true }), submitLabel: 'Add',
          onSubmit: (form) => api('POST', 'api/modules', { product_id: p.id, name: form.name.value }),
        }), 'Module added.');
      case 'edit-module': {
        const m = p.modules.find((x) => String(x.id) === el.dataset.id);
        return save(openDialog({
          title: `Edit ${m.name}`,
          body: html`<div class="stack">${field({ name: 'name', label: 'Module name', required: true, value: m.name })}${activeField(m.active)}</div>`,
          onSubmit: (form) => api('PATCH', `api/modules/${m.id}`, Object.fromEntries(new FormData(form))),
        }), 'Module updated.');
      }
      default:
        return undefined;
    }
  }));
}
