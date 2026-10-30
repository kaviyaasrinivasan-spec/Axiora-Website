<?php
namespace Axt;

// Dashboard and reports honour the item-list filters (minus status/view), so every card
// count equals the row count of the list it links to.
const FILTER_KEYS = ['product', 'category', 'assigned_to', 'priority', 'requested_by', 'from', 'to'];

function scoped_filter(array $q, array $user): array
{
    $f = [];
    foreach (FILTER_KEYS as $k) if (isset($q[$k]) && $q[$k] !== '') $f[$k] = $q[$k];
    return build_filter($f, $user);
}

const BRIEF = 'i.id, i.item_key, i.title, i.category, i.priority, i.status, i.due_date, i.updated_at, p.name AS product_name, u.name AS assigned_name';
const BRIEF_FROM = 'FROM items i JOIN products p ON p.id = i.product_id LEFT JOIN users u ON u.id = i.assigned_to';

function pairs(array $rows, string $k): object
{
    $o = [];
    foreach ($rows as $r) $o[$r[$k]] = $r['n'];
    return (object) $o;
}

function get_dashboard(Db $db, array $q, array $user): array
{
    [$sql, $params] = scoped_filter($q, $user);
    $and = $sql ? "$sql AND" : 'WHERE';
    $all = fn (string $query, array $extra = []) => $db->all($query, [...$params, ...$extra]);
    $count = fn (string $cond, array $extra = []) => (int) $db->value("SELECT COUNT(*) FROM items i $and $cond", [...$params, ...$extra]);

    $byStatus = (array) pairs($all("SELECT i.status, COUNT(*) AS n FROM items i $sql GROUP BY i.status"), 'status');
    $byCategory = (array) pairs($all("SELECT i.category, COUNT(*) AS n FROM items i $sql GROUP BY i.category"), 'category');
    $sum = fn (array $statuses) => array_sum(array_map(fn ($s) => $byStatus[$s] ?? 0, $statuses));
    $today = today_iso();
    $awaiting = sql_list(GROUP_AWAITING_QA);

    return [
        'cards' => [
            'requirements' => $byCategory['requirement'] ?? 0,
            'defects' => $byCategory['defect'] ?? 0,
            'total' => ($byCategory['requirement'] ?? 0) + ($byCategory['defect'] ?? 0),
            'new' => $sum(['new']),
            'in_development' => $sum(GROUP_IN_DEVELOPMENT),
            'awaiting_qa' => $sum(GROUP_AWAITING_QA),
            'qa_rejected' => $sum(['qa_rejected']),
            'qa_approved' => $sum(['qa_approved']),
            'ready_for_production' => $sum(['ready_for_production']),
            'deployed' => $sum(['deployed']),
            'verified' => $sum(['verified']),
        ],
        'byStatus' => (object) $byStatus,
        'openByPriority' => pairs($all("SELECT i.priority, COUNT(*) AS n FROM items i $and i.status NOT IN ('deployed', 'verified') GROUP BY i.priority"), 'priority'),
        'byProduct' => $all("SELECT p.id, p.name, COUNT(*) AS total, SUM(i.status NOT IN ('deployed', 'verified')) AS open
            FROM items i JOIN products p ON p.id = i.product_id $sql GROUP BY p.id ORDER BY total DESC"),
        'byDeveloper' => $all("SELECT u.id, u.name,
                SUM(i.status IN ('assigned', 'in_development', 'self_test', 'qa_rejected')) AS with_developer,
                SUM(i.status IN ($awaiting)) AS in_qa,
                SUM(i.status = 'qa_rejected') AS rejected,
                SUM(i.status IN ('qa_approved', 'ready_for_production')) AS approved,
                SUM(i.status IN ('deployed', 'verified')) AS deployed,
                COUNT(*) AS total
            FROM items i JOIN users u ON u.id = i.assigned_to $sql GROUP BY u.id ORDER BY with_developer DESC, total DESC"),
        'awaitingQa' => $all('SELECT ' . BRIEF . ' ' . BRIEF_FROM . " $and i.status IN ($awaiting) ORDER BY i.updated_at ASC LIMIT 8"),
        'urgentDefects' => [
            'total' => $count("i.category = 'defect' AND i.priority IN ('blocker', 'critical', 'high') AND i.status NOT IN ('deployed', 'verified')"),
            'items' => $all('SELECT ' . BRIEF . ' ' . BRIEF_FROM . " $and i.category = 'defect' AND i.priority IN ('blocker', 'critical', 'high') AND i.status NOT IN ('deployed', 'verified')
                ORDER BY i.priority = 'blocker' DESC, i.priority = 'critical' DESC, i.created_at ASC LIMIT 8"),
        ],
        'recent' => $all('SELECT ' . BRIEF . ' ' . BRIEF_FROM . " $sql ORDER BY i.updated_at DESC LIMIT 8"),
        'overdue' => [
            'total' => $count("i.due_date < ? AND i.status NOT IN ('deployed', 'verified')", [$today]),
            'items' => $all('SELECT ' . BRIEF . ' ' . BRIEF_FROM . " $and i.due_date < ? AND i.status NOT IN ('deployed', 'verified') ORDER BY i.due_date ASC LIMIT 8", [$today]),
        ],
    ];
}

/**
 * Report date range (?from=&to=, calendar dates in the viewer's time zone; ?tz= is their
 * getTimezoneOffset() in minutes). Returns a closure giving the SQL condition "column falls
 * in the range". The bounds are ISO instants computed here, never user text, so inlining them is safe.
 */
function report_range(array $q): \Closure
{
    return range_parts($q)['during'];
}

/** The parsed range: dates, the viewer's UTC offset, `between(start, end)` and `during(col)`. */
function range_parts(array $q): array
{
    $tz = $q['tz'] ?? '0';
    $offset = is_string($tz) && preg_match('/^-?\d{1,3}$/', $tz) && abs((int) $tz) <= 840 ? (int) $tz : 0;
    $from = is_date($q['from'] ?? null) ? $q['from'] : null;
    $to = is_date($q['to'] ?? null) ? $q['to'] : null;
    if ($from && $to && $from > $to) throw bad_request('The start date must be on or before the end date.', ['from' => 'Start date is after the end date.']);
    $at = fn (string $date, int $days = 0) => now_iso((float) (strtotime($date . 'T00:00:00Z') + ($days * 1440 + $offset) * 60));
    $between = function (?string $start, ?string $end) use ($at): \Closure {
        $bounds = [];
        if ($start) $bounds[] = ['>=', $at($start)];
        if ($end) $bounds[] = ['<', $at($end, 1)];
        return fn (string $col) => $bounds ? implode(' AND ', array_map(fn ($b) => "$col {$b[0]} '{$b[1]}'", $bounds)) : '1 = 1';
    };
    return ['from' => $from, 'to' => $to, 'offset' => $offset, 'between' => $between, 'during' => $between($from, $to)];
}

// The date range applies to when each thing happened: items by creation date, QA results,
// self-tests and moves to production by the time they were recorded.
function get_reports(Db $db, array $q, array $user): array
{
    [$sql, $params] = scoped_filter(['product' => $q['product'] ?? '', 'category' => $q['category'] ?? ''], $user);
    $and = $sql ? "$sql AND" : 'WHERE';
    $all = fn (string $query) => $db->all($query, $params);
    $during = report_range($q);

    $qa = $db->one("SELECT COUNT(*) AS total, SUM(v.result = 'approved') AS approved, SUM(v.result = 'rejected') AS rejected
        FROM qa_verifications v JOIN items i ON i.id = v.item_id $and {$during('v.created_at')}", $params);
    $first = $db->one("SELECT COUNT(*) AS verified, SUM(first.result = 'approved') AS first_pass FROM items i
        JOIN qa_verifications first ON first.id = (SELECT MIN(id) FROM qa_verifications WHERE item_id = i.id) $and {$during('first.created_at')}", $params);

    $perDeveloper = [
        'assigned' => "SELECT i.assigned_to AS uid, COUNT(*) AS n FROM items i $and i.assigned_to IS NOT NULL AND {$during('i.created_at')} GROUP BY uid",
        'deployed' => "SELECT i.assigned_to AS uid, COUNT(*) AS n FROM items i $and i.assigned_to IS NOT NULL AND i.status IN ('deployed', 'verified') AND {$during('i.deployed_at')} GROUP BY uid",
        'self_test_failures' => "SELECT s.created_by AS uid, COUNT(*) AS n FROM self_tests s JOIN items i ON i.id = s.item_id
            $and s.result = 'failed' AND s.created_by = i.assigned_to AND {$during('s.created_at')} GROUP BY uid",
        'qa_rejections' => "SELECT i.assigned_to AS uid, COUNT(*) AS n FROM qa_verifications v JOIN items i ON i.id = v.item_id
            $and v.result = 'rejected' AND i.assigned_to IS NOT NULL AND {$during('v.created_at')} GROUP BY uid",
    ];
    $devs = [];
    foreach ($perDeveloper as $key => $query) {
        foreach ($all($query) as $r) {
            $devs[$r['uid']] ??= ['assigned' => 0, 'deployed' => 0, 'self_test_failures' => 0, 'qa_rejections' => 0];
            $devs[$r['uid']][$key] = (int) $r['n'];
        }
    }
    $names = array_column($db->all('SELECT id, name FROM users'), 'name', 'id');
    $developers = [];
    foreach ($devs as $uid => $x) $developers[] = ['name' => $names[$uid] ?? ''] + $x;
    usort($developers, fn ($a, $b) => $b['assigned'] <=> $a['assigned'] ?: strcmp($a['name'], $b['name']));

    return [
        'matrix' => $all("SELECT p.name AS product, i.status, COUNT(*) AS n FROM items i JOIN products p ON p.id = i.product_id
            $and {$during('i.created_at')} GROUP BY p.name, i.status ORDER BY p.name"),
        'qa' => $qa + ['verified_items' => $first['verified'], 'first_pass' => $first['first_pass'] ?? 0],
        'mostRejected' => $all("SELECT i.id, i.item_key, i.title, i.status, u.name AS assigned_name, COUNT(v.id) AS rejections
            FROM items i JOIN qa_verifications v ON v.item_id = i.id AND v.result = 'rejected' AND {$during('v.created_at')} LEFT JOIN users u ON u.id = i.assigned_to
            $sql GROUP BY i.id ORDER BY rejections DESC, i.id DESC LIMIT 10"),
        'developers' => $developers,
        'cycleTime' => $all("SELECT i.category, COUNT(*) AS deployed, ROUND(AVG(julianday(i.deployed_at) - julianday(i.created_at)), 1) AS avg_days
            FROM items i $and i.status IN ('deployed', 'verified') AND {$during('i.deployed_at')} GROUP BY i.category"),
    ];
}
