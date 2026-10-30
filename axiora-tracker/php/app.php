<?php
// Front controller for the PHP deployment. The web-facing index.php only defines
// AXT_ROOT (this app's folder, outside the web root) and requires this file.
namespace Axt;

require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/workflow.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/activity.php';
require __DIR__ . '/lib/attachments.php';
require __DIR__ . '/lib/items.php';
require __DIR__ . '/lib/dashboard.php';
require __DIR__ . '/lib/ceo.php';
require __DIR__ . '/lib/admin.php';
require __DIR__ . '/lib/permissions.php';

function json_out(int $status, mixed $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
}

function security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
        . "object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    // Never let LiteSpeed, the CDN or the browser cache authenticated pages.
    header('Cache-Control: no-store, private');
    header('X-LiteSpeed-Cache-Control: no-cache');
}

function request_input(): array
{
    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (str_contains($type, 'application/json')) {
        $raw = file_get_contents('php://input');
        if ($raw === '' || $raw === false) return [];
        $data = json_decode($raw, true);
        if (!is_array($data)) throw bad_request('Invalid JSON body.');
        return $data;
    }
    return $_POST;
}

function csv_cell(mixed $v): string
{
    $s = $v === null ? '' : (string) $v;
    if (preg_match('/^[=+\-@\t\r]/', $s)) $s = "'" . $s;
    return '"' . str_replace('"', '""', $s) . '"';
}

function run(string $root, ?string $base = null): void
{
    $base ??= rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = str_starts_with($uriPath, $base) ? substr($uriPath, strlen($base)) : $uriPath;
    $path = '/' . ltrim($path, '/');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $cookiePath = $base . '/';
    security_headers();

    $files = [];
    try {
        $cfg = load_config($root);
        $db = Db::open($cfg['dbFile']);
        $db->migrate($root . '/migrations');

        if ($path === '/healthz') { json_out(200, ['ok' => true]); return; }
        if (!str_starts_with($path, '/api/')) {
            if ($method !== 'GET' && $method !== 'HEAD') throw not_found();
            header('Content-Type: text/html; charset=utf-8');
            readfile($root . '/public/index.html');
            return;
        }
        if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true) && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'axiora-tracker') {
            throw forbidden('Missing request header.');
        }
        $route = substr($path, 4); // strip "/api"
        $session = load_user($db, $cfg);
        $user = $session['user'] ?? null;
        $in = request_input();
        $q = $_GET;
        $withFiles = function () use ($cfg, &$files) { $files = accept_uploads($cfg); return $files; };

        // ---- Auth (no session required) ----
        if ($route === '/auth/login' && $method === 'POST') {
            $email = strtolower(str($in['email'] ?? null, 200));
            $password = (string) ($in['password'] ?? '');
            if ($email === '' || $password === '') throw bad_request('Enter your email and password.');
            $u = $db->one('SELECT * FROM users WHERE email = ? AND active = 1', [$email]);
            if (!$u || !verify_password($password, $u['password_hash'])) throw new HttpError(401, 'Incorrect email or password.');
            $remember = truthy($in['remember'] ?? null);
            [$token, $expires] = create_session($db, $cfg, $u['id'], $remember);
            set_session_cookie($cfg, $cookiePath, $token, $expires, $remember);
            json_out(200, ['user' => ['id' => $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role']]]);
            return;
        }
        if ($route === '/auth/logout' && $method === 'POST') {
            destroy_session($db, session_token());
            clear_session_cookie($cookiePath);
            json_out(200, ['ok' => true]);
            return;
        }
        if (!$user) throw new HttpError(401, 'Please sign in.');
        $requireAdmin = function () use ($user) { if ($user['role'] !== 'admin') throw forbidden(); };

        if ($route === '/auth/me' && $method === 'GET') { json_out(200, ['user' => $user]); return; }
        if ($route === '/auth/password' && $method === 'POST') {
            $hash = $db->value('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
            if (!verify_password((string) ($in['current_password'] ?? ''), $hash)) {
                throw bad_request('Current password is incorrect.', ['current_password' => 'Current password is incorrect.']);
            }
            if ($err = validate_password($in['new_password'] ?? null)) throw bad_request($err, ['new_password' => $err]);
            $db->run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash_password($in['new_password']), now_iso(), $user['id']]);
            $db->run('DELETE FROM sessions WHERE user_id = ?', [$user['id']]);
            [$token, $expires] = create_session($db, $cfg, $user['id']);
            set_session_cookie($cfg, $cookiePath, $token, $expires);
            json_out(200, ['ok' => true]);
            return;
        }

        // ---- Reference data ----
        if ($route === '/meta' && $method === 'GET') {
            $role = $user['role'];
            $perms = load_permissions($db);
            json_out(200, [
                'user' => $user, 'session' => ['idleMinutes' => $cfg['sessionIdleMinutes'], 'remembered' => $session['remember']],
                'statuses' => STATUSES, 'planningStatuses' => PLANNING_STATUSES, 'categories' => CATEGORIES, 'priorities' => PRIORITIES, 'roles' => ROLES,
                'actions' => array_map(fn ($a) => $a['label'], ACTIONS),
                'products' => list_products($db),
                'users' => $db->all('SELECT id, name, role, active FROM users ORDER BY name'),
                // Which roles each workflow step allows, so pickers (developer, QA engineer) match the server.
                'workflowRoles' => $perms,
                'requesters' => array_column($db->all('SELECT DISTINCT requested_by FROM items ORDER BY requested_by'), 'requested_by'),
                'permissions' => [
                    // Every workflow step is open to everyone signed in.
                    'createItem' => in_array($role, CREATE_ROLES, true), 'assign' => true, 'admin' => $role === 'admin',
                ],
                'uploads' => ['maxMb' => $cfg['maxUploadMb'], 'maxFiles' => $cfg['maxFilesPerUpload'], 'extensions' => array_keys(FILE_TYPES)],
            ]);
            return;
        }

        // ---- Items ----
        if ($route === '/items' && $method === 'GET') { json_out(200, list_items($db, $q, $user)); return; }
        if ($route === '/items/export.csv' && $method === 'GET') {
            $rows = export_items($db, $q, $user);
            $head = ['ID', 'Title', 'Category', 'Product', 'Module', 'Priority', 'Status', 'Planning Status', 'Assigned To', 'Requested By',
                'Due Date', 'Deployed At', 'Created', 'Updated'];
            $lines = [implode(',', array_map('Axt\csv_cell', $head))];
            foreach ($rows as $i) {
                $lines[] = implode(',', array_map('Axt\csv_cell', [$i['item_key'], $i['title'], CATEGORIES[$i['category']], $i['product_name'], $i['module'],
                    PRIORITIES[$i['priority']], STATUSES[$i['status']], PLANNING_STATUSES[$i['planning_status']], $i['assigned_name'], $i['requested_by'], $i['due_date'],
                    $i['deployed_at'], $i['created_at'], $i['updated_at']]));
            }
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="axiora-items-' . today_iso() . '.csv"');
            echo "\u{FEFF}" . implode("\r\n", $lines);
            return;
        }
        if ($route === '/items' && $method === 'POST') {
            $id = create_item($db, $user, $in, $withFiles());
            json_out(201, ['id' => $id]);
            return;
        }
        if (preg_match('#^/items/(\d+)$#', $route, $m)) {
            $id = (int) $m[1];
            if ($method === 'GET') { json_out(200, get_item_detail($db, $id, $user)); return; }
            if ($method === 'PATCH') { update_item($db, $user, $id, $in); json_out(200, get_item_detail($db, $id, $user)); return; }
            if ($method === 'DELETE') { delete_item($db, $cfg, $user, $id); json_out(200, ['ok' => true]); return; }
        }
        if (preg_match('#^/items/(\d+)/actions/([a-z_]+)$#', $route, $m) && $method === 'POST') {
            perform_action($db, $user, (int) $m[1], $m[2], $in, $withFiles());
            json_out(200, get_item_detail($db, (int) $m[1], $user));
            return;
        }
        if (preg_match('#^/items/(\d+)/planning$#', $route, $m) && $method === 'POST') {
            set_planning_status($db, $user, (int) $m[1], $in['planning_status'] ?? null);
            json_out(200, get_item_detail($db, (int) $m[1], $user));
            return;
        }
        if (preg_match('#^/items/(\d+)/comments$#', $route, $m) && $method === 'POST') {
            add_comment($db, $user, (int) $m[1], $in, $withFiles());
            json_out(201, get_item_detail($db, (int) $m[1], $user));
            return;
        }
        if (preg_match('#^/items/(\d+)/attachments$#', $route, $m) && $method === 'POST') {
            add_item_attachments($db, $user, (int) $m[1], $withFiles());
            json_out(201, get_item_detail($db, (int) $m[1], $user));
            return;
        }
        if (preg_match('#^/attachments/(\d+)$#', $route, $m) && $method === 'GET') {
            if (!send_attachment($db, $cfg, (int) $m[1])) throw not_found('File not found.');
            return;
        }

        // ---- Dashboard & reports ----
        if ($route === '/dashboard' && $method === 'GET') { json_out(200, get_dashboard($db, $q, $user)); return; }
        if ($route === '/reports' && $method === 'GET') { json_out(200, get_reports($db, $q, $user)); return; }
        if ($route === '/ceo-dashboard' && $method === 'GET') { $requireAdmin(); json_out(200, get_ceo_dashboard($db, $q, $user)); return; }

        // ---- Administration ----
        if ($route === '/users') {
            $requireAdmin();
            if ($method === 'GET') { json_out(200, ['users' => list_users($db)]); return; }
            if ($method === 'POST') { json_out(201, ['id' => create_user($db, $user, $in)]); return; }
        }
        if (preg_match('#^/users/(\d+)$#', $route, $m) && $method === 'PATCH') {
            $requireAdmin();
            update_user($db, $user, (int) $m[1], $in);
            json_out(200, ['users' => list_users($db)]);
            return;
        }
        if ($route === '/workflow-permissions') {
            $requireAdmin();
            if ($method === 'GET') { json_out(200, ['permissions' => describe_permissions($db)]); return; }
            if ($method === 'PUT') { json_out(200, ['permissions' => save_permissions($db, $user, $in['permissions'] ?? null)]); return; }
        }
        if ($route === '/products') {
            $requireAdmin();
            if ($method === 'GET') { json_out(200, ['products' => list_products($db)]); return; }
            if ($method === 'POST') { save_product($db, $user, null, $in); json_out(201, ['products' => list_products($db)]); return; }
        }
        if (preg_match('#^/products/(\d+)$#', $route, $m) && $method === 'PATCH') {
            $requireAdmin();
            save_product($db, $user, (int) $m[1], $in);
            json_out(200, ['products' => list_products($db)]);
            return;
        }
        if ($route === '/modules' && $method === 'POST') {
            $requireAdmin();
            save_module($db, $user, null, $in);
            json_out(201, ['products' => list_products($db)]);
            return;
        }
        if (preg_match('#^/modules/(\d+)$#', $route, $m) && $method === 'PATCH') {
            $requireAdmin();
            save_module($db, $user, (int) $m[1], $in);
            json_out(200, ['products' => list_products($db)]);
            return;
        }
        throw not_found('Unknown API endpoint.');
    } catch (HttpError $e) {
        discard_files($files);
        json_out($e->status, ['error' => $e->getMessage()] + ($e->fields ? ['fields' => $e->fields] : []));
    } catch (\PDOException $e) {
        discard_files($files);
        if (str_contains($e->getMessage(), 'UNIQUE constraint')) { json_out(409, ['error' => 'This record already exists.']); return; }
        error_log('[axiora-tracker] ' . $e);
        json_out(500, ['error' => 'Something went wrong. Please try again.']);
    } catch (\Throwable $e) {
        discard_files($files);
        error_log('[axiora-tracker] ' . $e);
        json_out(500, ['error' => 'Something went wrong. Please try again.']);
    }
}
