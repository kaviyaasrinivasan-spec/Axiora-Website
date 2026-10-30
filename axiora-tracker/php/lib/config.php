<?php
namespace Axt;

/** Reads KEY=value lines from the app's .env file into an array (real env vars win). */
function load_config(string $root): array
{
    $env = [];
    $file = $root . '/.env';
    if (is_file($file)) {
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (preg_match('/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/', $line, $m)) {
                $env[$m[1]] = trim($m[2], "\"'");
            }
        }
    }
    $get = function (string $k, string $default = '') use ($env): string {
        $v = getenv($k);
        return $v !== false && $v !== '' ? $v : ($env[$k] ?? $default);
    };
    $abs = fn (string $p, string $base) => preg_match('#^(/|[A-Za-z]:[\\\\/])#', $p) ? $p : $base . '/' . $p;
    $dataDir = $abs($get('DATA_DIR', 'data'), $root);
    return [
        'root' => $root,
        'env' => $get('NODE_ENV', $get('APP_ENV', 'production')),
        'dataDir' => $dataDir,
        'dbFile' => $abs($get('DB_FILE', 'tracker.db'), $dataDir),
        'uploadDir' => $abs($get('UPLOAD_DIR', 'uploads'), $dataDir),
        'sessionIdleMinutes' => (float) $get('SESSION_IDLE_MINUTES', '30'),
        'sessionTtlHours' => (float) $get('SESSION_TTL_HOURS', '12'),
        'rememberDays' => (float) $get('REMEMBER_DAYS', '30'),
        'cookieSecure' => strtolower($get('COOKIE_SECURE', 'auto')),
        'maxUploadMb' => (float) $get('MAX_UPLOAD_MB', '10'),
        // Never above PHP's own max_file_uploads, or PHP would silently drop the extra files.
        'maxFilesPerUpload' => min((int) $get('MAX_FILES_PER_UPLOAD', '50'), (int) (ini_get('max_file_uploads') ?: 20)),
    ];
}
