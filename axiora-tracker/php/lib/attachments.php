<?php
namespace Axt;

// Extension allow-list; the stored MIME type comes from it, never from the client.
const FILE_TYPES = [
    'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'webp' => 'image/webp',
    'pdf' => 'application/pdf', 'txt' => 'text/plain', 'log' => 'text/plain', 'md' => 'text/plain', 'csv' => 'text/csv',
    'json' => 'application/json', 'zip' => 'application/zip',
    'doc' => 'application/msword', 'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' => 'application/vnd.ms-excel', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt' => 'application/vnd.ms-powerpoint', 'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const INLINE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];

function file_ext(string $name): string
{
    return strtolower(pathinfo($name, PATHINFO_EXTENSION));
}

/**
 * Validates and moves the request's "files" uploads into the upload directory.
 * Returns [['originalname','filename','size','path'], ...]. Throws 400 on any invalid file.
 */
function accept_uploads(array $cfg): array
{
    $f = $_FILES['files'] ?? null;
    if (!$f) return [];
    $list = [];
    if (is_array($f['name'])) {
        foreach ($f['name'] as $i => $name) {
            $list[] = ['name' => $name, 'tmp' => $f['tmp_name'][$i], 'size' => $f['size'][$i], 'error' => $f['error'][$i]];
        }
    } else {
        $list[] = ['name' => $f['name'], 'tmp' => $f['tmp_name'], 'size' => $f['size'], 'error' => $f['error']];
    }
    $list = array_values(array_filter($list, fn ($x) => $x['error'] !== UPLOAD_ERR_NO_FILE));
    if (count($list) > $cfg['maxFilesPerUpload']) throw bad_request("You can attach up to {$cfg['maxFilesPerUpload']} files at a time.");
    $maxBytes = $cfg['maxUploadMb'] * 1024 * 1024;
    $tooBig = 'Each file must be ' . rtrim(rtrim(number_format($cfg['maxUploadMb'], 1), '0'), '.') . ' MB or smaller.';
    foreach ($list as $x) {
        if (in_array($x['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || $x['size'] > $maxBytes) throw bad_request($tooBig);
        if ($x['error'] !== UPLOAD_ERR_OK) throw bad_request('The upload could not be processed.');
        if (!isset(FILE_TYPES[file_ext($x['name'])])) {
            throw bad_request(sprintf('"%s" is not an allowed file type. Allowed: %s.', basename($x['name']), implode(', ', array_keys(FILE_TYPES))));
        }
    }
    if (!is_dir($cfg['uploadDir'])) mkdir($cfg['uploadDir'], 0750, true);
    $saved = [];
    foreach ($list as $x) {
        $stored = bin2hex(random_bytes(16)) . '.' . file_ext($x['name']);
        $dest = $cfg['uploadDir'] . '/' . $stored;
        if (!move_uploaded_file($x['tmp'], $dest)) {
            discard_files($saved);
            throw bad_request('The upload could not be processed.');
        }
        $saved[] = ['originalname' => basename(str_replace('\\', '/', $x['name'])), 'filename' => $stored, 'size' => (int) $x['size'], 'path' => $dest];
    }
    return $saved;
}

function discard_files(array $files): void
{
    foreach ($files as $f) @unlink($f['path']);
}

function save_attachments(Db $db, array $files, array $o): array
{
    $ids = [];
    foreach ($files as $f) {
        $name = mb_substr($f['originalname'], 0, 200);
        $ids[] = $db->run('INSERT INTO attachments (item_id, release_id, context, ref_id, original_name, stored_name, mime, size, uploaded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            $o['itemId'] ?? null, $o['releaseId'] ?? null, $o['context'], $o['refId'] ?? null, $name, $f['filename'],
            FILE_TYPES[file_ext($name)], $f['size'], $o['userId'], now_iso(),
        ]);
    }
    return $ids;
}

function list_attachments(Db $db, string $where, int $value): array
{
    $col = $where === 'release_id' ? 'release_id' : 'item_id';
    return $db->all("SELECT a.id, a.item_id, a.release_id, a.context, a.ref_id, a.original_name, a.mime, a.size,
            a.created_at, u.name AS uploaded_by_name
        FROM attachments a JOIN users u ON u.id = a.uploaded_by WHERE a.$col = ? ORDER BY a.id", [$value]);
}

function send_attachment(Db $db, array $cfg, int $id): bool
{
    $a = $db->one('SELECT * FROM attachments WHERE id = ?', [$id]);
    if (!$a) return false;
    $file = $cfg['uploadDir'] . '/' . basename($a['stored_name']);
    if (!is_file($file)) return false;
    $disposition = in_array($a['mime'], INLINE_TYPES, true) ? 'inline' : 'attachment';
    header('Content-Type: ' . $a['mime']);
    header("Content-Disposition: $disposition; filename*=UTF-8''" . rawurlencode($a['original_name']));
    header("Content-Security-Policy: sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
    header('Cache-Control: private, max-age=3600');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    return true;
}
