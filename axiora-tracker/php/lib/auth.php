<?php
namespace Axt;

const COOKIE = 'axt_session';

function hash_password(string $password): string
{
    return password_hash($password, PASSWORD_DEFAULT);
}

function verify_password(string $password, string $stored): bool
{
    return password_verify($password, $stored);
}

function validate_password(mixed $password): ?string
{
    if (!is_string($password) || strlen($password) < 10) return 'Password must be at least 10 characters.';
    if (strlen($password) > 200) return 'Password is too long.';
    return null;
}

/** Expiry for a normal session: SESSION_IDLE_MINUTES from now, capped at SESSION_TTL_HOURS after sign-in. */
function idle_expiry(array $cfg, float $createdAt): string
{
    return now_iso(min(microtime(true) + $cfg['sessionIdleMinutes'] * 60, $createdAt + $cfg['sessionTtlHours'] * 3600));
}

function create_session(Db $db, array $cfg, int $userId, bool $remember = false): array
{
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $now = microtime(true);
    $expires = $remember ? now_iso($now + $cfg['rememberDays'] * 86400) : idle_expiry($cfg, $now);
    $db->run('DELETE FROM sessions WHERE expires_at <= ?', [now_iso()]);
    $db->run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, remember) VALUES (?, ?, ?, ?, ?)',
        [hash('sha256', $token), $userId, now_iso($now), $expires, $remember ? 1 : 0]);
    return [$token, $expires];
}

function destroy_session(Db $db, ?string $token): void
{
    if ($token) $db->run('DELETE FROM sessions WHERE token_hash = ?', [hash('sha256', $token)]);
}

function session_token(): ?string
{
    $t = $_COOKIE[COOKIE] ?? null;
    return is_string($t) && $t !== '' ? $t : null;
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}

/** A remembered sign-in gets a persistent cookie; otherwise it is a browser-session cookie. */
function set_session_cookie(array $cfg, string $basePath, string $token, string $expires, bool $persistent = false): void
{
    $secure = $cfg['cookieSecure'] === 'true' || ($cfg['cookieSecure'] === 'auto' && is_https());
    setcookie(COOKIE, $token, [
        'expires' => $persistent ? strtotime($expires) : 0, 'path' => $basePath, 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax',
    ]);
}

function clear_session_cookie(string $basePath): void
{
    setcookie(COOKIE, '', ['expires' => 1, 'path' => $basePath, 'httponly' => true, 'samesite' => 'Lax']);
}

/**
 * Returns ['user' => ..., 'remember' => bool] for a live session of an active user, or null.
 * Normal sessions slide: each request pushes the idle expiry forward (written at most once a
 * minute). Requests marked X-Session-Check (the browser's idle probe) do not count as activity.
 */
function load_user(Db $db, array $cfg): ?array
{
    $token = session_token();
    if (!$token) return null;
    $row = $db->one('SELECT u.id, u.name, u.email, u.role, s.token_hash, s.remember, s.created_at, s.expires_at
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1', [hash('sha256', $token), now_iso()]);
    if (!$row) return null;
    if (!$row['remember'] && ($_SERVER['HTTP_X_SESSION_CHECK'] ?? '') !== '1') {
        $extended = idle_expiry($cfg, (float) (new \DateTimeImmutable($row['created_at']))->format('U.u'));
        // Write at most about once a minute (sooner for very short idle times).
        $gap = (float) (new \DateTimeImmutable($extended))->format('U.u') - (float) (new \DateTimeImmutable($row['expires_at']))->format('U.u');
        if ($gap > min(60, $cfg['sessionIdleMinutes'] * 6)) {
            $db->run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', [$extended, $row['token_hash']]);
        }
    }
    return ['user' => ['id' => $row['id'], 'name' => $row['name'], 'email' => $row['email'], 'role' => $row['role']], 'remember' => (bool) $row['remember']];
}
