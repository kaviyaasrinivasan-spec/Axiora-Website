<?php
namespace Axt;

final class HttpError extends \Exception
{
    public function __construct(public int $status, string $message, public ?array $fields = null)
    {
        parent::__construct($message);
    }
}

function bad_request(string $m, ?array $fields = null): HttpError { return new HttpError(400, $m, $fields); }
function forbidden(string $m = 'You do not have permission to do this.'): HttpError { return new HttpError(403, $m); }
function not_found(string $m = 'Not found.'): HttpError { return new HttpError(404, $m); }
function conflict(string $m): HttpError { return new HttpError(409, $m); }

/** ISO-8601 UTC with milliseconds, identical to JavaScript's toISOString(). */
function now_iso(?float $t = null): string
{
    $d = \DateTime::createFromFormat('U.u', sprintf('%.6F', $t ?? microtime(true)), new \DateTimeZone('UTC'));
    return $d->format('Y-m-d\TH:i:s.v\Z');
}

function today_iso(): string { return gmdate('Y-m-d'); }

function str(mixed $v, int $max = 10000): string
{
    if ($v === null || is_array($v)) return '';
    return mb_substr(trim((string) $v), 0, $max);
}

function opt_str(mixed $v, int $max = 10000): ?string
{
    $s = str($v, $max);
    return $s === '' ? null : $s;
}

function int_or_null(mixed $v): ?int
{
    if ($v === null || $v === '' || is_array($v) || is_bool($v)) return null;
    if (is_int($v)) return $v > 0 ? $v : null;
    if (is_float($v)) return ($v > 0 && floor($v) == $v) ? (int) $v : null;
    return preg_match('/^\d+$/', (string) $v) && (int) $v > 0 ? (int) $v : null;
}

function is_date(mixed $v): bool
{
    if (!is_string($v) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return false;
    [$y, $m, $d] = array_map('intval', explode('-', $v));
    return checkdate($m, $d, $y);
}

function truthy(mixed $v): bool
{
    return $v === true || $v === 1 || in_array($v, ['true', '1', 'on'], true);
}

function next_day(string $date): string
{
    return gmdate('Y-m-d', strtotime($date . 'T00:00:00Z') + 86400);
}

function like_escape(string $s): string
{
    return preg_replace('/[\\\\%_]/', '\\\\$0', $s);
}
