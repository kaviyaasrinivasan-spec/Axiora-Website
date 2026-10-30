<?php
// Command-line maintenance for the PHP deployment.
//   php php/cli.php migrate
//   AXT_PASSWORD='…' php php/cli.php create-user --name "Jane" --email jane@x.com --role admin
//   php php/cli.php create-product --name CARGORA
// Passwords come from the AXT_PASSWORD environment variable so they never appear in the process list.
namespace Axt;

if (PHP_SAPI !== 'cli') exit(1);
require __DIR__ . '/app.php';

$root = dirname(__DIR__);
$cfg = load_config($root);
$db = Db::open($cfg['dbFile']);
$applied = $db->migrate($root . '/migrations');
$cmd = $argv[1] ?? 'migrate';
$opts = [];
for ($i = 2; $i < $argc; $i++) {
    if (str_starts_with($argv[$i], '--')) $opts[substr($argv[$i], 2)] = $argv[++$i] ?? '';
}

try {
    switch ($cmd) {
        case 'migrate':
            echo $applied ? 'Applied: ' . implode(', ', $applied) . PHP_EOL : 'Database is up to date.' . PHP_EOL;
            echo "Database: {$cfg['dbFile']}" . PHP_EOL;
            break;
        case 'create-user':
            $id = create_user($db, null, ['name' => $opts['name'] ?? '', 'email' => $opts['email'] ?? '', 'role' => $opts['role'] ?? '',
                'password' => getenv('AXT_PASSWORD') ?: '']);
            echo json_encode(['id' => $id]) . PHP_EOL;
            break;
        case 'set-password':
            $pw = getenv('AXT_PASSWORD') ?: '';
            if ($err = validate_password($pw)) throw bad_request($err);
            $emails = ($opts['email'] ?? '') === '*' ? array_column($db->all('SELECT email FROM users'), 'email') : [strtolower($opts['email'] ?? '')];
            foreach ($emails as $email) {
                if (!$db->one('SELECT id FROM users WHERE email = ?', [$email])) throw not_found("No user with email $email.");
                $db->run('UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?', [hash_password($pw), now_iso(), $email]);
                $db->run('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)', [$email]);
            }
            echo json_encode(['updated' => count($emails)]) . PHP_EOL;
            break;
        case 'create-product':
            $id = save_product($db, ['id' => null], null, ['name' => $opts['name'] ?? '']);
            echo json_encode(['id' => $id]) . PHP_EOL;
            break;
        default:
            fwrite(STDERR, "Unknown command: $cmd\n");
            exit(1);
    }
} catch (HttpError $e) {
    fwrite(STDERR, $e->getMessage() . ($e->fields ? ' ' . json_encode($e->fields) : '') . PHP_EOL);
    exit(1);
}
