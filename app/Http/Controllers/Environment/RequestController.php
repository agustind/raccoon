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
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RequestController extends EnvironmentController
{
    private const STATUS_COUNTS = 'count() AS count, countIf(status_code < 400) AS `2xx`, countIf(status_code >= 400 AND status_code < 500) AS `4xx`, countIf(status_code >= 500) AS `5xx`';

    private const EMPTY_GRAPH = ['count' => 0, '2xx' => 0, '4xx' => 0, '5xx' => 0, 'min' => null, 'max' => null, 'avg' => null, 'p95' => null];

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            'path' => 'path', 'count' => 'count', '2xx' => '`2xx`', '4xx' => '`4xx`', '5xx' => '`5xx`', 'avg' => 'avg', 'p95' => 'p95',
        ], 'path', 'asc');

        return Inertia::render('Requests/Index', [
            ...$period->toProps(),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'activeUserFilter' => $request->query('user'),
            'search' => $request->query('search'),
            'graph' => Inertia::defer(fn () => $this->graph($environment, $period, $bindings), 'charts'),
            'stats' => Inertia::defer(fn () => $this->stats($bindings), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'routes' => Inertia::defer(fn () => $this->routes($request, $environment, $bindings, $orderBy), 'routes'),
        ]);
    }

    public function route(Request $request, Environment $environment, string $group): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period, ['group' => $group]);
        $route = $this->clickhouse->first(
            'SELECT any(route_methods) AS methods, any(route_domain) AS domain, any(route_path) AS path FROM requests WHERE environment_id = {environment:UUID} AND group = {group:String}',
            $bindings,
        );

        abort_if(! $route || $route['path'] === '' && $route['methods'] === [], 404);

        return Inertia::render('Requests/Route', [
            ...$period->toProps(),
            'group' => $group,
            'route' => $route,
            'threshold' => Threshold::where('application_id', $environment->application_id)->where('type', 'route')->where('group', $group)->value('threshold_ms'),
            'issues' => Issue::where('application_id', $environment->application_id)->where('issueable_type', 'route')->where('group', $group)->get(['ref', 'status', 'title']),
            'activeUserFilter' => $request->query('user'),
            'status' => $request->query('status'),
            'duration' => $request->query('duration'),
            'graph' => Inertia::defer(fn () => $this->graph($environment, $period, $bindings, 'AND group = {group:String}'), 'charts'),
            'stats' => Inertia::defer(fn () => $this->stats($bindings, 'AND group = {group:String}'), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'filterStats' => Inertia::defer(fn () => $this->selectFirst(
                'SELECT '.self::STATUS_COUNTS.' FROM requests WHERE '.$this->scope().' AND group = {group:String}',
                $bindings,
            ), 'requests'),
            'requests' => Inertia::defer(fn () => $this->routeRequests($request, $bindings), 'requests'),
        ]);
    }

    public function show(Request $request, Environment $environment, string $traceId, Traces $traces): Response
    {
        $row = $this->clickhouse->first(
            'SELECT * FROM requests WHERE environment_id = {environment:UUID} AND trace_id = {trace:String} ORDER BY timestamp LIMIT 1',
            ['environment' => $environment->id, 'trace' => $traceId],
        );

        abort_unless($row, 404);

        $row = Graph::cast($row);
        $users = $this->users($environment, [$row['user']]);
        $summary = $traces->summary($environment, $traceId, $row['timestamp']);
        $timeline = $traces->executions($environment, $traceId, $row['timestamp']);
        $children = $traces->exceptionsAndLogs($environment, $traceId, $row['timestamp']);

        $request = [
            ...collect($row)->only([
                'trace_id', 'timestamp', 'group', 'method', 'url', 'route_name', 'route_domain', 'route_path', 'route_action',
                'status_code', 'duration', 'deploy', 'server', 'ip', 'request_size', 'response_size', 'peak_memory_usage',
                'context', 'headers', 'payload', 'exception_preview',
            ])->all(),
            'route_methods' => $row['route_methods'],
            'events' => array_sum(array_column($summary, 'count')),
            'user' => self::presentUser($users, $row['user']),
            'stages' => collect(['bootstrap', 'before_middleware', 'action', 'render', 'after_middleware', 'sending', 'terminating'])
                ->mapWithKeys(fn ($stage) => [$stage => $row[$stage]])->all(),
        ];

        return Inertia::render('Requests/Show', [
            'request' => $request,
            'deployment' => Deployments::present(Deployment::where('environment_id', $environment->id)->where('deploy', $row['deploy'])->first()),
            'summary' => $summary,
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
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function graph(Environment $environment, Period $period, array $bindings, string $where = ''): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, '.self::STATUS_COUNTS.', '.$this->durationAggregates()."
             FROM requests WHERE {$this->scope()} {$where} GROUP BY bucket ORDER BY bucket",
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
            'SELECT '.self::STATUS_COUNTS.', '.$this->durationAggregates()." FROM requests WHERE {$this->scope()} {$where}",
            $bindings,
        );
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function routes(Request $request, Environment $environment, array $bindings, string $orderBy): array
    {
        $filter = $this->userFilter($request, $bindings);

        if ($request->filled('search')) {
            $bindings['search'] = $request->string('search')->toString();
            $filter .= ' AND (positionCaseInsensitive(route_path, {search:String}) > 0 OR positionCaseInsensitive(route_name, {search:String}) > 0)';
        }

        $total = (int) $this->clickhouse->value("SELECT uniqExact(group) FROM requests WHERE {$this->scope()} {$filter}", $bindings);

        $rows = $this->select(
            'SELECT group, any(route_methods) AS methods, any(route_domain) AS domain, any(route_path) AS path, '.self::STATUS_COUNTS.', '.$this->durationAggregates()."
             FROM requests WHERE {$this->scope()} {$filter}
             GROUP BY group ORDER BY {$orderBy}, group LIMIT 25 OFFSET {$this->offset($request)}",
            $bindings,
        );

        $thresholds = Threshold::where('application_id', $environment->application_id)
            ->where('type', 'route')
            ->whereIn('group', array_column($rows, 'group'))
            ->pluck('threshold_ms', 'group');

        $rows = array_map(fn ($row) => [...$row, 'threshold' => $thresholds[$row['group']] ?? null], $rows);

        return $this->paginator($request, $rows, $total);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function routeRequests(Request $request, array $bindings): array
    {
        $where = $this->scope().' AND group = {group:String}'.$this->userFilter($request, $bindings).$this->cursorWhere($request, $bindings);
        $where .= match ($request->query('status')) {
            '2xx' => ' AND status_code < 400',
            '4xx' => ' AND status_code >= 400 AND status_code < 500',
            '5xx' => ' AND status_code >= 500',
            default => '',
        };

        if (in_array($request->query('duration'), ['avg', 'p95'], true)) {
            $stat = $request->query('duration') === 'avg' ? 'avg(duration)' : 'quantile(0.95)(duration)';
            $where .= " AND duration >= (SELECT {$stat} FROM requests WHERE {$this->scope()} AND group = {group:String})";
        }

        $rows = $this->select(
            "SELECT timestamp, trace_id, method, url, status_code, duration, exception_preview, group, user
             FROM requests WHERE {$where} ORDER BY timestamp DESC LIMIT 26",
            $bindings,
        );

        return $this->cursorPaginator($request, $rows);
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
