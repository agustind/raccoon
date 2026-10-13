<?php

namespace App\Mcp\Tools;

use App\ClickHouse\ClickHouse;
use App\Mcp\Support\ExecutionReport;
use App\Mcp\Support\Markdown;
use App\Queries\Graph;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use RuntimeException;

#[IsReadOnly]
class GetJobAttempt extends RaccoonTool
{
    protected string $name = 'get_job_attempt';

    protected string $description = 'Everything about one queued job attempt: status, every query and event in order, repeated queries (N+1), exceptions and logs, plus the request that dispatched it.';

    public function __construct(ClickHouse $clickhouse, private ExecutionReport $report)
    {
        parent::__construct($clickhouse);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'attempt_id' => $schema->string()->required()->description('Job attempt id, e.g. from slow_jobs.'),
        ];
    }

    public function handle(Request $request): Response
    {
        $environment = $this->environment($request);
        $attemptId = (string) $request->get('attempt_id');

        $row = $this->clickhouse->first(
            'SELECT * FROM job_attempts WHERE environment_id = {environment:UUID} AND attempt_id = {attempt:String} LIMIT 1',
            ['environment' => $environment->id, 'attempt' => $attemptId],
        );

        if (! $row) {
            throw new RuntimeException("No job attempt {$attemptId} in this environment.");
        }

        $row = Graph::cast($row);

        return Response::text($this->report->build(
            $environment,
            "{$row['name']} (job attempt)",
            $row['trace_id'],
            $attemptId,
            $row['timestamp'],
            (string) $row['deploy'],
            [
                'Status' => $row['status'],
                'Attempt' => $row['attempt'],
                'Date' => "{$row['timestamp']} UTC",
                'Duration' => Markdown::duration($row['duration']),
                'Queue' => "{$row['connection']} / {$row['queue']}",
                'Server' => $row['server'],
                'Peak memory' => Markdown::bytes($row['peak_memory_usage']),
                'Job id' => $row['job_id'],
                'Attempt id' => $attemptId,
            ],
            $this->url($environment, "jobs/attempts/{$row['group']}/{$row['job_id']}/{$attemptId}"),
        ));
    }
}
