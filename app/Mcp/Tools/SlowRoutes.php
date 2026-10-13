<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Markdown;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class SlowRoutes extends RaccoonTool
{
    protected string $name = 'slow_routes';

    protected string $description = 'Routes ranked by latency, volume, errors or total time spent, with avg/p95/max durations and average queries per request. Use get_route for one route in detail.';

    private const SORTS = ['total_time' => 'total', 'p95' => 'p95', 'avg' => 'avg', 'count' => 'count', 'errors' => 'c5xx'];

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'period' => $this->periodSchema($schema),
            'sort' => $schema->string()->enum(array_keys(self::SORTS))->description('Ranking. total_time (default) finds where the app spends the most time overall.'),
            'search' => $schema->string()->description('Only routes whose path contains this text.'),
            'limit' => $schema->integer()->min(1)->max(100)->description('Rows to return, default 20.'),
        ];
    }

    public function handle(Request $request): Response
    {
        $environment = $this->environment($request);
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        $sort = self::SORTS[$request->get('sort', 'total_time')] ?? 'total';
        $limit = min(100, max(1, (int) $request->get('limit', 20)));
        $filter = '';

        if ($search = trim((string) $request->get('search', ''))) {
            $bindings['search'] = $search;
            $filter = ' AND positionCaseInsensitive(route_path, {search:String}) > 0';
        }

        $rows = $this->select("SELECT any(route_methods) AS methods, any(route_path) AS path, count() AS count,
                countIf(status_code >= 400 AND status_code < 500) AS c4xx, countIf(status_code >= 500) AS c5xx,
                toUInt64(round(avg(duration))) AS avg, toUInt64(round(quantile(0.95)(duration))) AS p95, max(duration) AS max,
                sum(duration) AS total, round(avg(queries), 1) AS queries
            FROM requests WHERE {$this->scope()}{$filter} GROUP BY group ORDER BY {$sort} DESC LIMIT {$limit}", $bindings);

        $table = Markdown::table(
            ['Route', 'Requests', '4xx', '5xx', 'Avg', 'p95', 'Max', 'Total time', 'Queries/req'],
            array_map(fn ($r) => [implode('|', $r['methods']).' '.($r['path'] ?: '(unmatched)'), $r['count'], $r['c4xx'], $r['c5xx'], Markdown::duration($r['avg']), Markdown::duration($r['p95']), Markdown::duration($r['max']), Markdown::duration($r['total']), $r['queries']], $rows),
        );

        return Response::text($this->header('Routes', $environment, $period)."\nSorted by {$request->get('sort', 'total_time')}.\n\n".$table);
    }
}
