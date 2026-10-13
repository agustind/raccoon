<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Markdown;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use RuntimeException;

#[IsReadOnly]
class GetRoute extends RaccoonTool
{
    protected string $name = 'get_route';

    protected string $description = 'One route in detail: latency and status breakdown, the queries it runs most (with calls per request, to spot N+1), and its slowest recent requests with trace ids for get_request.';

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'route' => $schema->string()->required()->description('Route path as shown by slow_routes, e.g. "/api/{cliente_id}/alertas". Optionally prefixed with the method, e.g. "POST /orders".'),
            'period' => $this->periodSchema($schema),
        ];
    }

    public function handle(Request $request): Response
    {
        $environment = $this->environment($request);
        $period = $this->period($request);
        $route = trim((string) $request->get('route'));
        $method = null;

        if (preg_match('/^([A-Z|]+)\s+(\S.*)$/', $route, $match)) {
            [$method, $route] = [explode('|', $match[1])[0], $match[2]];
        }

        $bindings = $this->bindings($environment, $period, ['path' => $route]);
        $methodFilter = '';

        if ($method) {
            $bindings['method'] = $method;
            $methodFilter = ' AND has(route_methods, {method:String})';
        }

        $where = $this->scope().' AND route_path = {path:String}'.$methodFilter;
        $stats = $this->select("SELECT count() AS count, countIf(status_code < 400) AS ok, countIf(status_code >= 400 AND status_code < 500) AS c4xx, countIf(status_code >= 500) AS c5xx,
                toUInt64(round(avgOrNull(duration))) AS avg, toUInt64(round(quantileOrNull(0.95)(duration))) AS p95, maxOrNull(duration) AS max,
                round(avg(queries), 1) AS queries, any(route_action) AS action FROM requests WHERE {$where}", $bindings)[0] ?? ['count' => 0];

        if ((int) $stats['count'] === 0) {
            throw new RuntimeException("No requests to \"{$request->get('route')}\" in the last {$period->label()}. Check the path with slow_routes.");
        }

        $slowest = $this->select("SELECT timestamp, trace_id, method, url, status_code, duration, queries, exception_preview FROM requests WHERE {$where} ORDER BY duration DESC LIMIT 10", $bindings);

        // Queries run inside this route's requests, grouped by SQL.
        $queries = $this->select("SELECT any(sql) AS sql, count() AS calls, uniqExact(execution_id) AS requests, sum(duration) AS total, toUInt64(round(quantile(0.95)(duration))) AS p95,
                any(file) AS file, any(line) AS line
            FROM queries WHERE {$this->scope()} AND execution_source = 'request'
              AND execution_id IN (SELECT trace_id FROM requests WHERE {$where})
            GROUP BY group ORDER BY total DESC LIMIT 15", $bindings);

        $text = $this->header(($method ? "{$method} " : '').$route, $environment, $period)."\n".implode("\n", [
            '## Stats',
            '',
            "- Action: {$stats['action']}",
            "- Requests: {$stats['count']} (2xx/3xx {$stats['ok']}, 4xx {$stats['c4xx']}, 5xx {$stats['c5xx']})",
            '- Avg '.Markdown::duration($stats['avg']).', p95 '.Markdown::duration($stats['p95']).', max '.Markdown::duration($stats['max']),
            "- Queries per request (avg): {$stats['queries']}",
            '',
            '## Queries this route runs',
            '',
            'Calls/request above 1 for the same SQL usually means an N+1.',
            '',
            Markdown::table(['SQL', 'Calls', 'Calls/request', 'Total', 'p95', 'Location'], array_map(fn ($q) => [
                Markdown::oneLine($q['sql'], 250), $q['calls'], round($q['calls'] / max(1, $q['requests']), 1), Markdown::duration($q['total']), Markdown::duration($q['p95']), $q['file'] ? "{$q['file']}:{$q['line']}" : '',
            ], $queries)),
            '',
            '## Slowest requests',
            '',
            Markdown::table(['Date (UTC)', 'URL', 'Status', 'Duration', 'Queries', 'Trace id'], array_map(fn ($r) => [
                substr($r['timestamp'], 0, 19), Markdown::oneLine($r['url'], 120), $r['status_code'], Markdown::duration($r['duration']), $r['queries'], $r['trace_id'],
            ], $slowest)),
        ]);

        return Response::text($text);
    }
}
