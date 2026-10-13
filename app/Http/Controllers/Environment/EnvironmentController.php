<?php

namespace App\Http\Controllers\Environment;

use App\ClickHouse\ClickHouse;
use App\Http\Controllers\Controller;
use App\Models\Environment;
use App\Queries\Graph;
use App\Queries\Period;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Base for every environment-scoped dashboard page.
 *
 * Conventions for ClickHouse queries:
 * - `{environment:UUID}`, `{from:DateTime64(6)}`, `{to:DateTime64(6)}` and
 *   `{bucket:UInt32}` come from bindings() and are always available.
 * - Use scope() for the WHERE clause and bucket() for chart grouping.
 * - Durations stay in microseconds; the frontend formats them.
 */
abstract class EnvironmentController extends Controller
{
    public function __construct(protected ClickHouse $clickhouse)
    {
        //
    }

    protected function period(Request $request, string $default = '24h'): Period
    {
        return Period::fromRequest($request, $default);
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    protected function bindings(Environment $environment, Period $period, array $extra = []): array
    {
        return ['environment' => $environment->id, ...$period->bindings(), ...$extra];
    }

    /**
     * WHERE clause restricting a table to the environment and period.
     */
    protected function scope(string $column = 'timestamp'): string
    {
        return "environment_id = {environment:UUID} AND {$column} >= {from:DateTime64(6)} AND {$column} <= {to:DateTime64(6)}";
    }

    /**
     * Chart bucket expression, aligned to the epoch like Period::buckets().
     */
    protected function bucket(string $column = 'timestamp'): string
    {
        return "formatDateTime(toDateTime(intDiv(toUnixTimestamp({$column}), {bucket:UInt32}) * {bucket:UInt32}, 'UTC'), '%Y-%m-%d %H:%i:%S')";
    }

    /**
     * min/max/avg/p95 of a duration column, named like the page props expect.
     */
    protected function durationAggregates(string $column = 'duration'): string
    {
        // -OrNull variants: over zero rows avg/quantile are NaN, and NaN cannot
        // be cast to an integer. Empty periods return null.
        return "minOrNull({$column}) AS min, maxOrNull({$column}) AS max, toUInt64(round(avgOrNull({$column}))) AS avg, toUInt64(round(quantileOrNull(0.95)({$column}))) AS p95";
    }

    /**
     * Run a select and cast numeric strings to numbers.
     *
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    protected function select(string $sql, array $bindings): array
    {
        return Graph::castAll($this->clickhouse->select($sql, $bindings));
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    protected function selectFirst(string $sql, array $bindings, array $default = []): array
    {
        $row = $this->select($sql, $bindings)[0] ?? null;

        return $row === null ? $default : self::nullifyEmptyAggregates($row);
    }

    /**
     * Aggregates over zero rows come back as 0 or NaN; pages expect null.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    protected static function nullifyEmptyAggregates(array $row): array
    {
        $count = $row['count'] ?? null;

        foreach (['min', 'max', 'avg', 'p95'] as $key) {
            if (array_key_exists($key, $row) && ($count === 0 || (is_float($row[$key]) && is_nan($row[$key])))) {
                $row[$key] = null;
            }
        }

        return $row;
    }

    /**
     * Sort column and direction from ?sortBy=&sortDirection=, limited to an allow list
     * of prop name => SQL expression.
     *
     * @param  array<string, string>  $allowed
     * @return array{0: string, 1: string, 2: string} [sortBy, direction, SQL ORDER BY expression]
     */
    protected function sort(Request $request, array $allowed, string $default, string $defaultDirection = 'desc'): array
    {
        $sortBy = $request->string('sortBy', $default)->toString();
        $sortBy = array_key_exists($sortBy, $allowed) ? $sortBy : $default;
        $direction = strtolower($request->string('sortDirection', $defaultDirection)->toString()) === 'asc' ? 'asc' : 'desc';

        return [$sortBy, $direction, "{$allowed[$sortBy]} {$direction}"];
    }

    /**
     * Laravel's length-aware paginator array, the shape pages use for
     * grouped tables (routes, jobs, queries...).
     *
     * @param  list<array<string, mixed>>  $items
     * @return array<string, mixed>
     */
    protected function paginator(Request $request, array $items, int $total, int $perPage = 25): array
    {
        $page = max(1, $request->integer('page', 1));

        return (new LengthAwarePaginator($items, $total, $perPage, $page, [
            'path' => $request->url(),
            'query' => $request->query(),
        ]))->toArray();
    }

    protected function page(Request $request): int
    {
        return max(1, $request->integer('page', 1));
    }

    protected function offset(Request $request, int $perPage = 25): int
    {
        return ($this->page($request) - 1) * $perPage;
    }

    /**
     * Cursor pagination over a timestamp-ordered event list (newest first).
     * Fetch $perPage + 1 rows with cursorWhere() applied and pass them here.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return array<string, mixed>
     */
    protected function cursorPaginator(Request $request, array $rows, int $perPage = 25): array
    {
        $hasMore = count($rows) > $perPage;
        $rows = array_slice($rows, 0, $perPage);
        $nextCursor = $hasMore ? self::encodeCursor(end($rows)['timestamp']) : null;
        $url = $request->url();
        $query = $request->except('cursor');

        return [
            'data' => array_values($rows),
            'path' => $url,
            'per_page' => $perPage,
            'next_cursor' => $nextCursor,
            'next_page_url' => $nextCursor ? $url.'?'.http_build_query([...$query, 'cursor' => $nextCursor]) : null,
            'prev_cursor' => null,
            'prev_page_url' => null,
        ];
    }

    /**
     * SQL condition for rows older than the cursor (empty when there is none).
     * Adds `cursor` to $bindings.
     *
     * @param  array<string, mixed>  $bindings
     */
    protected function cursorWhere(Request $request, array &$bindings, string $column = 'timestamp'): string
    {
        $timestamp = self::decodeCursor($request->string('cursor')->toString());

        if ($timestamp === null) {
            return '';
        }

        $bindings['cursor'] = $timestamp;

        return " AND {$column} < {cursor:DateTime64(6)}";
    }

    public static function encodeCursor(string $timestamp): string
    {
        return rtrim(strtr(base64_encode(json_encode(['timestamp' => $timestamp])), '+/', '-_'), '=');
    }

    public static function decodeCursor(string $cursor): ?string
    {
        if ($cursor === '') {
            return null;
        }

        $data = json_decode((string) base64_decode(strtr($cursor, '-_', '+/')), true);

        return is_string($data['timestamp'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/', $data['timestamp'])
            ? $data['timestamp']
            : null;
    }

    /**
     * Look up user display details for a set of application user ids.
     *
     * @param  list<string>  $ids
     * @return array<string, array{id: string, name: ?string, username: ?string}>
     */
    protected function users(Environment $environment, array $ids): array
    {
        $ids = array_values(array_unique(array_filter($ids, fn ($id) => $id !== '' && $id !== null)));

        if ($ids === []) {
            return [];
        }

        $rows = $this->clickhouse->select(
            'SELECT id, argMax(name, timestamp) AS name, argMax(username, timestamp) AS username
             FROM users WHERE environment_id = {environment:UUID} AND id IN {ids:Array(String)} GROUP BY id',
            ['environment' => $environment->id, 'ids' => $ids],
        );

        $users = [];

        foreach ($rows as $row) {
            $users[$row['id']] = [
                'id' => $row['id'],
                'name' => $row['name'] !== '' ? $row['name'] : null,
                'username' => $row['username'] !== '' ? $row['username'] : null,
            ];
        }

        return $users;
    }

    /**
     * @param  array<string, array{id: string, name: ?string, username: ?string}>  $users
     * @return array{id: string, name: ?string, username: ?string}
     */
    protected static function presentUser(array $users, ?string $id): array
    {
        return $users[$id ?? ''] ?? ['id' => (string) $id, 'name' => null, 'username' => null];
    }
}
