<?php
namespace Axt;

function list_users(Db $db): array
{
    return $db->all("SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
            (SELECT COUNT(*) FROM items i WHERE i.assigned_to = u.id AND i.status NOT IN ('deployed', 'verified')) AS open_items
        FROM users u ORDER BY u.active DESC, u.name");
}

function create_user(Db $db, ?array $actor, array $input): int
{
    $fields = [];
    $name = str($input['name'] ?? null, 120);
    $email = strtolower(str($input['email'] ?? null, 200));
    $role = $input['role'] ?? null;
    if ($name === '') $fields['name'] = 'Name is required.';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $fields['email'] = 'Enter a valid email address.';
    elseif ($db->one('SELECT id FROM users WHERE email = ?', [$email])) $fields['email'] = 'A user with this email already exists.';
    if (!is_string($role) || !isset(ROLES[$role])) $fields['role'] = 'Choose a role.';
    if ($err = validate_password($input['password'] ?? null)) $fields['password'] = $err;
    if ($fields) throw bad_request('Please correct the highlighted fields.', $fields);
    return $db->tx(function () use ($db, $actor, $name, $email, $role, $input) {
        $now = now_iso();
        $id = $db->run('INSERT INTO users (name, email, password_hash, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
            [$name, $email, hash_password($input['password']), $role, $now, $now]);
        log_activity($db, ['userId' => $actor['id'] ?? null, 'action' => 'user_created', 'details' => ['name' => $name, 'email' => $email, 'role' => $role]]);
        return $id;
    });
}

function update_user(Db $db, array $actor, int $id, array $input): void
{
    $db->tx(function () use ($db, $actor, $id, $input) {
        $user = $db->one('SELECT * FROM users WHERE id = ?', [$id]);
        if (!$user) throw not_found('User not found.');
        $next = [
            'name' => array_key_exists('name', $input) ? str($input['name'], 120) : $user['name'],
            'email' => array_key_exists('email', $input) ? strtolower(str($input['email'], 200)) : $user['email'],
            'role' => array_key_exists('role', $input) ? $input['role'] : $user['role'],
            'active' => array_key_exists('active', $input) ? (truthy($input['active']) ? 1 : 0) : $user['active'],
        ];
        $fields = [];
        if ($next['name'] === '') $fields['name'] = 'Name is required.';
        if (!filter_var($next['email'], FILTER_VALIDATE_EMAIL)) $fields['email'] = 'Enter a valid email address.';
        elseif ($db->one('SELECT id FROM users WHERE email = ? AND id <> ?', [$next['email'], $id])) $fields['email'] = 'A user with this email already exists.';
        if (!is_string($next['role']) || !isset(ROLES[$next['role']])) $fields['role'] = 'Choose a role.';
        $hash = null;
        if (str($input['password'] ?? null) !== '') {
            if ($err = validate_password($input['password'])) $fields['password'] = $err;
            else $hash = hash_password($input['password']);
        }
        if ($fields) throw bad_request('Please correct the highlighted fields.', $fields);
        if ($id === $actor['id'] && ($next['role'] !== 'admin' || !$next['active'])) throw conflict('You cannot remove your own admin access.');
        $admins = (int) $db->value("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1");
        if ($user['role'] === 'admin' && $user['active'] && ($next['role'] !== 'admin' || !$next['active']) && $admins <= 1) {
            throw conflict('At least one active admin is required.');
        }
        $db->run('UPDATE users SET name = ?, email = ?, role = ?, active = ?, password_hash = COALESCE(?, password_hash), updated_at = ? WHERE id = ?',
            [$next['name'], $next['email'], $next['role'], $next['active'], $hash, now_iso(), $id]);
        // Signing-in identity changed: end existing sessions.
        if (!$next['active'] || $hash || $next['role'] !== $user['role'] || $next['email'] !== strtolower($user['email'])) $db->run('DELETE FROM sessions WHERE user_id = ?', [$id]);
        $changes = [];
        foreach (['name', 'email', 'role', 'active'] as $k) if ($user[$k] !== $next[$k]) $changes[$k] = ['from' => $user[$k], 'to' => $next[$k]];
        if ($hash) $changes['password'] = 'reset';
        if ($changes) log_activity($db, ['userId' => $actor['id'], 'action' => 'user_updated', 'details' => ['user' => $user['email'], 'changes' => $changes]]);
    });
}

function list_products(Db $db): array
{
    $modules = $db->all('SELECT * FROM modules ORDER BY name');
    return array_map(fn ($p) => $p + ['modules' => array_values(array_filter($modules, fn ($m) => $m['product_id'] === $p['id']))],
        $db->all('SELECT * FROM products ORDER BY active DESC, name'));
}

function save_product(Db $db, array $actor, ?int $id, array $input): int
{
    $name = str($input['name'] ?? null, 120);
    if ($name === '') throw bad_request('Product name is required.', ['name' => 'Product name is required.']);
    if ($db->one('SELECT id FROM products WHERE name = ? AND id IS NOT ?', [$name, $id])) {
        throw bad_request('This product already exists.', ['name' => 'This product already exists.']);
    }
    return $db->tx(function () use ($db, $actor, $id, $input, $name) {
        if ($id) {
            if (!$db->one('SELECT id FROM products WHERE id = ?', [$id])) throw not_found('Product not found.');
            $active = array_key_exists('active', $input) ? (truthy($input['active']) ? 1 : 0) : null;
            $db->run('UPDATE products SET name = ?, active = COALESCE(?, active) WHERE id = ?', [$name, $active, $id]);
            log_activity($db, ['userId' => $actor['id'], 'action' => 'product_updated', 'details' => ['id' => $id, 'name' => $name, 'active' => $active]]);
            return $id;
        }
        $newId = $db->run('INSERT INTO products (name, active, created_at) VALUES (?, 1, ?)', [$name, now_iso()]);
        log_activity($db, ['userId' => $actor['id'], 'action' => 'product_created', 'details' => ['name' => $name]]);
        return $newId;
    });
}

function save_module(Db $db, array $actor, ?int $id, array $input): int
{
    $name = str($input['name'] ?? null, 120);
    if ($name === '') throw bad_request('Module name is required.', ['name' => 'Module name is required.']);
    return $db->tx(function () use ($db, $id, $input, $name) {
        if ($id) {
            $m = $db->one('SELECT * FROM modules WHERE id = ?', [$id]);
            if (!$m) throw not_found('Module not found.');
            if ($db->one('SELECT id FROM modules WHERE product_id = ? AND name = ? AND id <> ?', [$m['product_id'], $name, $id])) {
                throw bad_request('This module already exists for the product.', ['name' => 'Already exists.']);
            }
            $active = array_key_exists('active', $input) ? (truthy($input['active']) ? 1 : 0) : null;
            $db->run('UPDATE modules SET name = ?, active = COALESCE(?, active) WHERE id = ?', [$name, $active, $id]);
            return $id;
        }
        $pid = int_or_null($input['product_id'] ?? null);
        if (!$pid || !$db->one('SELECT id FROM products WHERE id = ?', [$pid])) throw bad_request('Choose a product.');
        if ($db->one('SELECT id FROM modules WHERE product_id = ? AND name = ?', [$pid, $name])) {
            throw bad_request('This module already exists for the product.', ['name' => 'Already exists.']);
        }
        return $db->run('INSERT INTO modules (product_id, name, active, created_at) VALUES (?, ?, 1, ?)', [$pid, $name, now_iso()]);
    });
}
