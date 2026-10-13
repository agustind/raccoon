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
use Cron\CronExpression;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ScheduledTaskController extends EnvironmentController
{
    private const COUNTS = "count() AS count, countIf(status = 'processed') AS processed, countIf(status = 'skipped') AS skipped, countIf(status = 'failed') AS failed";

    private const EMPTY_GRAPH = ['count' => 0, 'processed' => 0, 'skipped' => 0, 'failed' => 0, 'min' => null, 'max' => null, 'avg' => null, 'p95' => null];

    /** Latest schedule settings of a task, from its most recent run. */
    private const SETTINGS = 'argMax(name, timestamp) AS name, argMax(cron, timestamp) AS cron, argMax(timezone, timestamp) AS timezone, argMax(repeat_seconds, timestamp) AS repeat_seconds';

    /** How many upcoming run times the countdown gets before it needs a reload. */
    private const NEXT_RUNS = 20;

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            'name' => 'name', 'processed' => 'processed', 'skipped' => 'skipped', 'failed' => 'failed', 'total' => 'count', 'avg' => 'avg', 'p95' => 'p95',
        ], 'name', 'asc');

        return Inertia::render('ScheduledTasks/Index', [
            ...$period->toProps(),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'search' => $request->query('search'),
            'graph' => Inertia::defer(fn () => $this->graph($period, $bindings), 'charts'),
            'stats' => Inertia::defer(fn () => $this->stats($bindings), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'tasks' => Inertia::defer(fn () => $this->tasks($request, $environment, $bindings, $orderBy), 'table'),
        ]);
    }

    /**
     * The task page, or its charts and latest runs as JSON for the details
     * drawer on the index page.
     */
    public function show(Request $request, Environment $environment, string $group): Response|JsonResponse
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period, ['group' => $group]);
        $task = $this->clickhouse->first(
            'SELECT count() AS runs, '.self::SETTINGS.',
                argMax(without_overlapping, timestamp) AS without_overlapping, argMax(on_one_server, timestamp) AS on_one_server,
                argMax(run_in_background, timestamp) AS run_in_background, argMax(even_in_maintenance_mode, timestamp) AS even_in_maintenance_mode
             FROM scheduled_tasks WHERE environment_id = {environment:UUID} AND group = {group:String}',
            $bindings,
        );

        abort_if(! $task || (int) $task['runs'] === 0, 404);

        unset($task['runs']);
        $task = [...Graph::cast($task), 'next_runs' => self::nextRuns($task['cron'], $task['timezone'], (int) $task['repeat_seconds'])];
        $where = 'AND group = {group:String}';

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                ...$period->toProps(),
                'group' => $group,
                'task' => $task,
                'graph' => $this->graph($period, $bindings, $where),
                'stats' => $this->stats($bindings, $where),
                'deployments' => Deployments::forPeriod($environment, $period),
                'runs' => $this->runs($request, $environment, $bindings, 10),
            ]);
        }

        return Inertia::render('ScheduledTasks/Show', [
            ...$period->toProps(),
            'group' => $group,
            'task' => $task,
            'threshold' => $this->threshold($environment, $group),
            'issues' => Issue::where('application_id', $environment->application_id)->where('issueable_type', 'scheduled_task')->where('group', $group)->get(['ref', 'status', 'title']),
            'over' => $request->query('over'),
            'status' => $request->query('status'),
            'graph' => Inertia::defer(fn () => $this->graph($period, $bindings, $where), 'charts'),
            'stats' => Inertia::defer(fn () => $this->stats($bindings, $where), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'filterStats' => Inertia::defer(fn () => $this->selectFirst(
                'SELECT '.self::COUNTS." FROM scheduled_tasks WHERE {$this->scope()} {$where}".$this->overFilter($request, $environment, $group),
                $bindings,
            ), 'runs'),
            'runs' => Inertia::defer(fn () => $this->runs($request, $environment, $bindings), 'runs'),
        ]);
    }

    public function run(Request $request, Environment $environment, string $group, string $traceId, Traces $traces): Response
    {
        $row = $this->clickhouse->first(
            'SELECT * FROM scheduled_tasks WHERE environment_id = {environment:UUID} AND group = {group:String} AND trace_id = {trace:String} ORDER BY timestamp LIMIT 1',
            ['environment' => $environment->id, 'group' => $group, 'trace' => $traceId],
        );

        abort_unless($row, 404);

        $row = Graph::cast($row);
        $summary = $traces->summary($environment, $traceId, $row['timestamp']);
        $timeline = $traces->executions($environment, $traceId, $row['timestamp']);
        $children = $traces->exceptionsAndLogs($environment, $traceId, $row['timestamp']);

        return Inertia::render('ScheduledTasks/Run', [
            'run' => [
                ...collect($row)->only([
                    'trace_id', 'timestamp', 'group', 'name', 'cron', 'timezone', 'repeat_seconds', 'status', 'duration', 'deploy', 'server',
                    'peak_memory_usage', 'exception_preview', 'context',
                ])->all(),
                ...collect($row)->only(['without_overlapping', 'on_one_server', 'run_in_background', 'even_in_maintenance_mode'])->map(fn ($value) => (bool) $value)->all(),
                'events' => array_sum(array_column($summary, 'count')),
            ],
            'deployment' => Deployments::present(Deployment::where('environment_id', $environment->id)->where('deploy', $row['deploy'])->first()),
            'summary' => $summary,
            'slowest' => null,
            'exceptions' => $children['exceptions'],
            'logs' => $children['logs'],
            'issues' => Issue::where('application_id', $environment->application_id)
                ->whereIn('group', array_column($children['exceptions'], 'group'))
                ->get(['ref', 'status', 'title', 'group']),
            'totalDuration' => (int) $row['duration'],
            'executions' => $timeline['executions'],
            'trace_job_attempts_loaded' => $timeline['job_attempts_loaded'],
            'trace_job_attempts_total' => $timeline['job_attempts_total'],
        ]);
    }

    /**
     * Upcoming run times (UTC) for a cron expression evaluated in the task's
     * timezone. Sub-minute tasks (Laravel's everyTenSeconds() etc.) run every
     * repeat_seconds within each due minute.
     *
     * @return list<string>
     */
    public static function nextRuns(string $cron, string $timezone, int $repeatSeconds, ?DateTimeImmutable $now = null): array
    {
        try {
            $expression = new CronExpression($cron);
            $zone = new DateTimeZone($timezone ?: 'UTC');
        } catch (Throwable) {
            return [];
        }

        $now ??= new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $offsets = $repeatSeconds > 0 && $repeatSeconds < 60 ? range(0, 59, $repeatSeconds) : [0];
        $minute = $now->setTime((int) $now->format('H'), (int) $now->format('i'));
        $runs = [];

        foreach ($expression->getMultipleRunDates(self::NEXT_RUNS, $minute->setTimezone($zone), false, true, $zone->getName()) as $due) {
            foreach ($offsets as $offset) {
                $at = DateTimeImmutable::createFromInterface($due)->modify("+{$offset} seconds");

                if ($at > $now) {
                    $runs[] = $at->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
                }

                if (count($runs) === self::NEXT_RUNS) {
                    return $runs;
                }
            }
        }

        return $runs;
    }

    private function threshold(Environment $environment, string $group): ?int
    {
        return Threshold::where('application_id', $environment->application_id)->where('type', 'scheduled_task')->where('group', $group)->value('threshold_ms');
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function graph(Period $period, array $bindings, string $where = ''): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, '.self::COUNTS.', '.$this->durationAggregates()."
             FROM scheduled_tasks WHERE {$this->scope()} {$where} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        return Graph::fill($period, $rows, self::EMPTY_GRAPH);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function stats(array $bindings, string $where = ''): array
    {
        return $this->selectFirst(
            'SELECT '.self::COUNTS.', '.$this->durationAggregates()." FROM scheduled_tasks WHERE {$this->scope()} {$where}",
            $bindings,
        );
    }

    /**
     * Every task that ran in the period. The page expects a plain list here,
     * not a paginator.
     *
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function tasks(Request $request, Environment $environment, array $bindings, string $orderBy): array
    {
        $filter = '';

        if ($request->filled('search')) {
            $bindings['search'] = $request->string('search')->toString();
            $filter = ' AND positionCaseInsensitive(scheduled_tasks.name, {search:String}) > 0';
        }

        $rows = array_map(self::nullifyEmptyAggregates(...), $this->select(
            'SELECT group, '.self::SETTINGS.', argMax(status, timestamp) AS last_status, max(timestamp) AS last_run_at, '.self::COUNTS.', '.$this->durationAggregates()."
             FROM scheduled_tasks WHERE {$this->scope()} {$filter}
             GROUP BY group ORDER BY {$orderBy}, group LIMIT 500",
            $bindings,
        ));

        $thresholds = Threshold::where('application_id', $environment->application_id)
            ->where('type', 'scheduled_task')
            ->whereIn('group', array_column($rows, 'group'))
            ->pluck('threshold_ms', 'group');

        return array_map(fn ($row) => [
            ...$row,
            'threshold' => $thresholds[$row['group']] ?? null,
            'next_runs' => self::nextRuns($row['cron'], $row['timezone'], (int) $row['repeat_seconds']),
        ], $rows);
    }

    /**
     * Runs of one task, newest first, filtered by ?status= and ?over=.
     *
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function runs(Request $request, Environment $environment, array $bindings, int $perPage = 25): array
    {
        $where = $this->scope().' AND group = {group:String}'.$this->cursorWhere($request, $bindings);

        if (in_array($request->query('status'), ['processed', 'skipped', 'failed'], true)) {
            $bindings['status'] = $request->query('status');
            $where .= ' AND status = {status:String}';
        }

        $where .= $this->overFilter($request, $environment, $bindings['group']);

        $rows = $this->select(
            "SELECT timestamp, trace_id, group, status, duration, exception_preview
             FROM scheduled_tasks WHERE {$where} ORDER BY timestamp DESC LIMIT ".($perPage + 1),
            $bindings,
        );

        return $this->cursorPaginator($request, $rows, $perPage);
    }

    /**
     * Condition for ?over=avg|p95|threshold, comparing against the period's
     * stats for the task.
     */
    private function overFilter(Request $request, Environment $environment, string $group): string
    {
        return match ($request->query('over')) {
            'avg' => " AND duration >= (SELECT avg(duration) FROM scheduled_tasks WHERE {$this->scope()} AND group = {group:String})",
            'p95' => " AND duration >= (SELECT quantile(0.95)(duration) FROM scheduled_tasks WHERE {$this->scope()} AND group = {group:String})",
            'threshold' => ($ms = $this->threshold($environment, $group)) ? ' AND duration >= '.((int) $ms * 1000) : '',
            default => '',
        };
    }
}
