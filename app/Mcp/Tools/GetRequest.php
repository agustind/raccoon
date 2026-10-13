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
class GetRequest extends RaccoonTool
{
    protected string $name = 'get_request';

    protected string $description = 'Everything about one request: details, every query and event in order with durations and file:line, repeated queries (N+1), exceptions, logs and jobs it dispatched.';

    public function __construct(ClickHouse $clickhouse, private ExecutionReport $report)
    {
        parent::__construct($clickhouse);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'trace_id' => $schema->string()->required()->description('Request trace id, e.g. from get_route or the dashboard URL.'),
        ];
    }

    public function handle(Request $request): Response
    {
        $environment = $this->environment($request);
        $traceId = (string) $request->get('trace_id');

        $row = $this->clickhouse->first(
            'SELECT * FROM requests WHERE environment_id = {environment:UUID} AND trace_id = {trace:String} ORDER BY timestamp LIMIT 1',
            ['environment' => $environment->id, 'trace' => $traceId],
        );

        if (! $row) {
            throw new RuntimeException("No request with trace id {$traceId} in this environment.");
        }

        $row = Graph::cast($row);
        $user = $row['user'] !== '' ? $row['user'] : 'guest';

        return Response::text($this->report->build(
            $environment,
            "{$row['method']} ".($row['route_path'] ?: $row['url']).' (request)',
            $traceId,
            $traceId,
            $row['timestamp'],
            (string) $row['deploy'],
            [
                'URL' => "{$row['method']} {$row['url']}",
                'Date' => "{$row['timestamp']} UTC",
                'Status' => $row['status_code'],
                'Duration' => Markdown::duration($row['duration']),
                'Route' => $row['route_name'],
                'Action' => $row['route_action'],
                'Server' => $row['server'],
                'Response size' => Markdown::bytes($row['response_size']),
                'Peak memory' => Markdown::bytes($row['peak_memory_usage']),
                'User id' => $user,
                'Trace id' => $traceId,
            ],
            $this->url($environment, "requests/{$traceId}"),
        ));
    }
}
