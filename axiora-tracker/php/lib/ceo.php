<?php
namespace Axt;

// CEO dashboard: what happened in a period (from the activity trail, so every number is a
// recorded event) plus a snapshot of where things stand now. All figures honour the
// product / type / developer / priority filters.

/** Workflow events counted in the KPI cards: the status an item moved into. */
const CEO_MOVES = [
    'moved_to_development' => 'in_development',
    'moved_to_qa' => 'ready_for_qa',
    'qa_approved' => 'qa_approved',
    'deployed' => 'deployed',
];

function add_days(string $date, int $n): string
{
    return gmdate('Y-m-d', strtotime($date . 'T00:00:00Z') + $n * 86400);
}

function days_between(string $a, string $b): int
{
    return (int) round((strtotime($b . 'T00:00:00Z') - strtotime($a . 'T00:00:00Z')) / 86400);
}

function get_ceo_dashboard(Db $db, array $q, array $user): array
{
    $f = [];
    foreach (['product', 'category', 'assigned_to', 'priority'] as $k) if (isset($q[$k]) && $q[$k] !== '') $f[$k] = $q[$k];
    [$sql, $params] = build_filter($f, $user);
    $and = $sql ? "$sql AND" : 'WHERE';
    $parts = range_parts($q);
    $between = $parts['between'];
    $today = gmdate('Y-m-d', time() - $parts['offset'] * 60);
    $from = $parts['from'] ?? $parts['to'] ?? $today;
    $to = $parts['to'] ?? ($parts['from'] ? $today : $from);
    $length = days_between($from, $to) + 1;
    $previous = ['from' => add_days($from, -$length), 'to' => add_days($from, -1)];
    $current = $between($from, $to);
    $before = $between($previous['from'], $previous['to']);

    $one = fn (string $query, array $extra = []) => (int) $db->value($query, [...$params, ...$extra]);
    $all = fn (string $query) => $db->all($query, $params);
    $created = fn (string $category, \Closure $during) => $one("SELECT COUNT(*) FROM items i $and i.category = '$category' AND {$during('i.created_at')}");
    $movedFrom = "FROM activity a JOIN items i ON i.id = a.item_id $and";
    $movedInto = fn (string $status, \Closure $during) => "a.to_status = '$status' AND (a.from_status IS NULL OR a.from_status <> a.to_status) AND {$during('a.created_at')}";
    $moved = fn (string $status, \Closure $during) => $one("SELECT COUNT(DISTINCT a.item_id) $movedFrom {$movedInto($status, $during)}");

    $kpi = fn (\Closure $fn) => ['value' => $fn($current), 'previous' => $fn($before)];
    $kpis = [
        'new_requirements' => $kpi(fn ($d) => $created('requirement', $d)),
        'new_defects' => $kpi(fn ($d) => $created('defect', $d)),
    ];
    foreach (CEO_MOVES as $key => $status) $kpis[$key] = $kpi(fn ($d) => $moved($status, $d));

    // Trend charts cover the selected period, widened to at least the last 7 days so a single
    // day still shows a trend. Long periods are grouped by month.
    $chartFrom = $length < 7 ? add_days($to, -6) : $from;
    $unit = days_between($chartFrom, $to) + 1 <= 62 ? 'day' : 'month';
    $shift = -$parts['offset'];
    $bucket = function (string $col) use ($shift, $unit) {
        $local = "date($col, '" . ($shift >= 0 ? '+' : '') . "$shift minutes')";
        return $unit === 'day' ? $local : "substr($local, 1, 7)";
    };
    $buckets = [];
    for ($d = $chartFrom; $d <= $to; $d = add_days($d, 1)) {
        $b = $unit === 'day' ? $d : substr($d, 0, 7);
        if (end($buckets) !== $b) $buckets[] = $b;
    }
    $series = function (array $rows) use ($buckets) {
        $n = [];
        foreach ($rows as $r) $n[$r['b']][$r['category']] = (int) $r['n'];
        return array_map(fn ($b) => ['bucket' => $b, 'requirement' => $n[$b]['requirement'] ?? 0, 'defect' => $n[$b]['defect'] ?? 0], $buckets);
    };
    $chartRange = $between($chartFrom, $to);

    $byCategory = function (string $status) use ($all, $movedFrom, $movedInto, $current) {
        $out = [];
        foreach ($all("SELECT i.category, COUNT(DISTINCT a.item_id) AS n $movedFrom {$movedInto($status, $current)} GROUP BY i.category") as $r) $out[$r['category']] = (int) $r['n'];
        return $out;
    };
    $statusRows = [];
    foreach ($all("SELECT i.status, COUNT(*) AS n FROM items i $sql GROUP BY i.status") as $r) $statusRows[$r['status']] = (int) $r['n'];
    $statusNow = [];
    foreach (array_keys(STATUSES) as $s) $statusNow[$s] = $statusRows[$s] ?? 0;
    $count = fn (string $cond) => $one("SELECT COUNT(*) FROM items i $and $cond");
    $inDev = sql_list(['assigned', ...GROUP_IN_DEVELOPMENT]);
    $awaitingQa = sql_list(GROUP_AWAITING_QA);
    $production = sql_list(GROUP_PRODUCTION_QUEUE);

    $completed = [];
    foreach ([['dev_complete', 'ready_for_qa'], ['qa_approved', 'qa_approved'], ['deployed', 'deployed']] as [$key, $status]) {
        $c = $byCategory($status);
        $completed[] = ['key' => $key, 'requirement' => $c['requirement'] ?? 0, 'defect' => $c['defect'] ?? 0];
    }

    return [
        'range' => ['from' => $from, 'to' => $to, 'days' => $length, 'previous' => $previous, 'chart' => ['from' => $chartFrom, 'to' => $to, 'unit' => $unit]],
        'kpis' => $kpis,
        'raised' => $series($all("SELECT {$bucket('i.created_at')} AS b, i.category, COUNT(*) AS n FROM items i
            $and {$chartRange('i.created_at')} GROUP BY b, i.category")),
        'deployments' => $series($all("SELECT {$bucket('a.created_at')} AS b, i.category, COUNT(DISTINCT a.item_id) AS n
            $movedFrom {$movedInto('deployed', $chartRange)} GROUP BY b, i.category")),
        'statusNow' => (object) $statusNow,
        'developers' => $all("SELECT u.id, u.name, COUNT(DISTINCT a.item_id) AS deployed
            FROM activity a JOIN items i ON i.id = a.item_id JOIN users u ON u.id = i.assigned_to
            $and {$movedInto('deployed', $current)} GROUP BY u.id ORDER BY deployed DESC, u.name"),
        'completed' => $completed,
        'pending' => [
            'unassigned' => $count("i.status = 'new'"),
            'overdue_development' => $one("SELECT COUNT(*) FROM items i $and i.status IN ($inDev) AND i.due_date < ?", [$today]),
            'awaiting_qa' => $count("i.status IN ($awaitingQa)"),
            'qa_rejected' => $count("i.status = 'qa_rejected'"),
            'awaiting_production' => $count("i.status IN ($production)"),
            'critical_defects' => $count("i.category = 'defect' AND i.priority IN ('blocker', 'critical') AND i.status NOT IN ('deployed', 'verified')"),
        ],
        'today' => $today,
        'recent' => $all("SELECT i.id, i.item_key, i.title, i.category, i.priority, i.status, p.name AS product_name,
                dev.name AS assigned_name, dep.name AS completed_by_name, a.created_at AS completed_at
            FROM activity a JOIN items i ON i.id = a.item_id JOIN products p ON p.id = i.product_id
            LEFT JOIN users dev ON dev.id = i.assigned_to LEFT JOIN users dep ON dep.id = a.user_id
            $and {$movedInto('deployed', $current)} ORDER BY a.created_at DESC, a.id DESC LIMIT 10"),
    ];
}
