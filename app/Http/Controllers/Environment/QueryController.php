<?php

namespace App\Http\Controllers\Environment;

use App\Http\Controllers\Environment\Concerns\ResolvesExecutionSources;
use App\Models\Environment;
use App\Queries\Deployments;
use App\Queries\Graph;
use App\Queries\Period;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QueryController extends EnvironmentController
{
    use ResolvesExecutionSources;

    private const EMPTY_GRAPH = ['count' => 0, 'min' => null, 'max' => null, 'avg' => null, 'p95' => null];

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        $filter = $this->filters($request, $bindings);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            'sql' => 'sql', 'connection' => 'connection', 'count' => 'count', 'total' => 'total', 'avg' => 'avg', 'p95' => 'p95',
        ], 'sql', 'asc');

        return Inertia::render('Queries/Index', [
            ...$period->toProps(),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'activeUserFilter' => $request->query('user'),
            'search' => $request->query('search'),
            'connection' => $request->query('connection'),
            'connections' => array_column($this->clickhouse->select(
                "SELECT DISTINCT connection FROM queries WHERE {$this->scope()} ORDER BY connection",
                $this->bindings($environment, $period),
            ), 'connection'),
            'graph' => Inertia::defer(fn () => $this->graph($period, $bindings, $filter), 'charts'),
            'stats' => Inertia::defer(fn () => $this->selectFirst(
                'SELECT count() AS count, '.$this->durationAggregates()." FROM queries WHERE {$this->scope()} {$filter}",
                $bindings,
            ), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'queries' => Inertia::defer(fn () => $this->queries($request, $bindings, $filter, $orderBy), 'table'),
        ]);
    }

    /**
     * Also answers the details drawer, which fetches this URL as JSON with
     * ?calls_per_page=10.
     */
    public function show(Request $request, Environment $environment, string $group): Response|JsonResponse
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period, ['group' => $group]);
        $query = $this->clickhouse->first(
            'SELECT sql, connection FROM queries WHERE environment_id = {environment:UUID} AND group = {group:String} ORDER BY timestamp DESC LIMIT 1',
            $bindings,
        );

        abort_unless($query, 404);

        $filter = ' AND group = {group:String}'.$this->filters($request, $bindings);
        $callsFilter = $filter.$this->durationFilter($request, $filter);

        $props = [
            ...$period->toProps(),
            'query' => $query,
            'group' => $group,
            'activeUserFilter' => $request->query('user'),
            'over' => $request->query('over'),
        ];

        $deferred = [
            'deployments' => fn () => Deployments::forPeriod($environment, $period),
            'graph' => fn () => $this->graph($period, $bindings, $filter),
            'stats' => fn () => $this->selectFirst(
                'SELECT count() AS count, sum(duration) AS total, '.$this->durationAggregates()." FROM queries WHERE {$this->scope()} {$filter}",
                $bindings,
            ),
            'calls' => fn () => $this->calls($request, $environment, $bindings, $callsFilter),
            'filterStats' => fn () => $this->selectFirst("SELECT count() AS count FROM queries WHERE {$this->scope()} {$callsFilter}", $bindings),
        ];

        if ($request->wantsJson() && ! $request->inertia()) {
            return response()->json([...$props, ...array_map(fn ($resolve) => $resolve(), $deferred)]);
        }

        return Inertia::render('Queries/Show', [...$props, ...array_map(fn ($resolve) => Inertia::defer($resolve), $deferred)]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function graph(Period $period, array $bindings, string $filter): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, count() AS count, '.$this->durationAggregates()."
             FROM queries WHERE {$this->scope()} {$filter} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        return Graph::fill($period, $rows, self::EMPTY_GRAPH);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function queries(Request $request, array $bindings, string $filter, string $orderBy): array
    {
        if ($request->filled('search')) {
            $bindings['search'] = $request->string('search')->toString();
            $filter .= ' AND positionCaseInsensitive(queries.sql, {search:String}) > 0';
        }

        $total = (int) $this->clickhouse->value("SELECT uniqExact(group) FROM queries WHERE {$this->scope()} {$filter}", $bindings);

        $rows = $this->select(
            'SELECT group, any(sql) AS sql, any(connection) AS connection, count() AS count, sum(duration) AS total, '.$this->durationAggregates()."
             FROM queries WHERE {$this->scope()} {$filter}
             GROUP BY group ORDER BY {$orderBy}, group LIMIT 25 OFFSET {$this->offset($request)}",
            $bindings,
        );

        return $this->paginator($request, $rows, $total);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function calls(Request $request, Environment $environment, array $bindings, string $filter): array
    {
        $perPage = min(100, max(1, $request->integer('calls_per_page', 25)));
        $where = $this->scope().$filter.$this->cursorWhere($request, $bindings);

        $rows = $this->select(
            "SELECT timestamp, trace_id, file, line, connection_type, duration, execution_source, execution_id, execution_preview
             FROM queries WHERE {$where} ORDER BY timestamp DESC LIMIT ".($perPage + 1),
            $bindings,
        );

        $paginator = $this->cursorPaginator($request, $rows, $perPage);
        $paginator['data'] = $this->withExecutionUrls($environment, $paginator['data']);

        return $paginator;
    }

    /**
     * ?connection= and ?user= filters. Adds their bindings.
     *
     * @param  array<string, mixed>  $bindings
     */
    private function filters(Request $request, array &$bindings): string
    {
        $filter = '';

        if ($request->filled('connection')) {
            $bindings['connection'] = $request->string('connection')->toString();
            $filter .= ' AND queries.connection = {connection:String}';
        }

        if ($request->filled('user')) {
            $bindings['user'] = $request->string('user')->toString();
            $filter .= ' AND user = {user:String}';
        }

        return $filter;
    }

    /**
     * ?over=avg|p95 keeps calls at or above the group's average or p95.
     */
    private function durationFilter(Request $request, string $filter): string
    {
        $stat = match ($request->query('over')) {
            'avg' => 'avg(duration)',
            'p95' => 'quantile(0.95)(duration)',
            default => null,
        };

        return $stat ? " AND duration >= (SELECT {$stat} FROM queries WHERE {$this->scope()} {$filter})" : '';
    }
}
