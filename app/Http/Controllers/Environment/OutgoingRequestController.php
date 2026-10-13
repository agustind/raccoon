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

class OutgoingRequestController extends EnvironmentController
{
    use ResolvesExecutionSources;

    private const STATUS_COUNTS = "count() AS count, countIf(status_code < 400) AS `2xx`, countIf(status_code >= 400 AND status_code < 500) AS `4xx`, countIf(status_code >= 500) AS `5xx`";

    private const EMPTY_GRAPH = ['count' => 0, '2xx' => 0, '4xx' => 0, '5xx' => 0, 'min' => null, 'max' => null, 'avg' => null, 'p95' => null];

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        $filter = $this->userFilter($request, $bindings);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            'host' => 'host', 'count' => 'count', '2xx' => '`2xx`', '4xx' => '`4xx`', '5xx' => '`5xx`', 'avg' => 'avg', 'p95' => 'p95',
        ], 'host', 'asc');

        return Inertia::render('OutgoingRequests/Index', [
            ...$period->toProps(),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'activeUserFilter' => $request->query('user'),
            'search' => $request->query('search'),
            'graph' => Inertia::defer(fn () => $this->graph($period, $bindings, $filter), 'charts'),
            'stats' => Inertia::defer(fn () => $this->stats($bindings, $filter), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'groups' => Inertia::defer(fn () => $this->groups($request, $bindings, $filter, $orderBy), 'table'),
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
        $host = $this->clickhouse->value(
            'SELECT host FROM outgoing_requests WHERE environment_id = {environment:UUID} AND group = {group:String} ORDER BY timestamp DESC LIMIT 1',
            $bindings,
        );

        abort_if($host === null, 404);

        $filter = ' AND group = {group:String}'.$this->userFilter($request, $bindings);
        $durationFilter = $this->durationFilter($request, $filter);
        $statusFilter = match ($request->query('status')) {
            '2xx' => ' AND status_code < 400',
            '4xx' => ' AND status_code >= 400 AND status_code < 500',
            '5xx' => ' AND status_code >= 500',
            default => '',
        };

        $props = [
            ...$period->toProps(),
            'group' => $group,
            'host' => $host,
            'activeUserFilter' => $request->query('user'),
            'status' => $request->query('status'),
            'over' => $request->query('over'),
        ];

        $deferred = [
            'deployments' => fn () => Deployments::forPeriod($environment, $period),
            'graph' => fn () => $this->graph($period, $bindings, $filter),
            'outgoingRequests' => fn () => $this->requests($request, $environment, $bindings, $filter.$durationFilter.$statusFilter),
            'stats' => fn () => $this->stats($bindings, $filter),
            // Status counts follow the duration filter so the tabs match the list.
            'filterStats' => fn () => $this->selectFirst(
                'SELECT '.self::STATUS_COUNTS." FROM outgoing_requests WHERE {$this->scope()} {$filter}{$durationFilter}",
                $bindings,
            ),
        ];

        if ($request->wantsJson() && ! $request->inertia()) {
            return response()->json([...$props, ...array_map(fn ($resolve) => $resolve(), $deferred)]);
        }

        return Inertia::render('OutgoingRequests/Show', [...$props, ...array_map(fn ($resolve) => Inertia::defer($resolve), $deferred)]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function graph(Period $period, array $bindings, string $filter): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, '.self::STATUS_COUNTS.', '.$this->durationAggregates()."
             FROM outgoing_requests WHERE {$this->scope()} {$filter} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        return Graph::fill($period, $rows, self::EMPTY_GRAPH);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function stats(array $bindings, string $filter): array
    {
        return $this->selectFirst(
            'SELECT '.self::STATUS_COUNTS.', '.$this->durationAggregates()." FROM outgoing_requests WHERE {$this->scope()} {$filter}",
            $bindings,
        );
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function groups(Request $request, array $bindings, string $filter, string $orderBy): array
    {
        if ($request->filled('search')) {
            $bindings['search'] = $request->string('search')->toString();
            // Qualified because the select aliases any(host) as host.
            $filter .= ' AND positionCaseInsensitive(outgoing_requests.host, {search:String}) > 0';
        }

        $total = (int) $this->clickhouse->value("SELECT uniqExact(group) FROM outgoing_requests WHERE {$this->scope()} {$filter}", $bindings);

        $rows = $this->select(
            'SELECT group, any(host) AS host, '.self::STATUS_COUNTS.', '.$this->durationAggregates()."
             FROM outgoing_requests WHERE {$this->scope()} {$filter}
             GROUP BY group ORDER BY {$orderBy}, group LIMIT 25 OFFSET {$this->offset($request)}",
            $bindings,
        );

        return $this->paginator($request, $rows, $total);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function requests(Request $request, Environment $environment, array $bindings, string $filter): array
    {
        $perPage = min(100, max(1, $request->integer('calls_per_page', 25)));
        $where = $this->scope().$filter.$this->cursorWhere($request, $bindings);

        $rows = $this->select(
            "SELECT timestamp, trace_id, execution_source, execution_id, execution_preview, method, url, status_code, duration
             FROM outgoing_requests WHERE {$where} ORDER BY timestamp DESC LIMIT ".($perPage + 1),
            $bindings,
        );

        $paginator = $this->cursorPaginator($request, $rows, $perPage);
        $paginator['data'] = $this->withExecutionUrls($environment, $paginator['data']);

        return $paginator;
    }

    /**
     * ?over=avg|p95 keeps requests at or above the group's average or p95.
     */
    private function durationFilter(Request $request, string $filter): string
    {
        $stat = match ($request->query('over')) {
            'avg' => 'avg(duration)',
            'p95' => 'quantile(0.95)(duration)',
            default => null,
        };

        return $stat ? " AND duration >= (SELECT {$stat} FROM outgoing_requests WHERE {$this->scope()} {$filter})" : '';
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
