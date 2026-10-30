// Single source of truth for the item lifecycle and who may move an item along it.
// The API calls checkAction() before every transition; the UI only renders the
// actions that allowedActions() returns, but never relies on that for enforcement.

export const STATUSES = {
  new: 'New',
  assigned: 'Assigned',
  in_development: 'In Development',
  self_test: 'Self-Test',
  ready_for_qa: 'Ready for QA',
  qa_in_progress: 'QA In Progress',
  qa_rejected: 'QA Rejected',
  qa_approved: 'QA Approved',
  ready_for_production: 'Ready for Production',
  deployed: 'Deployed to Production',
  verified: 'Verified in Production',
};

export const CATEGORIES = { requirement: 'Requirement', defect: 'Defect' };
/** Planning label, independent of the workflow status: changing it never moves the workflow. */
export const PLANNING_STATUSES = { backlog: 'Backlog', planned: 'Planned', active: 'Active', on_hold: 'On Hold', completed: 'Completed' };
export const PRIORITIES = { blocker: 'Blocker', critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

/** Roles allowed to raise new items. */
export const CREATE_ROLES = ['admin', 'qa', 'developer'];

/**
 * Every signed-in user may perform every workflow step; only the stage order and the required
 * fields are enforced. These settings decide which roles appear in the Developer and QA engineer
 * pickers. Admins can change them in Settings (stored in the workflow_permissions table).
 */
export const WORKFLOW_PERMISSIONS = {
  start_development: { group: 'Assignment', label: 'Can be assigned as developer', roles: ['developer', 'admin'],
    note: 'Users with these roles appear in the Developer picker.' },
  start_qa: { group: 'Assignment', label: 'Can be assigned as QA engineer', roles: ['qa', 'admin'],
    note: 'Users with these roles appear in the QA engineer picker.' },
};

/** A fresh copy of the default permission → roles map. */
export const defaultPermissions = () => Object.fromEntries(Object.entries(WORKFLOW_PERMISSIONS).map(([k, v]) => [k, [...v.roles]]));

/** True when `user` has a role allowed for `permission` (using the saved settings when given). */
export const hasPermission = (perms, permission, user) => ((perms || defaultPermissions())[permission] || []).includes(user.role);

/**
 * from: statuses the action may start from
 * to:   resulting status (omitted for actions that record data without moving the item)
 * Any signed-in user may perform any action; there are no role or assignment restrictions.
 */
export const ACTIONS = {
  assign: { label: 'Assign', from: ['new', 'assigned', 'in_development', 'qa_rejected'] },
  start_development: { label: 'Start Development', from: ['assigned'], to: 'in_development' },
  save_notes: { label: 'Save Implementation Notes', from: ['assigned', 'in_development', 'self_test', 'qa_rejected'] },
  start_self_test: { label: 'Move to Self-Test', from: ['in_development'], to: 'self_test' },
  record_self_test: { label: 'Record Self-Test', from: ['self_test'] },
  submit_to_qa: { label: 'Submit to QA', from: ['self_test'], to: 'ready_for_qa' },
  assign_qa: { label: 'Assign QA', from: ['ready_for_qa', 'qa_in_progress'] },
  start_qa: { label: 'Start QA Verification', from: ['ready_for_qa'], to: 'qa_in_progress' },
  qa_approve: { label: 'Approve', from: ['qa_in_progress'], to: 'qa_approved' },
  qa_reject: { label: 'Reject', from: ['qa_in_progress'], to: 'qa_rejected' },
  start_fix: { label: 'Start Fix', from: ['qa_rejected'], to: 'in_development' },
  queue_for_production: { label: 'Add to Production Queue', from: ['qa_approved'], to: 'ready_for_production' },
  move_to_production: { label: 'Move to Production', from: ['qa_approved', 'ready_for_production'], to: 'deployed' },
  verify_in_production: { label: 'Verify in Production', from: ['deployed'], to: 'verified' },
  return_for_investigation: { label: 'Return for Investigation', from: ['qa_approved', 'ready_for_production'], to: 'in_development' },
};

/** Status groups used by dashboards, queues and filters. */
export const GROUPS = {
  in_development: ['in_development', 'self_test'],
  awaiting_qa: ['ready_for_qa', 'qa_in_progress'],
  production_queue: ['qa_approved', 'ready_for_production'],
  // In production: no longer listed under All Items, and locked against edits and deletion.
  closed: ['deployed', 'verified'],
  open: Object.keys(STATUSES).filter((s) => !['deployed', 'verified'].includes(s)),
};

/**
 * Returns null when `action` is possible for `item`, otherwise { status, message }.
 * Only the stage order is checked (plus a passed self-test before QA): any signed-in user may act.
 * ctx.selfTestPassed — true when the current cycle has a passed self-test on record.
 */
export function checkAction(action, item, user, ctx = {}) {
  const def = ACTIONS[action];
  if (!def) return { status: 400, message: 'Unknown action.' };
  if (!def.from.includes(item.status)) {
    return { status: 409, message: `"${def.label}" is not possible while the item is ${STATUSES[item.status]}.` };
  }
  if (action === 'submit_to_qa' && !ctx.selfTestPassed) {
    return { status: 409, message: 'Record a passed self-test before submitting to QA.' };
  }
  return null;
}

export function allowedActions(item, user, ctx) {
  return Object.keys(ACTIONS).filter((a) => !checkAction(a, item, user, ctx));
}

/** Any signed-in user may edit an item's details until it is in production. */
export function canEditItem(item) {
  return !GROUPS.closed.includes(item.status);
}
