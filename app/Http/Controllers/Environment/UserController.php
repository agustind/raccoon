<?php

namespace App\Http\Controllers\Environment;

use App\Models\Environment;
use App\Queries\Deployments;
use App\Queries\Graph;
use App\Queries\Period;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Application users seen in requests, queued jobs and exceptions. The `users`
 * table only holds display details (latest name/username per id).
 */
class UserController extends EnvironmentController
{
    private const STATUS_COUNTS = 'count() AS count, countIf(status_code < 400) AS `2xx`, countIf(status_code >= 400 AND status_code < 500) AS `4xx`, countIf(status_code >= 500) AS `5xx`';

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            '2xx' => 'request_2xx_count', '4xx' => 'request_4xx_count', '5xx' => 'request_5xx_count', 'requests' => 'request_count',
            'jobs' => 'queued_job_count', 'exceptions' => 'exception_count', 'last_seen' => 'last_seen_at',
        ], 'requests');

        return Inertia::render('Users/Index', [
            ...$period->toProps(),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'search' => $request->query('search'),
            'totalUniqueUsers' => (int) $this->clickhouse->value("SELECT uniqExact(user) FROM ({$this->activity()})", $bindings),
            'graph' => $this->uniqueUsersGraph($period, $bindings),
            'deployments' => Deployments::forPeriod($environment, $period),
            'users' => $this->userList($request, $environment, $bindings, $orderBy),
        ]);
    }

    public function show(Request $request, Environment $environment, string $user): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period, ['user' => $user]);
        $details = $this->users($environment, [$user])[$user] ?? null;
        // A user can appear only in exceptions or job attempts (e.g. errors
        // raised inside queued jobs) without a request or a user record.
        $lastSeen = $this->clickhouse->value(
            "SELECT formatDateTime(max(ts), '%Y-%m-%d %H:%i:%S') FROM (
                SELECT max(timestamp) AS ts FROM requests WHERE environment_id = {environment:UUID} AND user = {user:String} HAVING count() > 0
                UNION ALL SELECT max(timestamp) FROM exceptions WHERE environment_id = {environment:UUID} AND user = {user:String} HAVING count() > 0
                UNION ALL SELECT max(timestamp) FROM job_attempts WHERE environment_id = {environment:UUID} AND user = {user:String} HAVING count() > 0
            ) HAVING count() > 0",
            $bindings,
        );

        abort_if($details === null && $lastSeen === null, 404);

        $where = $this->scope().' AND user = {user:String}';
        $graph = $this->select(
            'SELECT '.$this->bucket().' AS bucket, '.self::STATUS_COUNTS." FROM requests WHERE {$where} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        return Inertia::render('Users/Show', [
            ...$period->toProps(),
            'user' => [
                'id' => $user,
                'name' => $details['name'] ?? '',
                'username' => $details['username'] ?? '',
                'last_seen_at' => $lastSeen,
            ],
            'status' => $request->query('status'),
            'over' => $request->query('over'),
            'search' => $request->query('search'),
            'graph' => Graph::fill($period, $graph, ['count' => 0, '2xx' => 0, '4xx' => 0, '5xx' => 0]),
            'deployments' => Deployments::forPeriod($environment, $period),
            'stats' => $this->selectFirst('SELECT '.self::STATUS_COUNTS." FROM requests WHERE {$where}", $bindings),
            'filterStats' => $this->selectFirst("SELECT countIf(status_code < 400) AS `2xx`, countIf(status_code >= 400 AND status_code < 500) AS `4xx`, countIf(status_code >= 500) AS `5xx` FROM requests WHERE {$where}", $bindings),
            'leaderboards' => $this->leaderboards($bindings, $where),
            'requests' => $this->requests($request, $bindings, $where),
        ]);
    }

    /**
     * One row per event that belongs to an authenticated user, used for the
     * user list and the unique user total.
     */
    private function activity(): string
    {
        $scope = $this->scope()." AND user != ''";

        return implode(' UNION ALL ', [
            "SELECT user, count() AS requests, countIf(status_code < 400) AS r2xx, countIf(status_code >= 400 AND status_code < 500) AS r4xx, countIf(status_code >= 500) AS r5xx, toUInt64(0) AS jobs, toUInt64(0) AS exceptions, max(timestamp) AS last_seen FROM requests WHERE {$scope} GROUP BY user",
            "SELECT user, 0, 0, 0, 0, count(), 0, max(timestamp) FROM queued_jobs WHERE {$scope} GROUP BY user",
            "SELECT user, 0, 0, 0, 0, 0, count(), max(timestamp) FROM exceptions WHERE {$scope} GROUP BY user",
        ]);
    }

    /**
     * Unique authenticated users per bucket, plus requests split by guest and authenticated.
     *
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function uniqueUsersGraph(Period $period, array $bindings): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, uniqExactIf(user, user != \'\') AS unique, countIf(user = \'\') AS guest, countIf(user != \'\') AS authenticated
             FROM requests WHERE '.$this->scope().' GROUP BY bucket ORDER BY bucket',
            $bindings,
        );

        return Graph::fill($period, $rows, ['unique' => 0, 'guest' => 0, 'authenticated' => 0]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function userList(Request $request, Environment $environment, array $bindings, string $orderBy): array
    {
        $having = '';

        if ($request->filled('search')) {
            $bindings['search'] = $request->string('search')->toString();
            $having = 'HAVING positionCaseInsensitive(id, {search:String}) > 0 OR id IN (
                SELECT id FROM users WHERE environment_id = {environment:UUID}
                AND (positionCaseInsensitive(name, {search:String}) > 0 OR positionCaseInsensitive(username, {search:String}) > 0))';
        }

        $grouped = "SELECT user AS id, sum(requests) AS request_count, sum(r2xx) AS request_2xx_count, sum(r4xx) AS request_4xx_count,
                sum(r5xx) AS request_5xx_count, request_4xx_count + request_5xx_count AS request_error_count,
                sum(jobs) AS queued_job_count, sum(exceptions) AS exception_count,
                formatDateTime(max(last_seen), '%Y-%m-%d %H:%i:%S') AS last_seen_at
            FROM ({$this->activity()}) GROUP BY id {$having}";

        $total = (int) $this->clickhouse->value("SELECT count() FROM ({$grouped})", $bindings);
        $rows = $this->select("{$grouped} ORDER BY {$orderBy}, id LIMIT 25 OFFSET {$this->offset($request)}", $bindings);
        $details = $this->users($environment, array_column($rows, 'id'));

        $rows = array_map(fn ($row) => [
            ...$row,
            'name' => $details[$row['id']]['name'] ?? null,
            'username' => $details[$row['id']]['username'] ?? null,
        ], $rows);

        return $this->paginator($request, $rows, $total);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, list<array<string, mixed>>>
     */
    private function leaderboards(array $bindings, string $where): array
    {
        return [
            'topRoutes' => $this->select(
                "SELECT any(route_path) AS name, group, count() AS count, any(route_methods) AS methods
                 FROM requests WHERE {$where} GROUP BY group ORDER BY count DESC, name LIMIT 5",
                $bindings,
            ),
            'slowRoutes' => $this->select(
                "SELECT any(route_path) AS name, group, toUInt64(round(quantile(0.95)(duration))) AS duration, any(route_methods) AS methods
                 FROM requests WHERE {$where} GROUP BY group ORDER BY duration DESC, name LIMIT 5",
                $bindings,
            ),
            'queuedJobs' => $this->select(
                "SELECT any(name) AS name, group, count() AS count
                 FROM queued_jobs WHERE {$where} GROUP BY group ORDER BY count DESC, name LIMIT 5",
                $bindings,
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function requests(Request $request, array $bindings, string $where): array
    {
        $baseWhere = $where;
        $where .= match ($request->query('status')) {
            '2xx' => ' AND status_code < 400',
            '4xx' => ' AND status_code >= 400 AND status_code < 500',
            '5xx' => ' AND status_code >= 500',
            default => '',
        };

        if (in_array($request->query('over'), ['avg', 'p95'], true)) {
            $stat = $request->query('over') === 'avg' ? 'avg(duration)' : 'quantile(0.95)(duration)';
            $where .= " AND duration >= (SELECT {$stat} FROM requests WHERE {$baseWhere})";
        }

        if ($request->filled('search')) {
            $bindings['search'] = $request->string('search')->toString();
            $where .= ' AND positionCaseInsensitive(url, {search:String}) > 0';
        }

        $total = (int) $this->clickhouse->value("SELECT count() FROM requests WHERE {$where}", $bindings);
        $rows = $this->select(
            "SELECT trace_id, url, method, status_code, timestamp, duration, group
             FROM requests WHERE {$where} ORDER BY timestamp DESC LIMIT 25 OFFSET {$this->offset($request)}",
            $bindings,
        );

        return $this->paginator($request, $rows, $total);
    }
}
