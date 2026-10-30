import {
  api, ApiError, categoryBadge, developerOptions, qaOptions, emptyState, field, fileList, fmtDate, fmtDateTime, formPayload,
  guard, html, icon, initials, label, openDialog, person, planningBadge, priorityBadge, showErrors, state, statusBadge, todayLocal, toast,
} from '../lib.js';

const STEPS = [
  ['new', 'New'], ['assigned', 'Assigned'], ['in_development', 'In Development'], ['self_test', 'Self-Test'],
  ['ready_for_qa', 'Ready for QA'], ['qa_in_progress', 'QA In Progress'], ['qa_result', 'QA Approved / Rejected'],
  ['ready_for_production', 'Ready for Production'], ['deployed', 'Deployed to Production'], ['verified', 'Verified in Production'],
];
const STEP_INDEX = { qa_rejected: 6, qa_approved: 6 };
STEPS.forEach(([k], i) => { STEP_INDEX[k] ??= i; });

const TABS = [
  ['details', 'Details'], ['development', 'Development'], ['self_test', 'Self-Test'], ['qa', 'QA Verification'],
  ['production', 'Production'], ['comments', 'Comments'], ['history', 'History'],
];

// Button order and styling for workflow actions in the side panel.
const ACTION_BUTTONS = [
  ['assign', 'btn-primary', 'user'], ['start_development', 'btn-primary', 'play'], ['start_fix', 'btn-primary', 'play'],
  ['start_self_test', 'btn-primary', 'check'], ['record_self_test', 'btn-primary', 'check'], ['submit_to_qa', 'btn-primary', 'shield'],
  ['assign_qa', '', 'shield'], ['start_qa', 'btn-primary', 'play'], ['qa_approve', 'btn-success', 'check'], ['qa_reject', 'btn-danger', 'x'],
  ['queue_for_production', 'btn-primary', 'rocket'], ['move_to_production', 'btn-primary', 'rocket'], ['verify_in_production', 'btn-success', 'verified'], ['return_for_investigation', '', 'undo'],
];

export async function render(view, { params, query }) {
  let d = await api('GET', `api/items/${params.id}`);
  let tab = TABS.some(([k]) => k === query.tab) ? query.tab : 'details';

  const draw = () => {
    view.innerHTML = String(page(d, tab));
  };
  const refresh = (next) => { d = next; draw(); };
  draw();

  const run = (name) => runAction(name, d).then((next) => { if (next) refresh(next); });

  view.addEventListener('click', guard(async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      e.preventDefault();
      tab = t.dataset.tab;
      history.replaceState(null, '', `#/items/${d.item.id}?tab=${tab}`);
      draw();
      return;
    }
    const a = e.target.closest('[data-action]');
    if (a) await run(a.dataset.action);
    if (e.target.closest('[data-delete]')) {
      const done = await openDialog({
        title: `Delete ${d.item.item_key}?`,
        body: html`<p><strong>${d.item.title}</strong></p>
          <p class="muted">This permanently deletes the ${label.category(d.item.category).toLowerCase()} with its self-test results,
          QA verifications, comments, attachments and history. It cannot be undone.</p>`,
        submitLabel: 'Delete permanently',
        submitClass: 'btn-danger',
        onSubmit: () => api('DELETE', `api/items/${d.item.id}`),
      });
      if (done && typeof done === 'object') {
        toast(`${d.item.item_key} deleted.`, 'success');
        location.hash = '#/items';
      }
    }
  }));

  // Planning Status is a label only: it is saved on its own and never changes the workflow.
  view.addEventListener('change', guard(async (e) => {
    const sel = e.target.closest('[data-planning]');
    if (!sel) return;
    sel.disabled = true;
    try {
      refresh(await api('POST', `api/items/${d.item.id}/planning`, { planning_status: sel.value }));
      toast(`Planning status set to ${label.planning(sel.value)}.`, 'success');
    } catch (err) {
      sel.value = d.item.planning_status;
      sel.disabled = false;
      throw err;
    }
  }));

  view.addEventListener('submit', guard(async (e) => {
    const form = e.target;
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    try {
      if (form.matches('[data-comment]')) {
        refresh(await api('POST', `api/items/${d.item.id}/comments`, formPayload(form)));
        toast('Comment added.', 'success');
      } else if (form.matches('[data-upload]')) {
        refresh(await api('POST', `api/items/${d.item.id}/attachments`, formPayload(form)));
        toast('Files uploaded.', 'success');
      } else if (form.matches('[data-notes]')) {
        refresh(await api('POST', `api/items/${d.item.id}/actions/save_notes`, formPayload(form)));
        toast('Implementation notes saved.', 'success');
      }
    } catch (err) {
      if (btn) btn.disabled = false;
      if (err instanceof ApiError) showErrors(form, err);
      else throw err;
    }
  }));
}

// ---------- Page ----------
function page(d, tab) {
  const i = d.item;
  return html`
    <div class="breadcrumb">${i.status === 'deployed' ? html`<a href="#/deployed">Deployed to Production</a>` : i.status === 'verified' ? html`<a href="#/verified">Verified in Production</a>` : html`<a href="#/items">All Items</a>`} › ${i.item_key}</div>
    <div class="page-head">
      <div>
        <div class="item-title"><span class="key">${i.item_key}</span><h1>${i.title}</h1>${categoryBadge(i.category)}${statusBadge(i.status)}</div>
      </div>
      <div class="page-actions">
        ${d.canEdit ? html`<a class="btn" href="#/items/${i.id}/edit">${icon('edit')} Edit</a>` : ''}
        ${d.canDelete ? html`<button class="btn btn-danger" data-delete>${icon('x')} Delete</button>` : ''}
      </div>
    </div>

    <div class="detail-layout">
      <div class="stack">
        <section class="card"><div class="card-body meta-grid">
          ${meta('Product', i.product_name)}
          ${meta('Priority', priorityBadge(i.priority))}
          ${meta('Planning Status', html`<select class="plan-select" data-planning aria-label="Planning status">
            ${Object.entries(state.meta.planningStatuses).map(([v, l]) => html`<option value="${v}" ${v === i.planning_status ? 'selected' : ''}>${l}</option>`)}
          </select>`)}
          ${meta('Module / Feature', i.module || '—')}
          ${meta('Assigned To', person(i.assigned_name))}
          ${i.qa_by || ['ready_for_qa', 'qa_in_progress'].includes(i.status) ? meta('QA Engineer', i.qa_by_name ? person(i.qa_by_name) : html`<span class="muted">Not assigned</span>`) : ''}
          ${meta('Requested By', i.requested_by)}
          ${meta('Created By', i.created_by_name)}
          ${meta('Created Date', fmtDate(i.created_at))}
          ${meta('Last Updated', fmtDateTime(i.updated_at))}
          ${i.due_date ? meta('Due Date', html`<span class="${i.due_date < todayLocal() && !['deployed', 'verified'].includes(i.status) ? 'pri-critical' : ''}">${fmtDate(i.due_date)}</span>`) : ''}
        </div></section>

        <section class="card">
          <div class="tabs" role="tablist">${TABS.map(([k, text]) => html`<button class="tab ${k === tab ? 'active' : ''}" role="tab" aria-selected="${k === tab}" data-tab="${k}">${text}${tabCount(d, k)}</button>`)}</div>
          <div class="tab-panel">${TAB_RENDER[tab](d)}</div>
        </section>
      </div>

      <aside class="stack">
        <section class="card">
          <div class="card-head"><h2>Workflow</h2>${statusBadge(i.status)}</div>
          <div class="card-body">${actionPanel(d)}</div>
        </section>
        <section class="card">
          <div class="card-head"><h2>Progress</h2>${i.dev_cycle > 1 ? html`<span class="small muted">Attempt ${i.dev_cycle}</span>` : ''}</div>
          <div class="card-body">${stepper(d)}</div>
        </section>
      </aside>
    </div>`;
}

const meta = (k, v) => html`<div><div class="label">${k}</div><div class="value">${v}</div></div>`;

function tabCount(d, k) {
  const n = { self_test: d.selfTests.length, qa: d.verifications.length, comments: d.comments.length }[k];
  return n ? html`<span class="n">${n}</span>` : '';
}

function actionPanel(d) {
  const i = d.item;
  const buttons = ACTION_BUTTONS.filter(([a]) => d.actions.includes(a));
  const parts = [];
  for (const h of d.hints) parts.push(html`<div class="hint">${h}</div>`);
  if (buttons.length) {
    parts.push(html`<div class="action-list">
      ${buttons.map(([a, cls, ic]) => html`<button class="btn ${cls} btn-block" data-action="${a}">${icon(ic)} ${state.meta.actions[a]}</button>`)}
    </div>`);
  } else if (!d.hints.length) {
    parts.push(html`<p class="muted small">${waitingFor(i)}</p>`);
  }
  return html`<div class="stack" style="gap:10px">${parts}</div>`;
}

function waitingFor(i) {
  return {
    new: 'Waiting for an admin to assign a developer.',
    assigned: `Waiting for ${i.assigned_name} to start development.`,
    in_development: `${i.assigned_name} is implementing this change.`,
    self_test: `${i.assigned_name} is self-testing the change.`,
    ready_for_qa: i.qa_by_name ? `Waiting for ${i.qa_by_name} to start verification.` : 'Waiting for a QA engineer to be assigned or to start verification.',
    qa_in_progress: `${i.qa_by_name || 'QA'} is verifying the change.`,
    qa_rejected: `Returned to ${i.assigned_name} for correction.`,
    qa_approved: 'Approved by QA. Waiting to be moved to production.',
    ready_for_production: 'In the production queue, waiting to be moved to production.',
    deployed: `Moved to production${i.deployed_by_name ? ` by ${i.deployed_by_name}` : ''}. Waiting to be verified in production.`,
    verified: `Verified in production${i.verified_by_name ? ` by ${i.verified_by_name}` : ''}.`,
  }[i.status];
}

function stepper(d) {
  const i = d.item;
  const cur = STEP_INDEX[i.status];
  const lastBy = (status) => [...d.activity].reverse().find((a) => a.to_status === status && a.from_status !== a.to_status);
  return html`<ol class="stepper">${STEPS.map(([k, text], idx) => {
    let cls = idx < cur ? 'done' : idx === cur ? 'current' : '';
    let name = text;
    let key = k;
    if (k === 'qa_result' && idx <= cur) {
      key = i.status === 'qa_rejected' ? 'qa_rejected' : 'qa_approved';
      if (idx === cur) name = label.status(i.status);
      else name = 'QA Approved';
      if (i.status === 'qa_rejected') cls = 'rejected';
    }
    if (i.status === 'verified' && idx === cur) cls = 'done';
    const ev = idx <= cur ? lastBy(key) : null;
    const skipped = k === 'ready_for_production' && idx < cur && !ev;
    return html`<li class="${cls}">${name}${ev ? html`<span class="sub">${ev.user_name} · ${fmtDate(ev.created_at)}</span>`
      : skipped ? html`<span class="sub">Skipped</span>` : ''}</li>`;
  })}</ol>`;
}

// ---------- Tabs ----------
const block = (title, text) => (text ? html`<div class="prose-block"><h3>${title}</h3><div class="pre">${text}</div></div>` : '');

const TAB_RENDER = {
  details(d) {
    const i = d.item;
    const specific = i.category === 'defect'
      ? html`${block('Steps to Reproduce', i.steps_to_reproduce)}<div class="two-col">${block('Expected Behaviour', i.expected_behaviour)}${block('Actual Behaviour', i.actual_behaviour)}</div>${block('Environment', i.environment)}`
      : html`${block('Business Requirement', i.business_requirement)}${block('Expected Behaviour', i.expected_behaviour)}${block('Acceptance Criteria', i.acceptance_criteria)}`;
    return html`
      ${block(i.category === 'defect' ? 'Problem Description' : 'Description', i.description)}
      ${specific}
      <div class="prose-block"><h3>Attachments</h3>
        ${d.attachments.length ? fileList(d.attachments) : html`<p class="muted small">No attachments.</p>`}
        <form data-upload class="stack" style="margin-top:10px;gap:8px" novalidate>
          ${field({ name: 'files', label: 'Add files', type: 'file' })}
          <div><button class="btn btn-sm" type="submit">${icon('paperclip')} Upload</button></div>
        </form>
      </div>`;
  },

  development(d) {
    const i = d.item;
    const editable = d.actions.includes('save_notes');
    return html`
      <div class="meta-grid" style="margin-bottom:16px">
        ${meta('Developer', person(i.assigned_name))}
        ${meta('Development attempt', i.dev_cycle)}
        ${meta('Current status', statusBadge(i.status))}
      </div>
      ${editable ? html`<form data-notes novalidate>
          ${field({ name: 'implementation_notes', label: 'Implementation notes', type: 'textarea', rows: 6, value: i.implementation_notes,
            placeholder: 'What did you change? Files, screens, database changes, anything QA should know.' })}
          <div class="form-actions"><button class="btn btn-primary" type="submit">Save Notes</button></div>
        </form>`
        : block('Implementation Notes', i.implementation_notes) || html`<p class="muted">No implementation notes yet.</p>`}
      <p class="small muted" style="margin-top:12px">Technical discussion belongs in the <a href="#" data-tab="comments">Comments</a> tab.</p>`;
  },

  self_test(d) {
    if (!d.selfTests.length) return emptyState('No self-test results yet', 'The developer records a self-test before submitting to QA.', 'check');
    return html`${d.selfTests.map((s) => html`<div class="record ${s.result}">
      <div class="record-head">
        <span><span class="result ${s.result}">${s.result === 'passed' ? 'Passed' : 'Failed'}</span> <span class="muted small">· Attempt ${s.cycle}</span></span>
        <span class="small muted">Tested on ${fmtDate(s.tested_on)} by ${s.created_by_name}</span>
      </div>
      <div class="pre">${s.notes}</div>
      ${fileList(s.attachments)}
    </div>`)}`;
  },

  qa(d) {
    if (!d.verifications.length) return emptyState('No QA verification yet', 'QA records a result after verifying the change.', 'shield');
    const rejections = d.verifications.filter((v) => v.result === 'rejected').length;
    return html`
      ${rejections ? html`<div class="hint warn" style="margin-bottom:12px">Rejected ${rejections} time${rejections > 1 ? 's' : ''}. Earlier results are kept below for reference.</div>` : ''}
      ${d.verifications.map((v) => html`<div class="record ${v.result}">
        <div class="record-head">
          <span><span class="result ${v.result}">${v.result === 'approved' ? 'Approved' : 'Rejected'}</span> <span class="muted small">· Attempt ${v.cycle}</span></span>
          <span class="small muted">Tested on ${fmtDate(v.tested_on)} by ${v.created_by_name}</span>
        </div>
        <div class="small muted">${v.result === 'rejected' ? 'Reason' : 'Verification notes'}</div>
        <div class="pre">${v.notes}</div>
        ${v.observed ? html`<div class="small muted" style="margin-top:8px">What was observed</div><div class="pre">${v.observed}</div>` : ''}
        ${fileList(v.attachments)}
      </div>`)}`;
  },

  production(d) {
    const i = d.item;
    const deployed = ['deployed', 'verified'].includes(i.status);
    const verified = i.status === 'verified';
    const move = [...d.activity].reverse().find((a) => a.to_status === 'deployed' && a.from_status !== 'deployed');
    const check = [...d.activity].reverse().find((a) => a.to_status === 'verified' && a.from_status !== 'verified');
    return html`
      <div class="meta-grid" style="margin-bottom:16px">
        ${meta('Production status', deployed ? statusBadge(i.status) : html`<span class="muted">Not in production yet</span>`)}
        ${meta('Moved to production on', deployed ? fmtDateTime(i.deployed_at) : '—')}
        ${meta('Moved by', deployed ? i.deployed_by_name : '—')}
        ${meta('Verified in production on', verified ? fmtDateTime(i.verified_at) : '—')}
        ${meta('Verified by', verified ? i.verified_by_name : '—')}
      </div>
      ${deployed && move?.details?.notes ? html`<div class="prose-block"><h3>Production notes</h3><div class="pre">${move.details.notes}</div></div>` : ''}
      ${verified && check?.details?.notes ? html`<div class="prose-block"><h3>Verification notes</h3><div class="pre">${check.details.notes}</div></div>` : ''}
      ${d.deploymentAttachments.length ? html`<div class="prose-block"><h3>Production files</h3>${fileList(d.deploymentAttachments)}</div>` : ''}
      ${deployed ? '' : html`<p class="muted small">Once QA has approved the change, use <strong>Move to Production</strong> in the Workflow panel.</p>`}`;
  },

  comments(d) {
    return html`
      ${d.comments.length ? d.comments.map((c) => html`<div class="comment">
        <span class="avatar">${initials(c.user_name)}</span>
        <div><div><strong>${c.user_name}</strong> <span class="small muted">${label.role(c.user_role)} · ${fmtDateTime(c.created_at)}</span></div>
          <div class="pre">${c.body}</div>${fileList(c.attachments)}</div>
      </div>`) : html`<p class="muted">No comments yet. Start the discussion below.</p>`}
      <form data-comment novalidate style="margin-top:14px" class="stack">
        ${field({ name: 'body', label: 'Add a comment', type: 'textarea', rows: 3, placeholder: 'Technical notes, questions, clarifications…' })}
        ${field({ name: 'files', label: 'Attach files', type: 'file' })}
        <div><button class="btn btn-primary" type="submit">${icon('comment')} Post Comment</button></div>
      </form>`;
  },

  history(d) {
    return html`<ol class="timeline">${[...d.activity].reverse().map((a) => html`<li>
      <span class="dot">${icon(ACTIVITY_ICON[a.action] || 'clock')}</span>
      <div><div class="what"><strong>${a.user_name || 'System'}</strong> ${describe(a)}</div>
        ${a.from_status && a.to_status && a.from_status !== a.to_status ? html`<div class="row small" style="margin-top:3px">${statusBadge(a.from_status)} → ${statusBadge(a.to_status)}</div>` : ''}
        ${a.action === 'updated' ? diff(a.details.changes) : ''}
        ${a.details?.comment ? html`<div class="diff pre">“${a.details.comment}”</div>` : ''}
        <div class="when">${fmtDateTime(a.created_at)}</div></div>
    </li>`)}</ol>`;
  },
};

const ACTIVITY_ICON = {
  created: 'plus', assign: 'user', start_development: 'code', start_fix: 'code', save_notes: 'edit', start_self_test: 'check',
  record_self_test: 'check', submit_to_qa: 'shield', assign_qa: 'shield', start_qa: 'shield', qa_approve: 'check', qa_reject: 'x',
  queue_for_production: 'rocket', move_to_production: 'rocket', verify_in_production: 'verified', return_for_investigation: 'undo', added_to_release: 'package', removed_from_release: 'undo',
  planning_changed: 'list', deployment_started: 'rocket', deployed: 'rocket', deployment_failed: 'alert', updated: 'edit', commented: 'comment', attachments_added: 'paperclip',
};

function describe(a) {
  const x = a.details || {};
  switch (a.action) {
    case 'created': return `created this ${label.category(x.category).toLowerCase()}`;
    case 'assign': return x.previous ? `reassigned from ${x.previous} to ${x.assigned_to}` : `assigned to ${x.assigned_to}`;
    case 'start_development': return 'started development';
    case 'start_fix': return 'started fixing the QA rejection';
    case 'save_notes': return 'updated implementation notes';
    case 'start_self_test': return 'completed implementation and started self-testing';
    case 'record_self_test': return html`recorded self-test: <span class="result ${x.result}">${x.result === 'passed' ? 'Passed' : 'Failed'}</span>`;
    case 'submit_to_qa': return 'submitted to QA';
    case 'assign_qa': return x.previous ? `reassigned QA from ${x.previous} to ${x.qa}` : `assigned QA to ${x.qa}`;
    case 'start_qa': return 'started QA verification';
    case 'qa_approve': return html`<span class="result approved">approved</span> the change in QA`;
    case 'qa_reject': return html`<span class="result rejected">rejected</span> the change: ${x.reason}`;
    case 'queue_for_production': return 'added to the production queue';
    case 'move_to_production': return x.notes ? `moved to production: ${x.notes}` : 'moved to production';
    case 'verify_in_production': return x.notes ? `verified in production: ${x.notes}` : 'verified in production';
    case 'return_for_investigation': return `returned for investigation: ${x.reason}`;
    case 'added_to_release': return `added to release ${x.version}`;
    case 'removed_from_release': return `removed from release${x.version ? ` ${x.version}` : ''}${x.reason ? `: ${x.reason}` : ''}`;
    case 'deployment_started': return `started deploying ${x.version}`;
    case 'deployed': return `confirmed deployment to production in ${x.version}`;
    case 'deployment_failed': return `recorded a failed deployment of ${x.version}: ${x.notes}`;
    case 'planning_changed': return html`changed planning status from <strong>${x.from}</strong> to <strong>${x.to}</strong>`;
    case 'updated': return 'edited the details';
    case 'commented': return html`commented: <span class="muted">${x.excerpt}</span>`;
    case 'attachments_added': return `attached ${x.files?.join(', ')}`;
    default: return a.action.replace(/_/g, ' ');
  }
}

function diff(changes = {}) {
  return html`<div class="diff">${Object.values(changes).map((c) => html`<div>${c.label}: ${c.from ? html`<del>${c.from}</del> → ` : ''}<ins>${c.to ?? '(empty)'}</ins></div>`)}</div>`;
}

// ---------- Actions ----------
const post = (d, action, body) => api('POST', `api/items/${d.item.id}/actions/${action}`, body);

function runAction(name, d) {
  const i = d.item;
  const simple = (title, message, submitLabel) => openDialog({
    title, body: html`<p>${message}</p>`, submitLabel, onSubmit: () => post(d, name, {}),
  });

  switch (name) {
    case 'assign':
      return openDialog({
        title: i.assigned_to ? 'Reassign developer' : 'Assign developer',
        body: html`<div class="stack">
          ${field({ name: 'assigned_to', label: 'Developer', type: 'select', required: true, value: i.assigned_to, options: developerOptions('Select developer') })}
          ${field({ name: 'comment', label: 'Note for the developer', type: 'textarea', rows: 2 })}
        </div>`,
        submitLabel: 'Assign',
        onSubmit: (form) => post(d, name, formPayload(form)),
      }).then(done('Developer assigned.'));
    case 'start_development':
      return simple('Start development', 'You are starting work on this item. Its status will change to In Development.', 'Start Development').then(done('Development started.'));
    case 'start_fix':
      return simple('Start fixing', 'QA rejected this change. Starting the fix moves it back to In Development; you must self-test again before resubmitting.', 'Start Fix').then(done('Moved back to In Development.'));
    case 'start_self_test':
      return openDialog({
        title: 'Finish implementation',
        body: html`<p class="muted">Describe what you changed. The item then moves to Self-Test.</p>
          ${field({ name: 'implementation_notes', label: 'Implementation notes', type: 'textarea', rows: 6, required: true, value: i.implementation_notes,
            placeholder: 'Files, screens, database changes, anything QA should know.' })}`,
        submitLabel: 'Move to Self-Test',
        onSubmit: (form) => post(d, name, formPayload(form)),
      }).then(done('Moved to Self-Test.'));
    case 'record_self_test':
      return selfTestDialog(d);
    case 'submit_to_qa':
      return simple('Submit to QA', 'Your passed self-test will be sent to QA for verification.', 'Submit to QA').then(done('Submitted to QA.'));
    case 'assign_qa':
      return openDialog({
        title: i.qa_by ? 'Reassign QA engineer' : 'Assign QA engineer',
        body: html`<div class="stack">
          ${field({ name: 'qa_by', label: 'QA engineer', type: 'select', required: true, value: i.qa_by,
            options: qaOptions('Select QA engineer') })}
          ${field({ name: 'comment', label: 'Note for the QA engineer', type: 'textarea', rows: 2 })}
        </div>`,
        submitLabel: 'Assign QA',
        onSubmit: (form) => post(d, name, formPayload(form)),
      }).then(done('QA engineer assigned.'));
    case 'start_qa':
      return simple('Start QA verification', 'You are taking this item for verification. Other QA engineers will see it as In Progress.', 'Start Verification').then(done('QA verification started.'));
    case 'qa_approve':
    case 'qa_reject':
      return qaDialog(d, name === 'qa_approve');
    case 'queue_for_production':
      return simple('Add to production queue', 'This QA-approved item will be marked Ready for Production.', 'Add to Queue').then(done('Added to the production queue.'));
    case 'move_to_production':
      return openDialog({
        title: 'Move to production',
        body: html`<div class="stack">
          <p class="muted" style="margin:0">Confirm this change is live. The item becomes <strong>Deployed to Production</strong>.</p>
          ${field({ name: 'notes', label: 'Production notes', type: 'textarea', rows: 3, placeholder: 'Optional: version, deployment window, anything worth recording.' })}
          ${field({ name: 'files', label: 'Files / evidence', type: 'file' })}
        </div>`,
        submitLabel: 'Move to Production',
        onSubmit: (form) => post(d, name, formPayload(form)),
      }).then(done('Moved to production.'));
    case 'verify_in_production':
      return openDialog({
        title: 'Verify in production',
        body: html`<div class="stack">
          <p class="muted" style="margin:0">Confirm the change works correctly in production. The item becomes <strong>Verified in Production</strong>.</p>
          ${field({ name: 'notes', label: 'Verification notes', type: 'textarea', rows: 3, placeholder: 'Optional: what was checked in production.' })}
          ${field({ name: 'files', label: 'Files / evidence', type: 'file' })}
        </div>`,
        submitLabel: 'Verify in Production',
        onSubmit: (form) => post(d, name, formPayload(form)),
      }).then(done('Verified in production.'));
    case 'return_for_investigation':
      return openDialog({
        title: 'Return for investigation',
        body: html`<p class="muted">The item goes back to the developer (In Development) and must pass self-test and QA again.</p>
          ${field({ name: 'reason', label: 'Reason', type: 'textarea', rows: 3, required: true })}`,
        submitLabel: 'Return to Developer',
        submitClass: 'btn-danger',
        onSubmit: (form) => post(d, name, formPayload(form)),
      }).then(done('Returned to the developer.'));
    default:
      return Promise.resolve(null);
  }
}

const done = (message) => (result) => {
  if (result && typeof result === 'object') {
    toast(message, 'success');
    return result;
  }
  return null;
};

function selfTestDialog(d) {
  return openDialog({
    title: 'Self-Test Result',
    body: html`<div class="stack">
      <p class="muted" style="margin:0">Record the result before submitting to QA. A failed result sends the item back to In Development.</p>
      ${field({ name: 'result', label: 'Self-test status', type: 'radio', required: true, value: 'passed', options: [{ value: 'passed', label: 'Passed' }, { value: 'failed', label: 'Failed' }] })}
      ${field({ name: 'tested_on', label: 'Tested on', type: 'date', required: true, value: todayLocal(), attrs: `max="${todayLocal()}"` })}
      ${field({ name: 'notes', label: 'Details', type: 'textarea', required: true, rows: 4, placeholder: 'What did you test? Which scenarios? What was the outcome?' })}
      ${field({ name: 'files', label: 'Screenshots / evidence', type: 'file' })}
    </div>`,
    buttons: [{ label: 'Save Result', cls: '', value: 'save' }, { label: 'Submit to QA', cls: 'btn-primary', value: 'submit' }],
    onSubmit: async (form, value) => {
      const result = form.querySelector('[name=result]:checked')?.value;
      if (value === 'submit' && result !== 'passed') {
        throw new ApiError(400, { error: 'Only a passed self-test can be submitted to QA. Choose "Save Result" to record a failure.' });
      }
      return post(d, 'record_self_test', formPayload(form, { submit: value === 'submit' ? 'true' : 'false' }));
    },
  }).then((r) => {
    if (r && typeof r === 'object') toast(r.item.status === 'ready_for_qa' ? 'Submitted to QA.' : r.item.status === 'in_development' ? 'Self-test failed — item returned to In Development.' : 'Self-test result saved.', 'success');
    return r && typeof r === 'object' ? r : null;
  });
}

function qaDialog(d, approve) {
  return openDialog({
    title: approve ? 'Approve change' : 'Reject change',
    body: html`<div class="stack">
      ${approve ? html`<p class="muted" style="margin:0">Confirm the change works as expected${d.item.category === 'requirement' ? ' and meets the acceptance criteria' : ''}.</p>`
        : html`<p class="muted" style="margin:0">The item returns to ${d.item.assigned_name}, who must fix it, self-test again and resubmit.</p>`}
      ${field({ name: 'tested_on', label: 'Tested on', type: 'date', required: true, value: todayLocal(), attrs: `max="${todayLocal()}"` })}
      ${field({ name: 'notes', label: approve ? 'Verification notes' : 'Reason for rejection', type: 'textarea', required: true, rows: 4,
        placeholder: approve ? 'What did you verify? Which scenarios passed?' : 'What is wrong? What needs to change?' })}
      ${approve ? '' : field({ name: 'observed', label: 'What you observed', type: 'textarea', rows: 3, placeholder: 'Actual result, error message, data used…', help: 'Provide this or attach evidence below.' })}
      ${field({ name: 'files', label: 'Screenshots / evidence', type: 'file' })}
    </div>`,
    submitLabel: approve ? 'Approve' : 'Reject',
    submitClass: approve ? 'btn-success' : 'btn-danger',
    onSubmit: (form) => post(d, approve ? 'qa_approve' : 'qa_reject', formPayload(form)),
  }).then(done(approve ? 'Change approved.' : 'Change rejected and returned to the developer.'));
}
