<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Markdown;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class SearchLogs extends RaccoonTool
{
    protected string $name = 'search_logs';

    protected string $description = 'Search application log entries by text and level, newest first, with the request or job each came from.';

    private const LEVELS = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'query' => $schema->string()->description('Text the message must contain (case-sensitive).'),
            'min_level' => $schema->string()->enum(self::LEVELS)->description('Lowest level to include, e.g. warning for warning and above.'),
            'period' => $this->periodSchema($schema),
            'limit' => $schema->integer()->min(1)->max(200)->description('Entries to return, default 50.'),
        ];
    }

    public function handle(Request $request): Response
    {
        $environment = $this->environment($request);
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        $where = $this->scope();

        if ($query = (string) $request->get('query', '')) {
            $bindings['query'] = $query;
            $where .= ' AND position(message, {query:String}) > 0';
        }

        if (in_array($level = $request->get('min_level'), self::LEVELS, true)) {
            $bindings['levels'] = array_slice(self::LEVELS, array_search($level, self::LEVELS, true));
            $where .= ' AND level IN {levels:Array(String)}';
        }

        $limit = min(200, max(1, (int) $request->get('limit', 50)));
        $rows = $this->select("SELECT timestamp, level, message, context, execution_source, execution_preview, trace_id FROM logs WHERE {$where} ORDER BY timestamp DESC LIMIT {$limit}", $bindings);

        $lines = array_map(function ($row) {
            $context = $row['context'] && ! in_array($row['context'], ['{}', '[]'], true) ? "\n  context: ".Markdown::oneLine($row['context'], 400) : '';

            return '- '.substr($row['timestamp'], 0, 19)." [{$row['level']}] ".Markdown::oneLine($row['message'], 600)
                ."\n  from {$row['execution_source']} ".Markdown::oneLine($row['execution_preview'], 100)." (trace {$row['trace_id']})".$context;
        }, $rows);

        return Response::text($this->header('Logs', $environment, $period)."\n".($lines ? implode("\n", $lines) : '_no matching log entries_'));
    }
}
