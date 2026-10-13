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

class CommandController extends EnvironmentController
{
    private const COUNTS = 'count() AS count, countIf(exit_code = 0) AS success, countIf(exit_code != 0) AS failed';

    private const EMPTY_GRAPH = ['count' => 0, 'success' => 0, 'failed' => 0, 'min' => null, 'max' => null, 'avg' => null, 'p95' => null];

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            'name' => 'name', 'success' => 'success', 'failed' => 'failed', 'total' => 'count', 'avg' => 'avg', 'p95' => 'p95',
        ], 'name', 'asc');

        return Inertia::render('Commands/Index', [
            ...$period->toProps(),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'search' => $request->query('search'),
            'graph' => Inertia::defer(fn () => $this->graph($period, $bindings), 'charts'),
            'stats' => Inertia::defer(fn () => $this->stats($bindings), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'groups' => Inertia::defer(fn () => $this->groups($request, $environment, $bindings, $orderBy), 'table'),
        ]);
    }

    /**
     * The command page, or its charts and latest runs as JSON for the
     * details drawer on the index page.
     */
    public function show(Request $request, Environment $environment, string $group): Response|JsonResponse
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period, ['group' => $group]);
        $name = $this->clickhouse->value(
            'SELECT any(name) FROM commands WHERE environment_id = {environment:UUID} AND group = {group:String}',
            $bindings,
        );

        abort_if($name === null || $name === '', 404);

        $where = 'AND group = {group:String}';

        if ($request->wantsJson() && ! $request->header('X-Inertia')) {
            return response()->json([
                ...$period->toProps(),
                'group' => $group,
                'name' => $name,
                'graph' => $this->graph($period, $bindings, $where),
                'stats' => $this->stats($bindings, $where),
                'deployments' => Deployments::forPeriod($environment, $period),
                'commands' => $this->commands($request, $environment, $bindings, 10),
            ]);
        }

        return Inertia::render('Commands/Show', [
            ...$period->toProps(),
            'group' => $group,
            'name' => $name,
            'threshold' => $this->threshold($environment, $group),
            'issues' => Issue::where('application_id', $environment->application_id)->where('issueable_type', 'command')->where('group', $group)->get(['ref', 'status', 'title']),
            'over' => $request->query('over'),
            'failed' => $request->query('failed'),
            'graph' => Inertia::defer(fn () => $this->graph($period, $bindings, $where), 'charts'),
            'stats' => Inertia::defer(fn () => $this->stats($bindings, $where), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'filterStats' => Inertia::defer(fn () => $this->selectFirst(
                'SELECT '.self::COUNTS." FROM commands WHERE {$this->scope()} {$where}".$this->overFilter($request, $environment, $group),
                $bindings,
            ), 'commands'),
            'commands' => Inertia::defer(fn () => $this->commands($request, $environment, $bindings), 'commands'),
        ]);
    }

    public function execution(Request $request, Environment $environment, string $group, string $traceId, Traces $traces): Response
    {
        $row = $this->clickhouse->first(
            'SELECT * FROM commands WHERE environment_id = {environment:UUID} AND group = {group:String} AND trace_id = {trace:String} ORDER BY timestamp LIMIT 1',
            ['environment' => $environment->id, 'group' => $group, 'trace' => $traceId],
        );

        abort_unless($row, 404);

        $row = Graph::cast($row);
        $summary = $traces->summary($environment, $traceId, $row['timestamp']);
        $timeline = $traces->executions($environment, $traceId, $row['timestamp']);
        $children = $traces->exceptionsAndLogs($environment, $traceId, $row['timestamp']);

        return Inertia::render('Commands/Execution', [
            'command' => [
                ...collect($row)->only([
                    'trace_id', 'timestamp', 'group', 'class', 'name', 'command', 'exit_code', 'duration', 'deploy', 'server',
                    'peak_memory_usage', 'exception_preview', 'context',
                ])->all(),
                'events' => array_sum(array_column($summary, 'count')),
                'stages' => collect(['bootstrap', 'action', 'terminating'])->mapWithKeys(fn ($stage) => [$stage => $row[$stage]])->all(),
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

    private function threshold(Environment $environment, string $group): ?int
    {
        return Threshold::where('application_id', $environment->application_id)->where('type', 'command')->where('group', $group)->value('threshold_ms');
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function graph(Period $period, array $bindings, string $where = ''): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, '.self::COUNTS.', '.$this->durationAggregates()."
             FROM commands WHERE {$this->scope()} {$where} GROUP BY bucket ORDER BY bucket",
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
            'SELECT '.self::COUNTS.', '.$this->durationAggregates()." FROM commands WHERE {$this->scope()} {$where}",
            $bindings,
        );
    }

    /**
     * Every command run in the period, grouped by name. The page expects a
     * plain list here, not a paginator.
     *
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function groups(Request $request, Environment $environment, array $bindings, string $orderBy): array
    {
        $filter = '';

        if ($request->filled('search')) {
            $bindings['search'] = $request->string('search')->toString();
            $filter = ' AND positionCaseInsensitive(commands.name, {search:String}) > 0';
        }

        $rows = array_map(self::nullifyEmptyAggregates(...), $this->select(
            'SELECT group, any(name) AS name, '.self::COUNTS.', '.$this->durationAggregates()."
             FROM commands WHERE {$this->scope()} {$filter}
             GROUP BY group ORDER BY {$orderBy}, group LIMIT 500",
            $bindings,
        ));

        $thresholds = Threshold::where('application_id', $environment->application_id)
            ->where('type', 'command')
            ->whereIn('group', array_column($rows, 'group'))
            ->pluck('threshold_ms', 'group');

        return array_map(fn ($row) => [...$row, 'threshold' => $thresholds[$row['group']] ?? null], $rows);
    }

    /**
     * Runs of one command, newest first, filtered by ?failed= and ?over=.
     *
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function commands(Request $request, Environment $environment, array $bindings, int $perPage = 25): array
    {
        $where = $this->scope().' AND group = {group:String}'.$this->cursorWhere($request, $bindings);
        $where .= match ($request->query('failed')) {
            '0' => ' AND exit_code = 0',
            '1' => ' AND exit_code != 0',
            default => '',
        };

        $where .= $this->overFilter($request, $environment, $bindings['group']);

        $rows = $this->select(
            "SELECT timestamp, trace_id, group, command, exit_code, exit_code != 0 AS failed, duration, exception_preview
             FROM commands WHERE {$where} ORDER BY timestamp DESC LIMIT ".($perPage + 1),
            $bindings,
        );

        $rows = array_map(fn ($row) => [...$row, 'failed' => (bool) $row['failed']], $rows);

        return $this->cursorPaginator($request, $rows, $perPage);
    }

    /**
     * Condition for ?over=avg|p95|threshold, comparing against the period's
     * stats for the group.
     */
    private function overFilter(Request $request, Environment $environment, string $group): string
    {
        return match ($request->query('over')) {
            'avg' => " AND duration >= (SELECT avg(duration) FROM commands WHERE {$this->scope()} AND group = {group:String})",
            'p95' => " AND duration >= (SELECT quantile(0.95)(duration) FROM commands WHERE {$this->scope()} AND group = {group:String})",
            'threshold' => ($ms = $this->threshold($environment, $group)) ? ' AND duration >= '.((int) $ms * 1000) : '',
            default => '',
        };
    }
}
