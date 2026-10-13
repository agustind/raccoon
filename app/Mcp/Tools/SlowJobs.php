<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Markdown;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class SlowJobs extends RaccoonTool
{
    protected string $name = 'slow_jobs';

    protected string $description = 'Queued jobs ranked by total time, latency or failures, with the slowest and latest failed attempt ids for get_job_attempt.';

    private const SORTS = ['total_time' => 'total', 'p95' => 'p95', 'failures' => 'failed', 'count' => 'count'];

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'period' => $this->periodSchema($schema),
            'sort' => $schema->string()->enum(array_keys(self::SORTS))->description('Ranking, default total_time.'),
            'limit' => $schema->integer()->min(1)->max(100)->description('Rows to return, default 20.'),
        ];
    }

    public function handle(Request $request): Response
    {
        $environment = $this->environment($request);
        $period = $this->period($request);
        $sort = self::SORTS[$request->get('sort', 'total_time')] ?? 'total';
        $limit = min(100, max(1, (int) $request->get('limit', 20)));

        $rows = $this->select("SELECT any(name) AS name, count() AS count, countIf(status = 'failed') AS failed, countIf(status = 'released') AS released,
                toUInt64(round(avg(duration))) AS avg, toUInt64(round(quantile(0.95)(duration))) AS p95, max(duration) AS max, sum(duration) AS total,
                round(avg(queries), 1) AS queries, argMax(attempt_id, duration) AS slowest_attempt,
                argMaxIf(attempt_id, timestamp, status = 'failed') AS last_failed_attempt
            FROM job_attempts WHERE {$this->scope()} GROUP BY group ORDER BY {$sort} DESC LIMIT {$limit}", $this->bindings($environment, $period));

        $table = Markdown::table(
            ['Job', 'Attempts', 'Failed', 'Released', 'Avg', 'p95', 'Max', 'Total time', 'Queries/attempt', 'Slowest attempt', 'Last failed attempt'],
            array_map(fn ($r) => [$r['name'], $r['count'], $r['failed'], $r['released'], Markdown::duration($r['avg']), Markdown::duration($r['p95']), Markdown::duration($r['max']), Markdown::duration($r['total']), $r['queries'], $r['slowest_attempt'], $r['failed'] > 0 ? $r['last_failed_attempt'] : ''], $rows),
        );

        return Response::text($this->header('Jobs', $environment, $period)."\n".$table);
    }
}
