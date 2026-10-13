<?php

namespace App\Http\Controllers\Environment;

use App\Http\Controllers\Environment\Concerns\ResolvesExecutionSources;
use App\Models\Environment;
use App\Models\Issue;
use App\Queries\Deployments;
use App\Queries\Exceptions;
use App\Queries\Graph;
use App\Queries\Period;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ExceptionController extends EnvironmentController
{
    use ResolvesExecutionSources;

    // Qualified names: an alias named like a column would shadow it in later expressions.
    private const COUNTS = 'count() AS count, countIf(exceptions.handled) AS handled, countIf(NOT exceptions.handled) AS unhandled';

    public function index(Request $request, Environment $environment): Response
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        [$sortBy, $sortDirection, $orderBy] = $this->sort($request, [
            'last_seen_at' => 'last_seen_at', 'count' => 'count', 'impacted_users' => 'impacted_users',
        ], 'last_seen_at');

        return Inertia::render('Exceptions/Index', [
            ...$period->toProps(),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'activeUserFilter' => $request->query('user'),
            'search' => $request->query('search'),
            'handled' => $this->handledFilter($request),
            'graph' => Inertia::defer(fn () => $this->graph($request, $period, $bindings), 'charts'),
            'stats' => Inertia::defer(fn () => $this->selectFirst(
                'SELECT '.self::COUNTS." FROM exceptions WHERE {$this->scope()}".$this->userFilter($request, $bindings),
                $bindings,
            ), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'filterStats' => Inertia::defer(fn () => $this->filterStats($request, $bindings), 'table'),
            'exceptions' => Inertia::defer(fn () => $this->exceptions($request, $bindings, $orderBy), 'table'),
        ]);
    }

    public function show(Request $request, Environment $environment, string $group, Exceptions $exceptions): Response
    {
        $details = $exceptions->details([$environment->id], $group);

        abort_unless($details, 404);

        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period, ['group' => $group]);
        $counts = $this->clickhouse->first(
            'SELECT groupUniqArray(1000)(server) AS servers, uniqExactIf(user, user != \'\') AS impacted_users,
                countIf(timestamp >= now64() - INTERVAL 1 DAY) AS day, countIf(timestamp >= now64() - INTERVAL 7 DAY) AS week,
                countIf(timestamp >= now64() - INTERVAL 30 DAY) AS month
             FROM exceptions WHERE environment_id = {environment:UUID} AND group = {group:String}',
            $bindings,
        );

        return Inertia::render('Exceptions/Show', [
            ...$period->toProps(),
            'exception' => [
                ...collect($details)->only(['class', 'code', 'file', 'line', 'message', 'trace', 'handled', 'first_seen_deploy', 'last_seen_deploy',
                    'first_php_version', 'last_php_version', 'first_laravel_version', 'last_laravel_version', 'first_seen_at', 'last_seen_at'])->all(),
                'servers' => array_values(array_filter($counts['servers'] ?? [], fn ($server) => $server !== '')),
                'impacted_users' => (int) ($counts['impacted_users'] ?? 0),
                'occurrences_in_last_24_hours' => (int) ($counts['day'] ?? 0),
                'occurrences_in_last_7_days' => (int) ($counts['week'] ?? 0),
                'occurrences_in_last_30_days' => (int) ($counts['month'] ?? 0),
                'group' => $group,
            ],
            'issues' => Issue::where('application_id', $environment->application_id)
                ->where('issueable_type', 'exception')
                ->where('group', $group)
                ->get(['ref', 'title', 'status', 'priority', 'issueable_type']),
            'activeUserFilter' => $request->query('user'),
            'graph' => Inertia::defer(fn () => $this->graph($request, $period, $bindings, ' AND group = {group:String}', withTotal: true), 'charts'),
            'deployments' => Inertia::defer(fn () => Deployments::forPeriod($environment, $period), 'charts'),
            'occurrences' => Inertia::defer(fn () => $this->occurrences($request, $environment, $bindings), 'table'),
        ]);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    private function graph(Request $request, Period $period, array $bindings, string $where = '', bool $withTotal = false): array
    {
        $where .= $this->userFilter($request, $bindings);
        $rows = $this->select(
            'SELECT '.$this->bucket().' AS bucket, '.self::COUNTS.($withTotal ? ', count() AS total' : '')."
             FROM exceptions WHERE {$this->scope()} {$where} GROUP BY bucket ORDER BY bucket",
            $bindings,
        );

        return Graph::fill($period, $rows, ['count' => 0, ...($withTotal ? ['total' => 0] : []), 'unhandled' => 0, 'handled' => 0]);
    }

    /**
     * Number of exception groups per handled state.
     *
     * @param  array<string, mixed>  $bindings
     * @return array{handled: int, unhandled: int}
     */
    private function filterStats(Request $request, array $bindings): array
    {
        $where = $this->scope().$this->userFilter($request, $bindings).$this->searchFilter($request, $bindings);
        $row = $this->selectFirst("SELECT uniqExactIf(group, exceptions.handled) AS handled, uniqExactIf(group, NOT exceptions.handled) AS unhandled FROM exceptions WHERE {$where}", $bindings);

        return ['handled' => (int) ($row['handled'] ?? 0), 'unhandled' => (int) ($row['unhandled'] ?? 0)];
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function exceptions(Request $request, array $bindings, string $orderBy): array
    {
        $where = $this->scope().$this->userFilter($request, $bindings).$this->searchFilter($request, $bindings);

        if (($handled = $this->handledFilter($request)) !== null) {
            $bindings['handled'] = $handled === '1';
            $where .= ' AND exceptions.handled = {handled:Bool}';
        }

        $total = (int) $this->clickhouse->value("SELECT uniqExact(group) FROM exceptions WHERE {$where}", $bindings);

        $rows = $this->select(
            "SELECT count() AS count, uniqExactIf(user, user != '') AS impacted_users, max(timestamp) AS last_seen_at, group,
                argMax(class, timestamp) AS class, argMax(code, timestamp) AS code, argMax(file, timestamp) AS file,
                argMax(line, timestamp) AS line, argMax(message, timestamp) AS message, argMax(handled, timestamp) AS handled
             FROM exceptions WHERE {$where}
             GROUP BY group ORDER BY {$orderBy}, group LIMIT 25 OFFSET {$this->offset($request)}",
            $bindings,
        );

        return $this->paginator($request, array_map(fn ($row) => [...$row, 'code' => (string) $row['code'], 'message' => (string) $row['message']], $rows), $total);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return array<string, mixed>
     */
    private function occurrences(Request $request, Environment $environment, array $bindings): array
    {
        $where = $this->scope().' AND group = {group:String}'.$this->userFilter($request, $bindings);
        $total = (int) $this->clickhouse->value("SELECT count() FROM exceptions WHERE {$where}", $bindings);

        $rows = $this->select(
            "SELECT timestamp, message, user, trace_id, execution_id, execution_source, execution_preview
             FROM exceptions WHERE {$where} ORDER BY timestamp DESC LIMIT 25 OFFSET {$this->offset($request)}",
            $bindings,
        );

        $users = $this->users($environment, array_column($rows, 'user'));
        $rows = array_map(fn ($row) => [...$row, 'message' => (string) $row['message'], 'user' => self::presentUser($users, $row['user'])], $rows);

        return $this->paginator($request, $this->withExecutionUrls($environment, $rows), $total);
    }

    private function handledFilter(Request $request): ?string
    {
        $handled = $request->query('handled');

        return in_array($handled, ['0', '1'], true) ? $handled : null;
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

        return ' AND exceptions.user = {user:String}';
    }

    /**
     * @param  array<string, mixed>  $bindings
     */
    private function searchFilter(Request $request, array &$bindings): string
    {
        if (! $request->filled('search')) {
            return '';
        }

        $bindings['search'] = $request->string('search')->toString();

        return ' AND (positionCaseInsensitive(exceptions.class, {search:String}) > 0 OR positionCaseInsensitive(exceptions.message, {search:String}) > 0)';
    }
}
