<?php

namespace App\Http\Controllers\Environment;

use App\Models\Environment;
use App\Models\Threshold;
use App\Queries\Deployments;
use App\Queries\Graph;
use App\Queries\Period;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends EnvironmentController
{
    public function show(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);

        return Inertia::render('Dashboard/Dashboard', [
            ...$period->toProps(),
            'activeUserFilter' => $request->query('user'),
            'deployments' => Deployments::forPeriod($environment, $period),
            'requestsGraph' => Inertia::defer(fn () => $this->requestsGraph($period, $bindings), 'request-charts'),
            'requestStats' => Inertia::defer(fn () => $this->requestStats($bindings), 'request-charts'),
            'exceptionsGraph' => Inertia::defer(fn () => $this->exceptionsGraph($environment, $period), 'exception-charts'),
            'exceptionStats' => Inertia::defer(fn () => $this->exceptionStats($bindings), 'exception-charts'),
            'slowRoutes' => Inertia::defer(fn () => $this->slowRoutes($environment, $bindings), 'slow-routes'),
            'jobsGraph' => Inertia::defer(fn () => $this->jobsGraph($period, $bindings), 'job-charts'),
            'jobStats' => Inertia::defer(fn () => $this->jobStats($bindings), 'job-charts'),
            'activeUsers' => Inertia::defer(fn () => $this->activeUsers($environment, $bindings), 'user-activity'),
            'impactedUsers' => Inertia::defer(fn () => $this->impactedUsers($environment, $bindings), 'user-exceptions'),
            'userGraph' => Inertia::defer(fn () => $this->userGraph($period, $bindings), 'user-charts'),
            'totalUniqueUsers' => Inertia::defer(fn () => (int) $this->clickhouse->value(
                "SELECT uniqExactIf(user, user != '') FROM requests WHERE {$this->scope()}",
                $bindings,
            ), 'user-charts'),
        ]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function requestsGraph(Period $period, array $bindings): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, count() AS count, countIf(status_code < 400) AS `2xx`, countIf(status_code >= 400 AND status_code < 500) AS `4xx`, countIf(status_code >= 500) AS `5xx`, '.$this->durationAggregates()."
             FROM requests WHERE {$this->scope()} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        return Graph::fill($period, $rows, ['count' => 0, '2xx' => 0, '4xx' => 0, '5xx' => 0, 'min' => null, 'max' => null, 'avg' => null, 'p95' => null]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function requestStats(array $bindings): array
    {
        return $this->selectFirst(
            "SELECT toUInt64(round(avgOrNull(duration))) AS avg, toUInt64(round(quantileOrNull(0.95)(duration))) AS p95, count() AS count,
                countIf(status_code < 400) AS `2xx`, countIf(status_code >= 400 AND status_code < 500) AS `4xx`, countIf(status_code >= 500) AS `5xx`
             FROM requests WHERE {$this->scope()}",
            $bindings,
        );
    }

    /**
     * The exceptions card is drawn with half as many bars as the
     * other charts, so it uses buckets twice as wide.
     *
     * @return list<array<string, mixed>>
     */
    private function exceptionsGraph(Environment $environment, Period $period): array
    {
        $period = new Period($period->key, $period->from, $period->to, $period->bucketSeconds * 2);

        $rows = $this->select(
            'SELECT '.$this->bucket()." AS bucket, count() AS count, countIf(NOT exceptions.handled) AS unhandled, countIf(exceptions.handled) AS handled
             FROM exceptions WHERE {$this->scope()} GROUP BY bucket ORDER BY bucket",
            $this->bindings($environment, $period),
        );

        return Graph::fill($period, $rows, ['count' => 0, 'unhandled' => 0, 'handled' => 0]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array{total: int, impacted_users: int}
     */
    private function exceptionStats(array $bindings): array
    {
        $row = $this->selectFirst(
            "SELECT count() AS total, uniqExactIf(user, user != '') AS impacted_users FROM exceptions WHERE {$this->scope()}",
            $bindings,
        );

        return ['total' => (int) ($row['total'] ?? 0), 'impacted_users' => (int) ($row['impacted_users'] ?? 0)];
    }

    /**
     * Routes with at least one request slower than their threshold in the period.
     *
     * @param  array<string, mixed>  $bindings
     * @return array{routes: list<array<string, mixed>>, has_thresholds: bool}
     */
    private function slowRoutes(Environment $environment, array $bindings): array
    {
        $thresholds = Threshold::where('application_id', $environment->application_id)
            ->where('type', 'route')
            ->pluck('threshold_ms', 'group');

        if ($thresholds->isEmpty()) {
            return ['routes' => [], 'has_thresholds' => false];
        }

        $routes = $this->select(
            "SELECT group, any(route_methods) AS methods, any(route_path) AS path, max(duration) AS max_duration, count() AS count
             FROM requests
             WHERE {$this->scope()} AND group IN {groups:Array(String)}
                AND duration > transform(group, {groups:Array(String)}, {limits:Array(UInt64)}, toUInt64(0))
             GROUP BY group ORDER BY max_duration DESC",
            [
                ...$bindings,
                'groups' => $thresholds->keys()->all(),
                'limits' => $thresholds->values()->map(fn ($ms) => $ms * 1000)->all(),
            ],
        );

        return [
            'routes' => array_map(fn ($route) => [...$route, 'threshold' => $thresholds[$route['group']]], $routes),
            'has_thresholds' => true,
        ];
    }

    /**
     * Queued counts come from queued_jobs; everything else from job attempts.
     *
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function jobsGraph(Period $period, array $bindings): array
    {
        $attempts = $this->select(
            'SELECT '.$this->bucket()." AS bucket, countIf(status = 'processed') AS processed, countIf(status = 'released') AS released, countIf(status = 'failed') AS failed, ".$this->durationAggregates()."
             FROM job_attempts WHERE {$this->scope()} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        $queued = $this->select(
            'SELECT '.$this->bucket()." AS bucket, count() AS queued FROM queued_jobs WHERE {$this->scope()} GROUP BY bucket",
            $bindings,
        );

        $rows = collect($attempts)->keyBy('bucket')->all();

        foreach ($queued as $row) {
            $rows[$row['bucket']] = [...($rows[$row['bucket']] ?? []), ...$row];
        }

        return Graph::fill($period, array_values($rows), ['queued' => 0, 'processed' => 0, 'released' => 0, 'failed' => 0, 'min' => null, 'max' => null, 'avg' => null, 'p95' => null]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function jobStats(array $bindings): array
    {
        // count is only selected so empty aggregates come back as null.
        $stats = $this->selectFirst(
            "SELECT countIf(status = 'processed') AS processed, countIf(status = 'released') AS released, countIf(status = 'failed') AS failed,
                toUInt64(round(avgOrNull(duration))) AS avg, toUInt64(round(quantileOrNull(0.95)(duration))) AS p95, count() AS count
             FROM job_attempts WHERE {$this->scope()}",
            $bindings,
        );

        unset($stats['count']);

        return $stats;
    }

    /**
     * The five users with the most requests.
     *
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function activeUsers(Environment $environment, array $bindings): array
    {
        $rows = $this->select(
            "SELECT user, count() AS count FROM requests WHERE {$this->scope()} AND user != '' GROUP BY user ORDER BY count DESC, user LIMIT 5",
            $bindings,
        );

        return $this->withUserDetails($environment, $rows);
    }

    /**
     * Users who hit the most exceptions, plus how many users hit any.
     *
     * @param  array<string, mixed>  $bindings
     * @return array{total: int, users: list<array<string, mixed>>}
     */
    private function impactedUsers(Environment $environment, array $bindings): array
    {
        $total = (int) $this->clickhouse->value("SELECT uniqExactIf(user, user != '') FROM exceptions WHERE {$this->scope()}", $bindings);

        $rows = $this->select(
            "SELECT user, count() AS count FROM exceptions WHERE {$this->scope()} AND user != '' GROUP BY user ORDER BY count DESC, user LIMIT 3",
            $bindings,
        );

        return ['total' => $total, 'users' => $this->withUserDetails($environment, $rows)];
    }

    /**
     * @param  list<array<string, mixed>>  $rows  rows with `user` and `count`
     * @return list<array<string, mixed>>
     */
    private function withUserDetails(Environment $environment, array $rows): array
    {
        $users = $this->users($environment, array_column($rows, 'user'));

        return array_map(fn ($row) => [...self::presentUser($users, $row['user']), 'count' => $row['count']], $rows);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function userGraph(Period $period, array $bindings): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket()." AS bucket, uniqExactIf(user, user != '') AS unique, countIf(user = '') AS guest, countIf(user != '') AS authenticated
             FROM requests WHERE {$this->scope()} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        return Graph::fill($period, $rows, ['unique' => 0, 'guest' => 0, 'authenticated' => 0]);
    }
}
