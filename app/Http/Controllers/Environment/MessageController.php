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

/**
 * Mail and notifications pages. Both tables group sends by class and share
 * the same index (charts + grouped table) and show (charts + send list) pages.
 */
abstract class MessageController extends EnvironmentController
{
    use ResolvesExecutionSources;

    /** ClickHouse table. */
    protected const TABLE = '';

    /** Inertia page directory, e.g. "Mail". */
    protected const PAGE = '';

    /** Prop name of the send list on the show page. */
    protected const LIST = '';

    /** Columns of one send on the show page, besides the execution columns. */
    protected const COLUMNS = '';

    private const EMPTY_GRAPH = ['count' => 0, 'sent' => 0, 'failed' => 0, 'min' => null, 'max' => null, 'avg' => null, 'p95' => null];

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        $filter = $this->userFilter($request, $bindings);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            'class' => 'class', 'count' => 'count', 'failed' => 'failed', 'avg' => 'avg', 'p95' => 'p95',
        ], 'class', 'asc');

        return Inertia::render(static::PAGE.'/Index', [
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

    public function show(Request $request, Environment $environment, string $group): Response|JsonResponse
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period, ['group' => $group]);
        $row = $this->clickhouse->first(
            'SELECT class FROM '.static::TABLE.' WHERE environment_id = {environment:UUID} AND group = {group:String} LIMIT 1',
            $bindings,
        );

        abort_unless($row, 404);

        $filter = ' AND group = {group:String}'.$this->userFilter($request, $bindings);
        $over = in_array($request->query('over'), ['avg', 'p95'], true) ? $request->query('over') : null;
        $listFilter = $filter.$this->overFilter($over);

        $deferred = [
            'graph' => fn () => $this->graph($period, $bindings, $filter),
            'stats' => fn () => $this->stats($bindings, $filter),
            'deployments' => fn () => Deployments::forPeriod($environment, $period),
            'filterStats' => fn () => $this->selectFirst('SELECT count() AS count FROM '.static::TABLE." WHERE {$this->scope()} {$listFilter}", $bindings),
            static::LIST => fn () => $this->sends($request, $environment, $bindings, $listFilter),
        ];

        $props = [
            ...$period->toProps(),
            'group' => $group,
            'class' => $row['class'],
            'activeUserFilter' => $request->query('user'),
            'over' => $over,
        ];

        // The index page's details drawer fetches this page as plain JSON.
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json([...$props, ...array_map(fn ($resolve) => $resolve(), $deferred)]);
        }

        return Inertia::render(static::PAGE.'/Show', [
            ...$props,
            ...array_map(fn ($resolve) => Inertia::defer($resolve), $deferred),
        ]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function graph(Period $period, array $bindings, string $filter): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, '.$this->counts().', '.$this->durationAggregates().'
             FROM '.static::TABLE." WHERE {$this->scope()} {$filter} GROUP BY bucket ORDER BY bucket",
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
            'SELECT '.$this->counts().', '.$this->durationAggregates().' FROM '.static::TABLE." WHERE {$this->scope()} {$filter}",
            $bindings,
        );
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function groups(Request $request, array $bindings, string $filter, string $orderBy): array
    {
        if ($request->filled('search')) {
            $bindings['search'] = $request->string('search')->toString();
            $filter .= ' AND positionCaseInsensitive(class, {search:String}) > 0';
        }

        return $this->select(
            'SELECT group, any(class) AS class, '.$this->counts().', '.$this->durationAggregates().'
             FROM '.static::TABLE." WHERE {$this->scope()} {$filter}
             GROUP BY group ORDER BY {$orderBy}, group LIMIT 500",
            $bindings,
        );
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function sends(Request $request, Environment $environment, array $bindings, string $filter): array
    {
        $filter .= $this->cursorWhere($request, $bindings);

        $rows = $this->select(
            'SELECT timestamp, trace_id, execution_source, execution_id, execution_preview, user, '.static::COLUMNS.'
             FROM '.static::TABLE." WHERE {$this->scope()} {$filter} ORDER BY timestamp DESC LIMIT 26",
            $bindings,
        );

        $paginator = $this->cursorPaginator($request, $rows);
        $paginator['data'] = $this->withExecutionUrls($environment, $paginator['data']);

        return $paginator;
    }

    /**
     * The alias `failed` shadows the column, so the column is table-qualified.
     */
    private function counts(): string
    {
        $table = static::TABLE;

        return "count() AS count, countIf(NOT {$table}.failed) AS sent, countIf({$table}.failed) AS failed";
    }

    /**
     * "≥ AVG" / "≥ P95" filter, relative to the group's sends in the period.
     */
    private function overFilter(?string $over): string
    {
        if ($over === null) {
            return '';
        }

        $stat = $over === 'avg' ? 'avg(duration)' : 'quantile(0.95)(duration)';

        return " AND duration >= (SELECT {$stat} FROM ".static::TABLE." WHERE {$this->scope()} AND group = {group:String})";
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
