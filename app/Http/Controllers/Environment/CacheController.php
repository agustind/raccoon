<?php

namespace App\Http\Controllers\Environment;

use App\Models\Environment;
use App\Queries\Deployments;
use App\Queries\Graph;
use App\Queries\Period;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CacheController extends EnvironmentController
{
    private const COUNTS = "count() AS count, countIf(type = 'hit') AS hits, countIf(type = 'miss') AS misses, countIf(type = 'write') AS writes, countIf(type = 'delete') AS deletes, countIf(type = 'write-failure') AS write_failures, countIf(type = 'delete-failure') AS delete_failures, write_failures + delete_failures AS total_failures";

    /** Percentage of reads that hit, 0 when there were no reads. */
    private const HIT_RATIO = 'if(hits + misses = 0, 0, round(hits * 100 / (hits + misses), 1)) AS hit_ratio';

    private const EMPTY_GRAPH = ['count' => 0, 'hits' => 0, 'misses' => 0, 'writes' => 0, 'deletes' => 0, 'write_failures' => 0, 'delete_failures' => 0, 'total_failures' => 0];

    /** The top 100 keys, without pagination. */
    private const MAX_KEYS = 100;

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        $filter = $this->userFilter($request, $bindings);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            'key' => 'key', 'hit_ratio' => 'hit_ratio', 'hits' => 'hits', 'misses' => 'misses', 'writes' => 'writes',
            'deletes' => 'deletes', 'total_failures' => 'total_failures', 'count' => 'count',
        ], 'count');

        return Inertia::render('Cache/Index', [
            ...$period->toProps(),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'activeUserFilter' => $request->query('user'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'graph' => Inertia::defer(fn () => $this->graph($period, $bindings, $filter), 'charts'),
            'stats' => Inertia::defer(fn () => $this->selectFirst(
                'SELECT '.self::COUNTS.', '.self::HIT_RATIO." FROM cache_events WHERE {$this->scope()} {$filter}",
                $bindings,
            ), 'charts'),
            'keys' => Inertia::defer(fn () => $this->select(
                'SELECT group, any(store) AS store, any(key) AS key, '.self::COUNTS.', '.self::HIT_RATIO."
                 FROM cache_events WHERE {$this->scope()} {$filter}
                 GROUP BY group ORDER BY {$orderBy}, group LIMIT ".self::MAX_KEYS,
                $bindings,
            ), 'table'),
        ]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function graph(Period $period, array $bindings, string $filter): array
    {
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, '.self::COUNTS."
             FROM cache_events WHERE {$this->scope()} {$filter} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        return Graph::fill($period, $rows, self::EMPTY_GRAPH);
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
