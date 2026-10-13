<?php

namespace App\ClickHouse;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Minimal ClickHouse client over the HTTP interface.
 *
 * Bindings use ClickHouse server-side parameters: write `{name:Type}` in the
 * SQL and pass ['name' => value]. Values never get interpolated into SQL.
 */
class ClickHouse
{
    public function __construct(
        private string $url,
        private string $database,
        private string $username,
        private string $password,
        private int $timeout = 30,
    ) {
        //
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    public function select(string $sql, array $bindings = []): array
    {
        $response = $this->request($bindings)
            ->withBody(rtrim($sql, "; \n").' FORMAT JSON', 'text/plain')
            ->post($this->url.'/');

        $this->throwIfFailed($response, $sql);

        return $response->json('data') ?? [];
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>|null
     */
    public function first(string $sql, array $bindings = []): ?array
    {
        return $this->select($sql, $bindings)[0] ?? null;
    }

    /**
     * @param  array<string, mixed>  $bindings
     */
    public function value(string $sql, array $bindings = []): mixed
    {
        $row = $this->first($sql, $bindings);

        return $row === null ? null : reset($row);
    }

    /**
     * Create the configured database if it does not exist. Runs against the
     * server's default database, since the configured one may be missing.
     */
    public function ensureDatabase(): void
    {
        $response = $this->http()
            ->withQueryParameters(['database' => 'default'])
            ->withBody('CREATE DATABASE IF NOT EXISTS `'.str_replace('`', '', $this->database).'`', 'text/plain')
            ->post($this->url.'/');

        $this->throwIfFailed($response, 'CREATE DATABASE');
    }

    /**
     * @param  array<string, mixed>  $bindings
     */
    public function statement(string $sql, array $bindings = []): void
    {
        $response = $this->request($bindings)
            ->withBody($sql, 'text/plain')
            ->post($this->url.'/');

        $this->throwIfFailed($response, $sql);
    }

    /**
     * Insert rows with JSONEachRow. Uses async inserts so many small batches
     * from agents get merged server side.
     *
     * @param  list<array<string, mixed>>  $rows
     */
    public function insert(string $table, array $rows): void
    {
        if ($rows === []) {
            return;
        }

        $body = '';

        foreach ($rows as $row) {
            $body .= json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR)."\n";
        }

        $response = $this->http()
            ->withQueryParameters([
                'database' => $this->database,
                'query' => "INSERT INTO {$table} FORMAT JSONEachRow",
                'async_insert' => 1,
                'wait_for_async_insert' => 1,
                'input_format_skip_unknown_fields' => 1,
                'date_time_input_format' => 'best_effort',
            ])
            ->withBody($body, 'application/x-ndjson')
            ->post($this->url.'/');

        $this->throwIfFailed($response, "INSERT INTO {$table}");
    }

    public function database(): string
    {
        return $this->database;
    }

    /**
     * @param  array<string, mixed>  $bindings
     */
    private function request(array $bindings): PendingRequest
    {
        $params = ['database' => $this->database];

        foreach ($bindings as $name => $value) {
            $params["param_{$name}"] = $this->formatParameter($value);
        }

        return $this->http()->withQueryParameters($params);
    }

    private function http(): PendingRequest
    {
        return Http::withBasicAuth($this->username, $this->password)
            ->timeout($this->timeout)
            ->connectTimeout(5);
    }

    private function formatParameter(mixed $value): string
    {
        return match (true) {
            is_bool($value) => $value ? '1' : '0',
            is_array($value) => '['.implode(',', array_map(
                fn ($v) => is_string($v) ? "'".str_replace(['\\', "'"], ['\\\\', "\\'"], $v)."'" : (string) $v,
                $value,
            )).']',
            $value instanceof \DateTimeInterface => $value->format('Y-m-d H:i:s.u'),
            default => (string) $value,
        };
    }

    private function throwIfFailed(Response $response, string $sql): void
    {
        if ($response->failed()) {
            throw new RuntimeException('ClickHouse error: '.trim($response->body()).' SQL: '.substr($sql, 0, 500));
        }
    }
}
