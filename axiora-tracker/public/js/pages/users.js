import { api, fmtDate, field, guard, html, icon, label, openDialog, optionsFrom, person, state, toast } from '../lib.js';
import { refreshMeta } from '../app.js';

export async function render(view) {
  let { users } = await api('GET', 'api/users');
  const draw = () => {
    view.innerHTML = String(html`
      <div class="page-head">
        <div><h1>User Management</h1><div class="sub">Add team members and control what each role can do.</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-new>${icon('plus')} Add User</button></div>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th class="num">Open items</th><th>Added</th><th></th></tr></thead>
        <tbody>${users.map((u) => html`<tr>
          <td>${person(u.name)}</td><td>${u.email}</td><td>${label.role(u.role)}</td>
          <td>${u.active ? html`<span class="badge st-qa_approved">Active</span>` : html`<span class="badge st-new">Inactive</span>`}</td>
          <td class="num">${u.open_items}</td><td class="nowrap">${fmtDate(u.created_at)}</td>
          <td><button class="btn btn-sm" data-edit="${u.id}">Edit</button></td>
        </tr>`)}</tbody>
      </table></div></div>
      <div class="card" style="margin-top:16px"><div class="card-body">
        <h2 style="margin-bottom:8px">What each role can do</h2>
        <ul class="small" style="margin:0;padding-left:18px">
          <li><strong>Admin / Product Owner</strong> — create, assign and delete items, manage users, products and settings, perform QA (on changes they did not build) and move items to production.</li>
          <li><strong>Developer</strong> — raise requirements and defects, assign developers, work on assigned items, write implementation notes, record self-tests, submit to QA, fix rejected items.</li>
          <li><strong>QA Engineer</strong> — raise items, assign developers, verify submitted changes, approve or reject with evidence.</li>
          <li><strong>Release Manager</strong> — add approved items to the production queue and move them to production.</li>
          <li class="muted">These describe each role's usual job. Anyone signed in can move an item through every workflow step;
            <a href="#/settings">Settings</a> only decides who appears in the Developer and QA engineer pickers.</li>
        </ul>
      </div></div>`);
  };
  draw();

  const roleOptions = optionsFrom(state.meta.roles);
  view.addEventListener('click', guard(async (e) => {
    if (e.target.closest('[data-new]')) {
      const res = await openDialog({
        title: 'Add User',
        body: html`<div class="stack">
          ${field({ name: 'name', label: 'Full name', required: true })}
          ${field({ name: 'email', label: 'Email', type: 'email', required: true })}
          ${field({ name: 'role', label: 'Role', type: 'select', required: true, options: roleOptions, value: 'developer' })}
          ${field({ name: 'password', label: 'Temporary password', type: 'password', required: true, help: 'At least 10 characters. Ask the user to change it after signing in.' })}
        </div>`,
        submitLabel: 'Add User',
        onSubmit: async (form) => {
          await api('POST', 'api/users', Object.fromEntries(new FormData(form)));
          return api('GET', 'api/users');
        },
      });
      if (res?.users) { users = res.users; draw(); await refreshMeta(); toast('User added.', 'success'); }
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      const u = users.find((x) => String(x.id) === edit.dataset.edit);
      const res = await openDialog({
        title: `Edit ${u.name}`,
        body: html`<div class="stack">
          ${field({ name: 'name', label: 'Full name', required: true, value: u.name })}
          ${field({ name: 'email', label: 'Email (used to sign in)', type: 'email', required: true, value: u.email })}
          ${field({ name: 'role', label: 'Role', type: 'select', required: true, options: roleOptions, value: u.role })}
          ${field({ name: 'active', label: 'Status', type: 'select', options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive (cannot sign in)' }], value: u.active ? '1' : '0' })}
          ${field({ name: 'password', label: 'Reset password', type: 'password', help: 'Leave blank to keep the current password. Changing email, role, status or password signs the user out.' })}
        </div>`,
        onSubmit: (form) => api('PATCH', `api/users/${u.id}`, Object.fromEntries(new FormData(form))),
      });
      if (res?.users) { users = res.users; draw(); await refreshMeta(); toast('User updated.', 'success'); }
    }
  }));
}
