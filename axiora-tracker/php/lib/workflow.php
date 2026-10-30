<?php
namespace Axt;

// Single source of truth for the item lifecycle (PHP twin of src/workflow.js).

const STATUSES = [
    'new' => 'New',
    'assigned' => 'Assigned',
    'in_development' => 'In Development',
    'self_test' => 'Self-Test',
    'ready_for_qa' => 'Ready for QA',
    'qa_in_progress' => 'QA In Progress',
    'qa_rejected' => 'QA Rejected',
    'qa_approved' => 'QA Approved',
    'ready_for_production' => 'Ready for Production',
    'deployed' => 'Deployed to Production',
    'verified' => 'Verified in Production',
];
const CATEGORIES = ['requirement' => 'Requirement', 'defect' => 'Defect'];
// Planning label, independent of the workflow status: changing it never moves the workflow.
const PLANNING_STATUSES = ['backlog' => 'Backlog', 'planned' => 'Planned', 'active' => 'Active', 'on_hold' => 'On Hold', 'completed' => 'Completed'];
const PRIORITIES = ['blocker' => 'Blocker', 'critical' => 'Critical', 'high' => 'High', 'medium' => 'Medium', 'low' => 'Low'];
const ROLES = [
    'admin' => 'Admin / Product Owner',
    'developer' => 'Developer',
    'qa' => 'QA Engineer',
    'release_manager' => 'Release Manager',
];

const CREATE_ROLES = ['admin', 'qa', 'developer'];

// Every signed-in user may perform every workflow step; only the stage order and the required fields
// are enforced. These settings decide which roles appear in the Developer and QA engineer pickers.
// Admins can change them in Settings (workflow_permissions table). Twin of src/workflow.js.
const WORKFLOW_PERMISSIONS = [
    'start_development' => ['group' => 'Assignment', 'label' => 'Can be assigned as developer', 'roles' => ['developer', 'admin'],
        'note' => 'Users with these roles appear in the Developer picker.'],
    'start_qa' => ['group' => 'Assignment', 'label' => 'Can be assigned as QA engineer', 'roles' => ['qa', 'admin'],
        'note' => 'Users with these roles appear in the QA engineer picker.'],
];

function default_permissions(): array
{
    return array_map(fn ($p) => $p['roles'], WORKFLOW_PERMISSIONS);
}

/** True when $user has a role allowed for $permission (using the saved settings when given). */
function has_permission(?array $perms, string $permission, array $user): bool
{
    return in_array($user['role'], ($perms ?? default_permissions())[$permission] ?? [], true);
}

// Any signed-in user may perform any action; there are no role or assignment restrictions.
const ACTIONS = [
    'assign' => ['label' => 'Assign', 'from' => ['new', 'assigned', 'in_development', 'qa_rejected']],
    'start_development' => ['label' => 'Start Development', 'from' => ['assigned'], 'to' => 'in_development'],
    'save_notes' => ['label' => 'Save Implementation Notes', 'from' => ['assigned', 'in_development', 'self_test', 'qa_rejected']],
    'start_self_test' => ['label' => 'Move to Self-Test', 'from' => ['in_development'], 'to' => 'self_test'],
    'record_self_test' => ['label' => 'Record Self-Test', 'from' => ['self_test']],
    'submit_to_qa' => ['label' => 'Submit to QA', 'from' => ['self_test'], 'to' => 'ready_for_qa'],
    'assign_qa' => ['label' => 'Assign QA', 'from' => ['ready_for_qa', 'qa_in_progress']],
    'start_qa' => ['label' => 'Start QA Verification', 'from' => ['ready_for_qa'], 'to' => 'qa_in_progress'],
    'qa_approve' => ['label' => 'Approve', 'from' => ['qa_in_progress'], 'to' => 'qa_approved'],
    'qa_reject' => ['label' => 'Reject', 'from' => ['qa_in_progress'], 'to' => 'qa_rejected'],
    'start_fix' => ['label' => 'Start Fix', 'from' => ['qa_rejected'], 'to' => 'in_development'],
    'queue_for_production' => ['label' => 'Add to Production Queue', 'from' => ['qa_approved'], 'to' => 'ready_for_production'],
    'move_to_production' => ['label' => 'Move to Production', 'from' => ['qa_approved', 'ready_for_production'], 'to' => 'deployed'],
    'verify_in_production' => ['label' => 'Verify in Production', 'from' => ['deployed'], 'to' => 'verified'],
    'return_for_investigation' => ['label' => 'Return for Investigation', 'from' => ['qa_approved', 'ready_for_production'], 'to' => 'in_development'],
];

const GROUP_IN_DEVELOPMENT = ['in_development', 'self_test'];
const GROUP_AWAITING_QA = ['ready_for_qa', 'qa_in_progress'];
const GROUP_PRODUCTION_QUEUE = ['qa_approved', 'ready_for_production'];
// In production: no longer listed under All Items, and locked against edits and deletion.
const GROUP_CLOSED = ['deployed', 'verified'];

/** Returns null when the action is possible, otherwise [status, message]. Only the stage order is checked. */
function check_action(string $action, array $item, array $user, array $ctx = []): ?array
{
    $def = ACTIONS[$action] ?? null;
    if (!$def) return [400, 'Unknown action.'];
    if (!in_array($item['status'], $def['from'], true)) {
        return [409, sprintf('"%s" is not possible while the item is %s.', $def['label'], STATUSES[$item['status']])];
    }
    if ($action === 'submit_to_qa' && empty($ctx['selfTestPassed'])) {
        return [409, 'Record a passed self-test before submitting to QA.'];
    }
    return null;
}

function allowed_actions(array $item, array $user, array $ctx): array
{
    return array_values(array_filter(array_keys(ACTIONS), fn ($a) => check_action($a, $item, $user, $ctx) === null));
}

/** Any signed-in user may edit an item's details until it is in production. */
function can_edit_item(array $item, array $user): bool
{
    return !in_array($item['status'], GROUP_CLOSED, true);
}
