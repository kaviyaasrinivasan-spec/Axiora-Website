<?php
namespace Axt;

function log_activity(Db $db, array $a): void
{
    $details = $a['details'] ?? null;
    $db->run('INSERT INTO activity (item_id, release_id, user_id, action, from_status, to_status, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        $a['itemId'] ?? null, $a['releaseId'] ?? null, $a['userId'] ?? null, $a['action'],
        $a['from'] ?? null, $a['to'] ?? null,
        $details ? json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null, now_iso(),
    ]);
}

function list_activity(Db $db, string $where, int $value): array
{
    $col = $where === 'release_id' ? 'release_id' : 'item_id';
    $rows = $db->all("SELECT a.id, a.item_id, a.release_id, a.action, a.from_status, a.to_status, a.details, a.created_at,
            u.name AS user_name, i.item_key
        FROM activity a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN items i ON i.id = a.item_id
        WHERE a.$col = ? ORDER BY a.id", [$value]);
    foreach ($rows as &$r) $r['details'] = $r['details'] ? json_decode($r['details'], false) : null;
    return $rows;
}
