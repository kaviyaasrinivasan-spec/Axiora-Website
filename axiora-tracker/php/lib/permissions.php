<?php
namespace Axt;

/** The workflow permission map in force: defaults, overridden by what admins saved. */
function load_permissions(Db $db): array
{
    $perms = default_permissions();
    foreach ($db->all('SELECT permission, roles FROM workflow_permissions') as $row) {
        if (!isset($perms[$row['permission']])) continue;
        $roles = array_values(array_filter(json_decode($row['roles'], true) ?: [], fn ($r) => isset(ROLES[$r])));
        if ($roles) $perms[$row['permission']] = $roles;
    }
    return $perms;
}

/** Permission rows for the Settings screen. */
function describe_permissions(Db $db): array
{
    $perms = load_permissions($db);
    $out = [];
    foreach (WORKFLOW_PERMISSIONS as $key => $def) {
        $out[] = ['key' => $key, 'group' => $def['group'], 'label' => $def['label'], 'note' => $def['note'] ?? null,
            'roles' => $perms[$key], 'defaultRoles' => $def['roles']];
    }
    return $out;
}

/**
 * Saves new roles for some or all permissions ([permission => [roles]]). Every permission must keep
 * at least one role so no workflow step can become impossible. The change is audited.
 */
function save_permissions(Db $db, array $actor, mixed $input): array
{
    if (!is_array($input) || array_is_list($input) && $input) throw bad_request('Send the permissions to save.');
    $fields = [];
    $next = [];
    foreach ($input as $key => $roles) {
        if (!isset(WORKFLOW_PERMISSIONS[$key])) { $fields[$key] = 'Unknown permission.'; continue; }
        if (!is_array($roles) || array_filter($roles, fn ($r) => !is_string($r) || !isset(ROLES[$r]))) { $fields[$key] = 'Choose valid roles.'; continue; }
        if (!$roles) { $fields[$key] = 'At least one role must be allowed.'; continue; }
        $next[$key] = array_values(array_filter(array_keys(ROLES), fn ($r) => in_array($r, $roles, true)));
    }
    if ($fields) throw bad_request('Please correct the workflow permissions.', $fields);
    return $db->tx(function () use ($db, $actor, $next) {
        $current = load_permissions($db);
        $changes = [];
        $now = now_iso();
        foreach ($next as $key => $roles) {
            $sameSet = function (array $a, array $b): bool { sort($a); sort($b); return $a === $b; };
            if ($sameSet($current[$key], $roles)) continue;
            $changes[$key] = ['from' => $current[$key], 'to' => $roles];
            // Back to the default: drop the override so only real changes are stored.
            if ($sameSet($roles, WORKFLOW_PERMISSIONS[$key]['roles'])) {
                $db->run('DELETE FROM workflow_permissions WHERE permission = ?', [$key]);
                continue;
            }
            $db->run('INSERT INTO workflow_permissions (permission, roles, updated_by, updated_at) VALUES (?, ?, ?, ?)
                ON CONFLICT(permission) DO UPDATE SET roles = excluded.roles, updated_by = excluded.updated_by, updated_at = excluded.updated_at',
                [$key, json_encode($roles), $actor['id'], $now]);
        }
        if ($changes) log_activity($db, ['userId' => $actor['id'], 'action' => 'workflow_permissions_updated', 'details' => ['changes' => $changes]]);
        return describe_permissions($db);
    });
}
