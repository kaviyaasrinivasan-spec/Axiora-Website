<?php
namespace Axt;

use PDO;

final class Db
{
    private int $depth = 0;

    public function __construct(public PDO $pdo) {}

    public static function open(string $file): self
    {
        if ($file !== ':memory:' && !is_dir(dirname($file))) mkdir(dirname($file), 0750, true);
        $pdo = new PDO('sqlite:' . $file, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
        if ($file !== ':memory:') $pdo->exec('PRAGMA journal_mode = WAL;');
        return new self($pdo);
    }

    public function all(string $sql, array $params = []): array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute(array_values($params));
        return $st->fetchAll();
    }

    public function one(string $sql, array $params = []): ?array
    {
        $st = $this->pdo->prepare($sql);
        $st->execute(array_values($params));
        $row = $st->fetch();
        return $row === false ? null : $row;
    }

    public function value(string $sql, array $params = []): mixed
    {
        $row = $this->one($sql, $params);
        return $row === null ? null : reset($row);
    }

    /** Executes a write and returns the last insert id. */
    public function run(string $sql, array $params = []): int
    {
        $st = $this->pdo->prepare($sql);
        $st->execute(array_values($params));
        return (int) $this->pdo->lastInsertId();
    }

    /** Runs $fn inside a write transaction; nested calls join the outer one. */
    public function tx(callable $fn): mixed
    {
        if ($this->depth > 0) return $fn();
        $this->pdo->exec('BEGIN IMMEDIATE');
        $this->depth++;
        try {
            $result = $fn();
            $this->depth--;
            $this->pdo->exec('COMMIT');
            return $result;
        } catch (\Throwable $e) {
            $this->depth--;
            $this->pdo->exec('ROLLBACK');
            throw $e;
        }
    }

    /** Applies every migrations/*.sql file not yet recorded, in filename order. */
    public function migrate(string $dir): array
    {
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
        $applied = array_column($this->all('SELECT name FROM schema_migrations'), 'name');
        $files = glob(rtrim($dir, '/') . '/*.sql');
        sort($files);
        $pending = array_values(array_filter($files, fn ($p) => !in_array(basename($p), $applied, true)));
        if (!$pending) return [];
        // Table rebuilds (SQLite's ALTER procedure) need foreign-key enforcement off; integrity is
        // verified before each migration commits.
        $this->pdo->exec('PRAGMA foreign_keys = OFF');
        $done = [];
        try {
            foreach ($pending as $path) {
                $name = basename($path);
                $sql = file_get_contents($path);
                $this->tx(function () use ($sql, $name) {
                    $this->pdo->exec($sql);
                    $broken = $this->all('PRAGMA foreign_key_check');
                    if ($broken) throw new \RuntimeException("Migration $name broke " . count($broken) . ' foreign key reference(s).');
                    $this->run('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)', [$name, now_iso()]);
                });
                $done[] = $name;
            }
        } finally {
            $this->pdo->exec('PRAGMA foreign_keys = ON');
        }
        return $done;
    }
}
