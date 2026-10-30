<?php
// Local development / test router for PHP's built-in server, mimicking the live layout:
//   php -S 127.0.0.1:8080 php/dev-router.php   →  http://127.0.0.1:8080/qa/
$root = dirname(__DIR__);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
if ($path === '/' || $path === '/qa') { header('Location: /qa/'); return true; }
if (!str_starts_with($path, '/qa/')) { http_response_code(404); echo 'Not found'; return true; }

$rel = substr($path, 4);
$public = realpath("$root/public");
$file = $rel !== '' ? realpath("$public/$rel") : false;
if ($file && str_starts_with($file, $public) && is_file($file) && basename($file) !== 'index.html') {
    $types = ['js' => 'text/javascript', 'css' => 'text/css', 'svg' => 'image/svg+xml', 'png' => 'image/png'];
    header('Content-Type: ' . ($types[pathinfo($file, PATHINFO_EXTENSION)] ?? 'application/octet-stream'));
    readfile($file);
    return true;
}
require "$root/php/app.php";
\Axt\run($root, '/qa');
return true;
