<?php
namespace Axt;

const SORTS = [
    'updated' => 'i.updated_at DESC',
    'created' => 'i.created_at DESC',
    'priority' => "CASE i.priority WHEN 'blocker' THEN 0 WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, i.updated_at DESC",
    'key' => 'i.id DESC',
    'due' => 'i.due_date IS NULL, i.due_date ASC',
];

const EDITABLE = [
    'title' => 'Title', 'description' => 'Description', 'product_id' => 'Product', 'module' => 'Module / Feature', 'priority' => 'Priority',
    'requested_by' => 'Requested By', 'due_date' => 'Due Date', 'steps_to_reproduce' => 'Steps to Reproduce',
    'expected_behaviour' => 'Expected Behaviour', 'actual_behaviour' => 'Actual Behaviour', 'environment' => 'Environment',
    'business_requirement' => 'Business Requirement', 'acceptance_criteria' => 'Acceptance Criteria',
];

function list_of(mixed $value, array $allowed): array
{
    if (!is_string($value)) return [];
    return array_values(array_filter(array_map('trim', explode(',', $value)), fn ($s) => isset($allowed[$s])));
}

function placeholders(array $a): string
{
    return implode(', ', array_fill(0, count($a), '?'));
}

function sql_list(array $a): string
{
    return implode(', ', array_map(fn ($s) => "'$s'", $a));
}

/** Builds a WHERE clause shared by the item list, export, dashboard and reports. */
function build_filter(array $q, array $user): array
{
    $where = [];
    $params = [];
    $text = str($q['q'] ?? null, 200);
    if ($text !== '') {
        $like = '%' . like_escape($text) . '%';
        $where[] = "(i.item_key LIKE ? ESCAPE '\\' OR i.title LIKE ? ESCAPE '\\' OR i.description LIKE ? ESCAPE '\\')";
        array_push($params, $like, $like, $like);
    }
    if ($p = int_or_null($q['product'] ?? null)) { $where[] = 'i.product_id = ?'; $params[] = $p; }
    if (isset($q['category']) && is_string($q['category']) && isset(CATEGORIES[$q['category']])) { $where[] = 'i.category = ?'; $params[] = $q['category']; }
    $statuses = list_of($q['status'] ?? null, STATUSES);
    if ($statuses) { $where[] = 'i.status IN (' . placeholders($statuses) . ')'; array_push($params, ...$statuses); }
    $priorities = list_of($q['priority'] ?? null, PRIORITIES);
    if ($priorities) { $where[] = 'i.priority IN (' . placeholders($priorities) . ')'; array_push($params, ...$priorities); }
    $assigned = $q['assigned_to'] ?? null;
    if ($assigned === 'me') { $where[] = 'i.assigned_to = ?'; $params[] = $user['id']; }
    elseif ($assigned === 'none') $where[] = 'i.assigned_to IS NULL';
    elseif ($a = int_or_null($assigned)) { $where[] = 'i.assigned_to = ?'; $params[] = $a; }
    $requester = str($q['requested_by'] ?? null, 200);
    if ($requester !== '') { $where[] = 'i.requested_by = ?'; $params[] = $requester; }
    if (is_date($q['from'] ?? null)) { $where[] = 'i.created_at >= ?'; $params[] = $q['from']; }
    if (is_date($q['to'] ?? null)) { $where[] = 'i.created_at < ?'; $params[] = next_day($q['to']); }
    // QA engineer filter: me | none | mine_open (mine + unassigned) | user id; "all" or empty means everyone.
    $qaf = $q['qa'] ?? null;
    if ($qaf === 'me') { $where[] = 'i.qa_by = ?'; $params[] = $user['id']; }
    elseif ($qaf === 'none') $where[] = 'i.qa_by IS NULL';
    elseif ($qaf === 'mine_open') { $where[] = '(i.qa_by = ? OR i.qa_by IS NULL)'; $params[] = $user['id']; }
    elseif ($qid = int_or_null($qaf)) { $where[] = 'i.qa_by = ?'; $params[] = $qid; }
    $planning = list_of($q['planning'] ?? null, PLANNING_STATUSES);
    if ($planning) { $where[] = 'i.planning_status IN (' . placeholders($planning) . ')'; array_push($params, ...$planning); }
    if (truthy($q['overdue'] ?? null)) { $where[] = "i.due_date < ? AND i.status NOT IN ('deployed', 'verified')"; $params[] = today_iso(); }
    if (truthy($q['open'] ?? null)) $where[] = "i.status NOT IN ('deployed', 'verified')";

    $view = $q['view'] ?? null;
    if ($view === 'my') {
        $parts = ["(i.assigned_to = ? AND i.status IN ('assigned', 'in_development', 'self_test', 'qa_rejected'))"];
        $params[] = $user['id'];
        if (has_permission($user['perms'] ?? null, 'start_qa', $user)) { $parts[] = "(i.qa_by = ? AND i.status IN ('ready_for_qa', 'qa_in_progress'))"; $params[] = $user['id']; }
        if ($user['role'] === 'admin') $parts[] = "i.status = 'new'";
        if (in_array($user['role'], ['admin', 'release_manager'], true)) $parts[] = "i.status = 'qa_approved'";
        $where[] = '(' . implode(' OR ', $parts) . ')';
    } elseif ($view === 'qa') {
        $where[] = 'i.status IN (' . sql_list(GROUP_AWAITING_QA) . ')';
    } elseif ($view === 'production') {
        $where[] = 'i.status IN (' . sql_list(GROUP_PRODUCTION_QUEUE) . ')';
    }
    return [$where ? 'WHERE ' . implode(' AND ', $where) : '', $params];
}

const LIST_COLUMNS = 'i.id, i.item_key, i.title, i.category, i.priority, i.status, i.module, i.requested_by, i.due_date,
  i.created_at, i.updated_at, i.assigned_to, i.planning_status, i.created_by, p.name AS product_name, u.name AS assigned_name,
  i.qa_by, qa.name AS qa_name';
const LIST_FROM = 'FROM items i JOIN products p ON p.id = i.product_id LEFT JOIN users u ON u.id = i.assigned_to
  LEFT JOIN users qa ON qa.id = i.qa_by';

function list_items(Db $db, array $q, array $user): array
{
    [$sql, $params] = build_filter($q, $user + ['perms' => load_permissions($db)]);
    $pageSize = min(max((int) ($q['pageSize'] ?? 25) ?: 25, 1), 100);
    $total = (int) $db->value("SELECT COUNT(*) FROM items i $sql", $params);
    $pages = max((int) ceil($total / $pageSize), 1);
    $page = min(max((int) ($q['page'] ?? 1) ?: 1, 1), $pages);
    $order = SORTS[$q['sort'] ?? ''] ?? SORTS['updated'];
    $items = $db->all('SELECT ' . LIST_COLUMNS . ' ' . LIST_FROM . " $sql ORDER BY $order, i.id DESC LIMIT ? OFFSET ?",
        [...$params, $pageSize, ($page - 1) * $pageSize]);
    $items = array_map(fn ($i) => $i + ['can_edit' => can_edit_item($i, $user)], $items);
    return ['items' => $items, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize, 'pages' => $pages];
}

function export_items(Db $db, array $q, array $user): array
{
    [$sql, $params] = build_filter($q, $user + ['perms' => load_permissions($db)]);
    $order = SORTS[$q['sort'] ?? ''] ?? SORTS['updated'];
    return $db->all('SELECT ' . LIST_COLUMNS . ', i.deployed_at, i.deployed_version ' . LIST_FROM . " $sql ORDER BY $order, i.id DESC LIMIT 10000", $params);
}

function get_item_row(Db $db, int $id): array
{
    $item = $db->one('SELECT * FROM items WHERE id = ?', [$id]);
    if (!$item) throw not_found('Item not found.');
    return $item;
}

function action_context(Db $db, array $item, array $user): array
{
    $current = $item['current_self_test_id'] ? $db->one('SELECT result FROM self_tests WHERE id = ?', [$item['current_self_test_id']]) : null;
    return ['selfTestPassed' => ($current['result'] ?? null) === 'passed', 'perms' => load_permissions($db)];
}

function get_item_detail(Db $db, int $id, array $user): array
{
    $raw = get_item_row($db, $id);
    $item = $db->one('SELECT i.*, p.name AS product_name, a.name AS assigned_name, c.name AS created_by_name,
            q.name AS qa_by_name, d.name AS deployed_by_name, vb.name AS verified_by_name
        FROM items i JOIN products p ON p.id = i.product_id LEFT JOIN users a ON a.id = i.assigned_to
        JOIN users c ON c.id = i.created_by LEFT JOIN users q ON q.id = i.qa_by LEFT JOIN users d ON d.id = i.deployed_by
        LEFT JOIN users vb ON vb.id = i.verified_by WHERE i.id = ?', [$id]);

    $attachments = list_attachments($db, 'item_id', $id);
    $byRef = fn ($context, $refId) => array_values(array_filter($attachments, fn ($a) => $a['context'] === $context && $a['ref_id'] === $refId));
    $selfTests = array_map(fn ($s) => $s + ['attachments' => $byRef('self_test', $s['id'])],
        $db->all('SELECT s.*, u.name AS created_by_name FROM self_tests s JOIN users u ON u.id = s.created_by WHERE s.item_id = ? ORDER BY s.id DESC', [$id]));
    $verifications = array_map(fn ($v) => $v + ['attachments' => $byRef('qa', $v['id'])],
        $db->all('SELECT v.*, u.name AS created_by_name FROM qa_verifications v JOIN users u ON u.id = v.created_by WHERE v.item_id = ? ORDER BY v.id DESC', [$id]));
    $comments = array_map(fn ($c) => $c + ['attachments' => $byRef('comment', $c['id'])],
        $db->all('SELECT c.*, u.name AS user_name, u.role AS user_role FROM comments c JOIN users u ON u.id = c.user_id WHERE c.item_id = ? ORDER BY c.id', [$id]));

    $ctx = action_context($db, $raw, $user);
    return [
        'item' => $item,
        'attachments' => array_values(array_filter($attachments, fn ($a) => $a['context'] === 'item')),
        // Files recorded when the item was moved to production (plus any from the earlier release-based deployments).
        'deploymentAttachments' => [...array_values(array_filter($attachments, fn ($a) => $a['context'] === 'deployment')),
            ...($item['release_id'] ? list_attachments($db, 'release_id', $item['release_id']) : [])],
        'selfTests' => $selfTests,
        'verifications' => $verifications,
        'comments' => $comments,
        'activity' => list_activity($db, 'item_id', $id),
        'actions' => allowed_actions($raw, $user, $ctx),
        'hints' => action_hints($raw, $user, $ctx),
        'canEdit' => can_edit_item($raw, $user),
        'canDelete' => delete_blocker($raw) === null,
    ];
}

function action_hints(array $item, array $user, array $ctx): array
{
    $hints = [];
    if ($item['status'] === 'self_test' && !$ctx['selfTestPassed']) {
        $hints[] = 'Record a passed self-test to unlock "Submit to QA". A failed self-test returns the item to In Development.';
    }
    if ($item['status'] === 'ready_for_production') {
        $hints[] = 'Use "Move to Production" once this change is live.';
    }
    return $hints;
}

function validate_item_input(Db $db, array $input, string $category): void
{
    $fields = [];
    $req = function (string $key, string $label) use ($input, &$fields) {
        if (str($input[$key] ?? null) === '') $fields[$key] = "$label is required.";
    };
    $req('title', 'Title');
    $req('description', 'Description');
    $req('requested_by', 'Requested By');
    $pid = int_or_null($input['product_id'] ?? null);
    $product = $pid ? $db->one('SELECT active FROM products WHERE id = ?', [$pid]) : null;
    if (!$product) $fields['product_id'] = 'Choose a product.';
    elseif (!$product['active']) $fields['product_id'] = 'This product is no longer active.';
    $priority = $input['priority'] ?? null;
    if (!is_string($priority) || !isset(PRIORITIES[$priority])) $fields['priority'] = 'Choose a priority.';
    $due = str($input['due_date'] ?? null);
    if ($due !== '' && !is_date($due)) $fields['due_date'] = 'Use a valid date.';
    if ($category === 'defect') {
        $req('steps_to_reproduce', 'Steps to reproduce');
        $req('expected_behaviour', 'Expected behaviour');
        $req('actual_behaviour', 'Actual behaviour');
    } else {
        $req('acceptance_criteria', 'Acceptance criteria');
    }
    if (mb_strlen(str($input['title'] ?? null, 100000)) > 200) $fields['title'] = 'Keep the title under 200 characters.';
    if ($fields) throw bad_request('Please correct the highlighted fields.', $fields);
}

function normalized_fields(array $in, string $category): array
{
    $out = [
        'title' => str($in['title'] ?? null, 200),
        'description' => str($in['description'] ?? null),
        'product_id' => int_or_null($in['product_id'] ?? null),
        'module' => opt_str($in['module'] ?? null, 120),
        'priority' => $in['priority'],
        'requested_by' => str($in['requested_by'] ?? null, 120),
        'due_date' => opt_str($in['due_date'] ?? null),
        'expected_behaviour' => opt_str($in['expected_behaviour'] ?? null),
        'steps_to_reproduce' => null, 'actual_behaviour' => null, 'environment' => null, 'business_requirement' => null, 'acceptance_criteria' => null,
    ];
    if ($category === 'defect') {
        $out['steps_to_reproduce'] = opt_str($in['steps_to_reproduce'] ?? null);
        $out['actual_behaviour'] = opt_str($in['actual_behaviour'] ?? null);
        $out['environment'] = opt_str($in['environment'] ?? null, 120);
    } else {
        $out['business_requirement'] = opt_str($in['business_requirement'] ?? null);
        $out['acceptance_criteria'] = opt_str($in['acceptance_criteria'] ?? null);
    }
    return $out;
}

/** The developer must be active and have a role allowed to do development work. */
function assert_assignable(Db $db, int $userId, array $perms): array
{
    $dev = $db->one('SELECT id, name, role, active FROM users WHERE id = ?', [$userId]);
    if (!$dev || !$dev['active'] || !has_permission($perms, 'start_development', $dev)) {
        throw bad_request('Choose an active developer.', ['assigned_to' => 'Choose an active developer.']);
    }
    return $dev;
}

function create_item(Db $db, array $user, array $input, array $files): int
{
    if (!in_array($user['role'], CREATE_ROLES, true)) throw forbidden('Your role cannot create items.');
    $category = $input['category'] ?? null;
    if (!is_string($category) || !isset(CATEGORIES[$category])) {
        throw bad_request('Choose Requirement or Defect.', ['category' => 'Choose Requirement or Defect.']);
    }
    validate_item_input($db, $input, $category);
    $assignee = int_or_null($input['assigned_to'] ?? null);
    $dev = $assignee ? assert_assignable($db, $assignee, load_permissions($db)) : null;
    $planning = planning_input($input['planning_status'] ?? null);

    return $db->tx(function () use ($db, $user, $input, $files, $category, $dev, $planning) {
        $f = normalized_fields($input, $category);
        $now = now_iso();
        $id = $db->run("INSERT INTO items (category, title, description, product_id, module, priority, requested_by, due_date,
                steps_to_reproduce, expected_behaviour, actual_behaviour, environment, business_requirement, acceptance_criteria,
                status, planning_status, assigned_to, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, NULL, ?, ?, ?)", [
            $category, $f['title'], $f['description'], $f['product_id'], $f['module'], $f['priority'], $f['requested_by'], $f['due_date'],
            $f['steps_to_reproduce'], $f['expected_behaviour'], $f['actual_behaviour'], $f['environment'], $f['business_requirement'],
            $f['acceptance_criteria'], $planning, $user['id'], $now, $now,
        ]);
        $db->run('UPDATE items SET item_key = ? WHERE id = ?', [sprintf('CD-%04d', $id), $id]);
        log_activity($db, ['itemId' => $id, 'userId' => $user['id'], 'action' => 'created', 'to' => 'new', 'details' => ['category' => $category]]);
        save_attachments($db, $files, ['itemId' => $id, 'context' => 'item', 'userId' => $user['id']]);
        if ($dev) {
            $db->run("UPDATE items SET assigned_to = ?, status = 'assigned' WHERE id = ?", [$dev['id'], $id]);
            log_activity($db, ['itemId' => $id, 'userId' => $user['id'], 'action' => 'assign', 'from' => 'new', 'to' => 'assigned', 'details' => ['assigned_to' => $dev['name']]]);
        }
        return $id;
    });
}

function update_item(Db $db, array $user, int $id, array $input): int
{
    if (array_key_exists('status', $input) || array_key_exists('assigned_to', $input) || array_key_exists('category', $input)) {
        throw bad_request('Status, category and assignment cannot be edited directly. Use the workflow actions.');
    }
    return $db->tx(function () use ($db, $user, $id, $input) {
        $item = get_item_row($db, $id);
        if (!can_edit_item($item, $user)) throw forbidden('Items in production cannot be edited.');
        $merged = array_merge($item, $input);
        validate_item_input($db, $merged, $item['category']);
        $next = normalized_fields($merged, $item['category']);
        $changes = [];
        foreach (EDITABLE as $key => $label) {
            $before = $item[$key] ?? null;
            $after = $next[$key] ?? null;
            if ($before !== $after) $changes[$key] = ['label' => $label, 'from' => audit_value($db, $key, $before), 'to' => audit_value($db, $key, $after)];
        }
        if (!$changes) return $id;
        $sets = implode(', ', array_map(fn ($k) => "$k = ?", array_keys($changes)));
        $db->run("UPDATE items SET $sets, updated_at = ? WHERE id = ?", [...array_map(fn ($k) => $next[$k] ?? null, array_keys($changes)), now_iso(), $id]);
        log_activity($db, ['itemId' => $id, 'userId' => $user['id'], 'action' => 'updated', 'details' => ['changes' => $changes]]);
        return $id;
    });
}

function audit_value(Db $db, string $key, mixed $value): mixed
{
    if ($value === null) return null;
    if ($key === 'product_id') return $db->value('SELECT name FROM products WHERE id = ?', [$value]) ?? $value;
    if ($key === 'priority') return PRIORITIES[$value] ?? $value;
    $s = (string) $value;
    return mb_strlen($s) > 300 ? mb_substr($s, 0, 300) . '…' : $value;
}

function valid_date_past(mixed $value, string $field, string $label): array
{
    $v = str($value);
    if ($v === '') return [$field => "$label is required."];
    if (!is_date($v)) return [$field => 'Use a valid date.'];
    if ($v > today_iso()) return [$field => "$label cannot be in the future."];
    return [];
}

/** Performs a workflow action: re-reads the item in a write transaction, re-checks rules, records the audit entry. */
function perform_action(Db $db, array $user, int $id, string $action, array $input = [], array $files = []): int
{
    if (!isset(ACTIONS[$action])) throw bad_request('Unknown action.');
    return $db->tx(function () use ($db, $user, $id, $action, $input, $files) {
        $item = get_item_row($db, $id);
        $ctx = action_context($db, $item, $user);
        $denied = check_action($action, $item, $user, $ctx);
        if ($denied) throw new HttpError($denied[0], $denied[1]);
        $now = now_iso();
        $def = ACTIONS[$action];
        $to = $def['to'] ?? $item['status'];
        $updates = [];
        $details = [];
        if ($note = opt_str($input['comment'] ?? null, 5000)) $details['comment'] = $note;

        switch ($action) {
            case 'assign':
                $devId = int_or_null($input['assigned_to'] ?? null);
                if (!$devId) throw bad_request('Choose a developer.', ['assigned_to' => 'Choose a developer.']);
                if ($devId === $item['assigned_to']) throw bad_request('The item is already assigned to this developer.', ['assigned_to' => 'Already assigned to this developer.']);
                $dev = assert_assignable($db, $devId, $ctx['perms']);
                $prev = $item['assigned_to'] ? $db->value('SELECT name FROM users WHERE id = ?', [$item['assigned_to']]) : null;
                $updates['assigned_to'] = $dev['id'];
                if ($item['status'] === 'new') $to = 'assigned';
                $details += ['assigned_to' => $dev['name'], 'previous' => $prev];
                break;
            case 'save_notes':
            case 'start_self_test':
                $notes = array_key_exists('implementation_notes', $input) ? str($input['implementation_notes']) : ($item['implementation_notes'] ?? '');
                if ($notes === '') {
                    throw bad_request('Describe what you implemented before continuing.', ['implementation_notes' => 'Implementation notes are required.']);
                }
                if ($notes !== ($item['implementation_notes'] ?? '')) { $updates['implementation_notes'] = $notes; $details['notes_updated'] = true; }
                if ($action === 'start_self_test') $updates['current_self_test_id'] = null;
                break;
            case 'record_self_test':
                $result = $input['result'] ?? null;
                $fields = valid_date_past($input['tested_on'] ?? null, 'tested_on', 'Tested on');
                if (!in_array($result, ['passed', 'failed'], true)) $fields['result'] = 'Choose Passed or Failed.';
                if (str($input['notes'] ?? null) === '') $fields['notes'] = 'Describe what you tested and the outcome.';
                if ($fields) throw bad_request('Please complete the self-test result.', $fields);
                $submit = truthy($input['submit'] ?? null);
                if ($submit && $result !== 'passed') throw bad_request('Only a passed self-test can be submitted to QA.', ['result' => 'Self-test must be Passed to submit.']);
                $testId = $db->run('INSERT INTO self_tests (item_id, cycle, result, tested_on, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [$id, $item['dev_cycle'], $result, str($input['tested_on']), str($input['notes']), $user['id'], $now]);
                save_attachments($db, $files, ['itemId' => $id, 'context' => 'self_test', 'refId' => $testId, 'userId' => $user['id']]);
                $details += ['result' => $result, 'self_test_id' => $testId, 'evidence_files' => count($files)];
                if ($result === 'failed') {
                    $updates['current_self_test_id'] = null;
                    $to = 'in_development';
                } else {
                    $updates['current_self_test_id'] = $testId;
                    if ($submit) {
                        log_activity($db, ['itemId' => $id, 'userId' => $user['id'], 'action' => $action, 'from' => $item['status'], 'to' => $item['status'], 'details' => $details]);
                        apply_updates($db, $id, $updates + ['status' => 'ready_for_qa', 'updated_at' => $now]);
                        log_activity($db, ['itemId' => $id, 'userId' => $user['id'], 'action' => 'submit_to_qa', 'from' => 'self_test', 'to' => 'ready_for_qa']);
                        return $id;
                    }
                }
                break;
            case 'assign_qa':
                $qaId = int_or_null($input['qa_by'] ?? null);
                if (!$qaId) throw bad_request('Choose a QA engineer.', ['qa_by' => 'Choose a QA engineer.']);
                if ($qaId === $item['qa_by']) throw bad_request('The item is already assigned to this QA engineer.', ['qa_by' => 'Already assigned to this QA engineer.']);
                $qa = $db->one('SELECT id, name, role, active FROM users WHERE id = ?', [$qaId]);
                if (!$qa || !$qa['active'] || !has_permission($ctx['perms'], 'start_qa', $qa)) throw bad_request('Choose an active QA engineer.', ['qa_by' => 'Choose an active QA engineer.']);
                $prev = $item['qa_by'] ? $db->value('SELECT name FROM users WHERE id = ?', [$item['qa_by']]) : null;
                $updates['qa_by'] = $qa['id'];
                $details += ['qa' => $qa['name'], 'previous' => $prev];
                break;
            case 'start_qa':
                $updates['qa_by'] = $user['id'];
                break;
            case 'qa_approve':
            case 'qa_reject':
                $approve = $action === 'qa_approve';
                $fields = valid_date_past($input['tested_on'] ?? null, 'tested_on', 'Tested on');
                if (str($input['notes'] ?? null) === '') $fields['notes'] = $approve ? 'Verification notes are required.' : 'A rejection reason is required.';
                if (!$approve && str($input['observed'] ?? null) === '' && !$files) {
                    $fields['observed'] = 'Record what you observed or attach evidence (for example a screenshot).';
                }
                if ($fields) throw bad_request('Please complete the verification result.', $fields);
                $vId = $db->run('INSERT INTO qa_verifications (item_id, cycle, result, tested_on, notes, observed, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [$id, $item['dev_cycle'], $approve ? 'approved' : 'rejected', str($input['tested_on']), str($input['notes']), opt_str($input['observed'] ?? null), $user['id'], $now]);
                save_attachments($db, $files, ['itemId' => $id, 'context' => 'qa', 'refId' => $vId, 'userId' => $user['id']]);
                $details += ['verification_id' => $vId, 'evidence_files' => count($files)];
                if (!$approve) {
                    $details['reason'] = str($input['notes'], 500);
                    $updates += ['dev_cycle' => $item['dev_cycle'] + 1, 'current_self_test_id' => null];
                }
                break;
            case 'return_for_investigation':
                $reason = str($input['reason'] ?? null);
                if ($reason === '') throw bad_request('Explain why the item is being returned.', ['reason' => 'A reason is required.']);
                $details['reason'] = $reason;
                $updates += ['dev_cycle' => $item['dev_cycle'] + 1, 'current_self_test_id' => null, 'qa_by' => null];
                break;
            case 'move_to_production':
                $notes = opt_str($input['notes'] ?? null, 5000);
                if ($notes !== null) $details['notes'] = $notes;
                if ($files) {
                    save_attachments($db, $files, ['itemId' => $id, 'context' => 'deployment', 'userId' => $user['id']]);
                    $details['files'] = count($files);
                }
                $updates += ['deployed_at' => $now, 'deployed_by' => $user['id']];
                break;
            case 'verify_in_production':
                $notes = opt_str($input['notes'] ?? null, 5000);
                if ($notes !== null) $details['notes'] = $notes;
                if ($files) {
                    save_attachments($db, $files, ['itemId' => $id, 'context' => 'deployment', 'userId' => $user['id']]);
                    $details['files'] = count($files);
                }
                $updates += ['verified_at' => $now, 'verified_by' => $user['id']];
                break;
        }

        $updates['status'] = $to;
        $updates['updated_at'] = $now;
        apply_updates($db, $id, $updates);
        log_activity($db, ['itemId' => $id, 'userId' => $user['id'], 'action' => $action, 'from' => $item['status'], 'to' => $to, 'details' => $details ?: null]);
        return $id;
    });
}

function apply_updates(Db $db, int $id, array $updates): void
{
    $keys = array_keys($updates);
    $db->run('UPDATE items SET ' . implode(', ', array_map(fn ($k) => "$k = ?", $keys)) . ' WHERE id = ?', [...array_values($updates), $id]);
}

function add_comment(Db $db, array $user, int $id, array $input, array $files): int
{
    $body = str($input['body'] ?? null);
    if ($body === '') throw bad_request('Write a comment first.', ['body' => 'Comment cannot be empty.']);
    return $db->tx(function () use ($db, $user, $id, $body, $files) {
        get_item_row($db, $id);
        $now = now_iso();
        $cId = $db->run('INSERT INTO comments (item_id, user_id, body, created_at) VALUES (?, ?, ?, ?)', [$id, $user['id'], $body, $now]);
        save_attachments($db, $files, ['itemId' => $id, 'context' => 'comment', 'refId' => $cId, 'userId' => $user['id']]);
        $db->run('UPDATE items SET updated_at = ? WHERE id = ?', [$now, $id]);
        log_activity($db, ['itemId' => $id, 'userId' => $user['id'], 'action' => 'commented', 'details' => ['excerpt' => mb_substr($body, 0, 140)]]);
        return $cId;
    });
}

function add_item_attachments(Db $db, array $user, int $id, array $files): void
{
    if (!$files) throw bad_request('Choose at least one file.');
    $db->tx(function () use ($db, $user, $id, $files) {
        $item = get_item_row($db, $id);
        if ($item['status'] === 'deployed' && $user['role'] !== 'admin') throw forbidden('This item is already deployed.');
        save_attachments($db, $files, ['itemId' => $id, 'context' => 'item', 'userId' => $user['id']]);
        $db->run('UPDATE items SET updated_at = ? WHERE id = ?', [now_iso(), $id]);
        log_activity($db, ['itemId' => $id, 'userId' => $user['id'], 'action' => 'attachments_added', 'details' => ['files' => array_column($files, 'originalname')]]);
    });
}

/** Why $item may not be deleted, or null when deletion is allowed. Any signed-in user may delete. */
function delete_blocker(array $item): ?HttpError
{
    if (in_array($item['status'], GROUP_CLOSED, true)) return conflict('Items in production are part of the delivery history and cannot be deleted.');
    return null;
}

/** Permanently deletes an item and everything recorded against it; one audit entry records the deletion. */
function delete_item(Db $db, array $cfg, array $user, int $id): void
{
    $stored = $db->tx(function () use ($db, $user, $id) {
        $item = get_item_row($db, $id);
        if ($blocker = delete_blocker($item)) throw $blocker;
        $files = array_column($db->all('SELECT stored_name FROM attachments WHERE item_id = ?', [$id]), 'stored_name');
        $db->run('UPDATE items SET current_self_test_id = NULL WHERE id = ?', [$id]);
        foreach (['attachments', 'comments', 'self_tests', 'qa_verifications', 'release_items', 'activity'] as $table) {
            $db->run("DELETE FROM $table WHERE item_id = ?", [$id]);
        }
        $db->run('DELETE FROM items WHERE id = ?', [$id]);
        log_activity($db, ['userId' => $user['id'], 'action' => 'item_deleted',
            'details' => ['item_key' => $item['item_key'], 'title' => $item['title'], 'category' => $item['category'], 'status' => $item['status']]]);
        return $files;
    });
    foreach ($stored as $name) @unlink($cfg['uploadDir'] . '/' . basename($name));
}

function planning_input(mixed $value): string
{
    if ($value === null || $value === '') return 'backlog';
    if (!is_string($value) || !isset(PLANNING_STATUSES[$value])) {
        throw bad_request('Choose a planning status.', ['planning_status' => 'Choose Backlog, Planned, Active, On Hold or Completed.']);
    }
    return $value;
}

/** Changes only the planning label; workflow status, assignment and QA data are untouched. */
function set_planning_status(Db $db, array $user, int $id, mixed $value): void
{
    if ($value === null || $value === '') throw bad_request('Choose a planning status.', ['planning_status' => 'Choose a planning status.']);
    $next = planning_input($value);
    $db->tx(function () use ($db, $user, $id, $next) {
        $item = get_item_row($db, $id);
        if ($item['planning_status'] === $next) return;
        $db->run('UPDATE items SET planning_status = ?, updated_at = ? WHERE id = ?', [$next, now_iso(), $id]);
        log_activity($db, ['itemId' => $id, 'userId' => $user['id'], 'action' => 'planning_changed',
            'details' => ['from' => PLANNING_STATUSES[$item['planning_status']], 'to' => PLANNING_STATUSES[$next]]]);
    });
}
