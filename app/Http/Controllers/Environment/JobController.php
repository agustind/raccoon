<?php

namespace App\Http\Controllers\Environment;

use App\Models\Deployment;
use App\Models\Environment;
use App\Models\Issue;
use App\Models\Threshold;
use App\Queries\Deployments;
use App\Queries\Graph;
use App\Queries\Period;
use App\Queries\Traces;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class JobController extends EnvironmentController
{
    private const STATUS_COUNTS = "count() AS count, countIf(status = 'processed') AS processed, countIf(status = 'released') AS released, countIf(status = 'failed') AS failed";

    private const EMPTY_GRAPH = ['queued' => 0, 'processed' => 0, 'released' => 0, 'failed' => 0, 'min' => null, 'max' => null, 'avg' => null, 'p95' => null];

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            'name' => 'name', 'queued' => 'queued', 'processed' => 'processed', 'released' => 'released',
            'failed' => 'failed', 'total' => 'count', 'avg' => 'avg', 'p95' => 'p95',
        ], 'name', 'asc');

        return Inertia::render('Jobs/Index', [
            ...$period->toProps(),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'activeUserFilter' => $request->query('user'),
            'search' => $request->query('search'),
            'graph' => Inertia::defer(fn () => $this->graph($period, $bindings), 'charts'),
            'stats' => Inertia::defer(fn () => $this->stats($bindings), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'jobs' => Inertia::defer(fn () => $this->jobs($request, $environment, $bindings, $orderBy), 'table'),
        ]);
    }

    public function show(Request $request, Environment $environment, string $group): Response|JsonResponse
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period, ['group' => $group]);
        $name = $this->clickhouse->value(
            'SELECT name FROM job_attempts WHERE environment_id = {environment:UUID} AND group = {group:String} LIMIT 1
             UNION ALL SELECT name FROM queued_jobs WHERE environment_id = {environment:UUID} AND group = {group:String} LIMIT 1',
            $bindings,
        );

        abort_if($name === null || $name === '', 404);

        $threshold = Threshold::where('application_id', $environment->application_id)->where('type', 'job')->where('group', $group)->value('threshold_ms');
        $where = 'AND group = {group:String}';

        // The details drawer on the index page fetches this route as JSON.
        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            $limit = min(25, max(1, $request->integer('items_per_page', 10)));

            return response()->json([
                ...$period->toProps(),
                'group' => $group,
                'name' => $name,
                'threshold' => $threshold,
                'graph' => $this->graph($period, $bindings, $where),
                'stats' => $this->stats($bindings, $where, withQueued: true),
                'deployments' => Deployments::forPeriod($environment, $period),
                'attempts' => $this->attempts($request, $bindings, $threshold, $limit),
            ]);
        }

        return Inertia::render('Jobs/Show', [
            ...$period->toProps(),
            'group' => $group,
            'name' => $name,
            'threshold' => $threshold,
            'issues' => Issue::where('application_id', $environment->application_id)->where('issueable_type', 'job')->where('group', $group)->get(['ref', 'status', 'title']),
            'activeUserFilter' => $request->query('user'),
            'status' => $request->query('status'),
            'over' => $request->query('over'),
            'graph' => Inertia::defer(fn () => $this->graph($period, $bindings, $where)),
            'stats' => Inertia::defer(fn () => $this->stats($bindings, $where, withQueued: true)),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period)),
            'filterStats' => Inertia::defer(function () use ($request, $bindings, $threshold) {
                $where = $this->scope().' AND group = {group:String}'.$this->userFilter($request, $bindings).$this->overFilter($request, $threshold);

                return $this->selectFirst('SELECT '.self::STATUS_COUNTS." FROM job_attempts WHERE {$where}", $bindings);
            }),
            'attempts' => Inertia::defer(fn () => $this->attempts($request, $bindings, $threshold)),
        ]);
    }

    public function attempt(Request $request, Environment $environment, string $group, string $jobId, string $attemptId, Traces $traces): Response
    {
        // Links from other pages use the trace id in the middle segment, our timeline
        // uses the job id. Accept either; the attempt id is what identifies it.
        $row = $this->clickhouse->first(
            'SELECT * FROM job_attempts
             WHERE environment_id = {environment:UUID} AND group = {group:String} AND attempt_id = {attempt:String}
             AND (job_id = {job:String} OR trace_id = {job:String})
             ORDER BY timestamp LIMIT 1',
            ['environment' => $environment->id, 'group' => $group, 'job' => $jobId, 'attempt' => $attemptId],
        );

        abort_unless($row, 404);

        $row = Graph::cast($row);
        $bindings = [
            'environment' => $environment->id,
            'job' => $row['job_id'],
            'start' => date('Y-m-d H:i:s', strtotime($row['timestamp'].' UTC') - 30 * 86400),
            'end' => date('Y-m-d H:i:s', strtotime($row['timestamp'].' UTC') + 30 * 86400),
        ];
        $window = 'environment_id = {environment:UUID} AND job_id = {job:String} AND timestamp BETWEEN {start:DateTime64(6)} AND {end:DateTime64(6)}';

        $queuedAt = $this->clickhouse->value("SELECT min(timestamp) FROM queued_jobs WHERE {$window} HAVING count() > 0", $bindings);
        $attempts = $this->select("SELECT attempt, attempt_id, status FROM job_attempts WHERE {$window} ORDER BY attempt, timestamp LIMIT 100", $bindings);
        $attemptsCount = (int) $this->clickhouse->value("SELECT count() FROM job_attempts WHERE {$window}", $bindings);

        $users = $this->users($environment, [$row['user']]);
        $summary = $traces->summary($environment, $row['attempt_id'], $row['timestamp']);
        $children = $traces->exceptionsAndLogs($environment, $row['attempt_id'], $row['timestamp']);
        $timeline = $traces->executions($environment, $row['trace_id'], $row['timestamp']);
        $totalDuration = max((int) $row['duration'], ...array_map(fn ($e) => $e['offset'] + $e['duration'], $timeline['executions'] ?: [['offset' => 0, 'duration' => 0]]));

        $attempt = [
            ...collect($row)->only([
                'trace_id', 'timestamp', 'group', 'name', 'connection', 'queue', 'job_id', 'attempt', 'attempt_id',
            ])->all(),
            'queued_at' => $queuedAt,
            ...collect($row)->only(['status', 'server', 'deploy', 'duration'])->all(),
            'events' => array_sum(array_column($summary, 'count')),
            'peak_memory_usage' => $row['peak_memory_usage'],
            'user' => self::presentUser($users, $row['user']),
            'context' => $row['context'],
            'exception_preview' => $row['exception_preview'],
        ];

        return Inertia::render('Jobs/Attempt', [
            'attempt' => $attempt,
            'deployment' => Deployments::present(Deployment::where('environment_id', $environment->id)->where('deploy', $row['deploy'])->first()),
            'summary' => $summary,
            'slowest' => null,
            'attempts' => $attempts,
            'attempts_count' => $attemptsCount,
            'exceptions' => $children['exceptions'],
            'logs' => $children['logs'],
            'issues' => Issue::where('application_id', $environment->application_id)
                ->where(fn ($query) => $query
                    ->where(fn ($q) => $q->where('issueable_type', 'job')->where('group', $row['group']))
                    ->orWhereIn('group', array_column($children['exceptions'], 'group')))
                ->get(['ref', 'status', 'title', 'group']),
            'totalDuration' => $totalDuration,
            'executions' => $timeline['executions'],
            'trace_job_attempts_loaded' => $timeline['job_attempts_loaded'],
            'trace_job_attempts_total' => $timeline['job_attempts_total'],
        ]);
    }

    /**
     * Attempt counts and durations per bucket, plus dispatches as `queued`.
     *
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function graph(Period $period, array $bindings, string $where = ''): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, '.self::STATUS_COUNTS.', '.$this->durationAggregates()."
             FROM job_attempts WHERE {$this->scope()} {$where} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        $queued = $this->select(
            'SELECT '.$this->bucket()." AS bucket, count() AS queued FROM queued_jobs WHERE {$this->scope()} {$where} GROUP BY bucket",
            $bindings,
        );

        $byBucket = [];

        foreach ($rows as $row) {
            unset($row['count']);
            $byBucket[$row['bucket']] = $row;
        }

        foreach ($queued as $row) {
            $byBucket[$row['bucket']] = [...($byBucket[$row['bucket']] ?? ['bucket' => $row['bucket']]), 'queued' => $row['queued']];
        }

        return Graph::fill($period, array_values($byBucket), self::EMPTY_GRAPH);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function stats(array $bindings, string $where = '', bool $withQueued = false): array
    {
        $stats = $this->selectFirst(
            'SELECT '.self::STATUS_COUNTS.', '.$this->durationAggregates()." FROM job_attempts WHERE {$this->scope()} {$where}",
            $bindings,
        );

        if (! $withQueued) {
            return $stats;
        }

        $queued = (int) $this->clickhouse->value("SELECT count() FROM queued_jobs WHERE {$this->scope()} {$where}", $bindings);

        return ['count' => $stats['count'] ?? 0, 'queued' => $queued, ...$stats];
    }

    /**
     * Job classes with attempts or dispatches in the period.
     *
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function jobs(Request $request, Environment $environment, array $bindings, string $orderBy): array
    {
        $filter = $this->userFilter($request, $bindings);

        if ($request->filled('search')) {
            $bindings['search'] = $request->string('search')->toString();
            $filter .= ' AND positionCaseInsensitive(name, {search:String}) > 0';
        }

        $attempts = 'SELECT group, any(name) AS job_name, '.self::STATUS_COUNTS.', '.$this->durationAggregates()."
            FROM job_attempts WHERE {$this->scope()} {$filter} GROUP BY group";
        $queued = "SELECT group, any(name) AS job_name, count() AS queued FROM queued_jobs WHERE {$this->scope()} {$filter} GROUP BY group";

        $total = (int) $this->clickhouse->value(
            "SELECT uniqExact(group) FROM (SELECT group FROM job_attempts WHERE {$this->scope()} {$filter} UNION ALL SELECT group FROM queued_jobs WHERE {$this->scope()} {$filter})",
            $bindings,
        );

        $rows = $this->select(
            "SELECT group, coalesce(nullIf(a.job_name, ''), q.job_name) AS name, ifNull(q.queued, 0) AS queued, ifNull(a.count, 0) AS count,
                ifNull(a.processed, 0) AS processed, ifNull(a.released, 0) AS released, ifNull(a.failed, 0) AS failed,
                a.min AS min, a.max AS max, a.avg AS avg, a.p95 AS p95
             FROM ({$attempts}) AS a FULL OUTER JOIN ({$queued}) AS q USING (group)
             ORDER BY {$orderBy}, group LIMIT 25 OFFSET {$this->offset($request)}
             SETTINGS join_use_nulls = 1",
            $bindings,
        );

        $thresholds = Threshold::where('application_id', $environment->application_id)
            ->where('type', 'job')
            ->whereIn('group', array_column($rows, 'group'))
            ->pluck('threshold_ms', 'group');

        $rows = array_map(fn ($row) => [...$row, 'threshold' => $thresholds[$row['group']] ?? null], $rows);

        return $this->paginator($request, $rows, $total);
    }

    /**
     * Attempts of one job class, newest first.
     *
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function attempts(Request $request, array $bindings, ?int $threshold, int $perPage = 25): array
    {
        $where = $this->scope().' AND group = {group:String}'.$this->userFilter($request, $bindings).$this->overFilter($request, $threshold).$this->cursorWhere($request, $bindings);

        if (in_array($request->query('status'), ['processed', 'released', 'failed'], true)) {
            $bindings['status'] = $request->query('status');
            $where .= ' AND status = {status:String}';
        }

        $rows = $this->select(
            "SELECT timestamp, trace_id, job_id, attempt_id, status, attempt, duration, connection, queue, exception_preview
             FROM job_attempts WHERE {$where} ORDER BY timestamp DESC LIMIT ".($perPage + 1),
            $bindings,
        );

        return $this->cursorPaginator($request, $rows, $perPage);
    }

    /**
     * ?over=avg|p95|threshold keeps attempts at or above that duration.
     */
    private function overFilter(Request $request, ?int $threshold): string
    {
        return match ($request->query('over')) {
            'avg' => " AND duration >= (SELECT avg(duration) FROM job_attempts WHERE {$this->scope()} AND group = {group:String})",
            'p95' => " AND duration >= (SELECT quantile(0.95)(duration) FROM job_attempts WHERE {$this->scope()} AND group = {group:String})",
            'threshold' => $threshold ? ' AND duration >= '.($threshold * 1000) : '',
            default => '',
        };
    }

    /**
     * @param  array<string, mixed>  $bindings
     */
    private function userFilter(Request $request, array &$bindings): string
    {
        if (! $request->filled('user')) {
            return '';
        }

        $bindings['user'] = $request->string('user')->toString();

        return ' AND user = {user:String}';
    }
}
