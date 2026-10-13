<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Markdown;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class TopQueries extends RaccoonTool
{
    protected string $name = 'top_queries';

    protected string $description = 'Database queries ranked by total time, call count, latency or calls per execution. Calls per execution well above 1 for the same SQL is the classic N+1 signal. Includes the code location that ran each query.';

    private const SORTS = ['total_time' => 'total', 'count' => 'calls', 'p95' => 'p95', 'calls_per_execution' => 'per_execution'];

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'period' => $this->periodSchema($schema),
            'sort' => $schema->string()->enum(array_keys(self::SORTS))->description('Ranking, default total_time. Use calls_per_execution to hunt N+1 queries.'),
            'search' => $schema->string()->description('Only queries whose SQL contains this text, e.g. a table name.'),
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
            $filter = ' AND positionCaseInsensitive(sql, {search:String}) > 0';
        }

        $rows = $this->select("SELECT any(sql) AS query, count() AS calls, uniqExact(execution_id) AS executions,
                round(count() / greatest(uniqExact(execution_id), 1), 1) AS per_execution, sum(duration) AS total,
                toUInt64(round(avg(duration))) AS avg, toUInt64(round(quantile(0.95)(duration))) AS p95,
                any(connection) AS connection, topK(3)(concat(file, ':', toString(line))) AS locations,
                topK(3)(execution_preview) AS callers
            FROM queries WHERE {$this->scope()}{$filter} GROUP BY group ORDER BY {$sort} DESC LIMIT {$limit}", $bindings);

        $sections = array_map(fn ($r, $i) => implode("\n", [
            '### '.($i + 1).'. '.Markdown::duration($r['total'])." total, {$r['calls']} calls, {$r['per_execution']} per execution",
            '',
            '```sql',
            $r['query'],
            '```',
            '',
            '- Avg '.Markdown::duration($r['avg']).', p95 '.Markdown::duration($r['p95'])." on {$r['connection']}",
            '- Code: '.(implode(', ', array_filter($r['locations'], fn ($l) => $l !== ':0')) ?: 'framework (no app frame)'),
            '- Called from: '.implode(', ', array_filter($r['callers'])),
        ]), $rows, array_keys($rows));

        return Response::text($this->header('Queries', $environment, $period)."\nSorted by {$request->get('sort', 'total_time')}.\n\n".(implode("\n\n", $sections) ?: '_none_'));
    }
}
