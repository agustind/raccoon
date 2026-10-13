<?php

namespace App\Queries;

use App\ClickHouse\ClickHouse;
use App\Models\Environment;

/**
 * Builds the timeline ("executions" prop) and event summary for detail pages
 * of requests, commands, job attempts and scheduled task runs.
 *
 * Linking rules (from the agent):
 * - requests and commands: child events have execution_id = the trace_id.
 * - job attempts keep the dispatching trace_id; child events have
 *   execution_id = attempt_id.
 * - scheduled tasks: child events have execution_id = the task's trace_id.
 */
class Traces
{
    private const STAGES = [
        'request' => [
            'bootstrap' => 'bootstrap',
            'before_middleware' => 'middleware',
            'action' => 'action',
            'render' => 'render',
            'after_middleware' => 'middleware',
            'sending' => 'sending',
            'terminating' => 'terminating',
        ],
        'command' => [
            'bootstrap' => 'bootstrap',
            'action' => 'action',
            'terminating' => 'terminating',
        ],
    ];

    public const MAX_JOB_ATTEMPTS = 50;

    public function __construct(private ClickHouse $clickhouse)
    {
        //
    }

    /**
     * Every execution sharing the trace, oldest first, with spans.
     *
     * @return array{executions: list<array<string, mixed>>, job_attempts_loaded: int, job_attempts_total: int}
     */
    public function executions(Environment $environment, string $traceId, string $around): array
    {
        $bindings = [
            'environment' => $environment->id,
            'trace' => $traceId,
            'start' => date('Y-m-d H:i:s', strtotime($around.' UTC') - 86400),
            'end' => date('Y-m-d H:i:s', strtotime($around.' UTC') + 86400),
        ];
        $window = 'environment_id = {environment:UUID} AND trace_id = {trace:String} AND timestamp BETWEEN {start:DateTime64(6)} AND {end:DateTime64(6)}';

        $requests = Graph::castAll($this->clickhouse->select("SELECT * FROM requests WHERE {$window} ORDER BY timestamp LIMIT 1", $bindings));
        $commands = Graph::castAll($this->clickhouse->select("SELECT * FROM commands WHERE {$window} ORDER BY timestamp LIMIT 5", $bindings));
        $tasks = Graph::castAll($this->clickhouse->select("SELECT * FROM scheduled_tasks WHERE {$window} ORDER BY timestamp LIMIT 5", $bindings));
        $jobsTotal = (int) $this->clickhouse->value("SELECT count() FROM job_attempts WHERE {$window}", $bindings);
        $jobs = Graph::castAll($this->clickhouse->select("SELECT * FROM job_attempts WHERE {$window} ORDER BY timestamp LIMIT ".self::MAX_JOB_ATTEMPTS, $bindings));

        $executions = [];

        foreach ($requests as $row) {
            $executions[] = $this->execution('request', $row['trace_id'], $row['route_path'] ?: parse_url($row['url'], PHP_URL_PATH), $row, [
                'status' => $row['status_code'],
                'variant' => $row['status_code'] >= 500 ? 'danger' : ($row['status_code'] >= 400 ? 'warning' : 'success'),
            ]);
        }

        foreach ($commands as $row) {
            $executions[] = $this->execution('command', $row['trace_id'], $row['name'], $row, [
                'status' => $row['exit_code'],
                'variant' => $row['exit_code'] === 0 ? 'success' : 'danger',
            ]);
        }

        foreach ($tasks as $row) {
            $executions[] = $this->execution('scheduled_task', $row['trace_id'], $row['name'], $row, [
                'status' => $row['status'],
                'variant' => match ($row['status']) {
                    'failed' => 'danger', 'skipped' => 'warning', default => 'success'
                },
            ]);
        }

        foreach ($jobs as $row) {
            $executions[] = $this->execution('job', $row['attempt_id'], $row['name'], $row, [
                'status' => $row['status'],
                'variant' => match ($row['status']) {
                    'failed' => 'danger', 'released' => 'warning', default => 'default'
                },
                'link' => ['group' => $row['group'], 'job_id' => $row['job_id'], 'attempt_id' => $row['attempt_id']],
            ]);
        }

        usort($executions, fn ($a, $b) => strcmp($a['timestamp'], $b['timestamp']));

        $spans = $this->spans($environment, array_column($executions, 'id'), $bindings['start'], $bindings['end']);
        $start = isset($executions[0]) ? self::micros($executions[0]['timestamp']) : 0;

        foreach ($executions as &$execution) {
            $execution['offset'] = self::micros($execution['timestamp']) - $start;
            $execution['stages'] = $this->stages($execution, $spans[$execution['id']] ?? []);
            unset($execution['row']);
        }

        return [
            'executions' => $executions,
            'job_attempts_loaded' => count($jobs),
            'job_attempts_total' => $jobsTotal,
        ];
    }

    /**
     * Count and total duration of child events for one execution.
     *
     * @return array<string, array{count: int, duration: int}>
     */
    public function summary(Environment $environment, string $executionId, string $around): array
    {
        $bindings = [
            'environment' => $environment->id,
            'execution' => $executionId,
            'start' => date('Y-m-d H:i:s', strtotime($around.' UTC') - 86400),
            'end' => date('Y-m-d H:i:s', strtotime($around.' UTC') + 86400),
        ];

        $summary = [];

        foreach (['queries' => 'queries', 'mail' => 'mail', 'notifications' => 'notifications', 'outgoing_requests' => 'outgoing_requests', 'queued_jobs' => 'queued_jobs', 'cache_events' => 'cache_events'] as $key => $table) {
            $row = $this->clickhouse->first(
                "SELECT count() AS count, sum(duration) AS duration FROM {$table}
                 WHERE environment_id = {environment:UUID} AND execution_id = {execution:String}
                 AND timestamp BETWEEN {start:DateTime64(6)} AND {end:DateTime64(6)}",
                $bindings,
            );
            $summary[$key] = ['count' => (int) ($row['count'] ?? 0), 'duration' => (int) ($row['duration'] ?? 0)];
        }

        return $summary;
    }

    /**
     * Exceptions and logs recorded inside one execution.
     *
     * @return array{exceptions: list<array<string, mixed>>, logs: list<array<string, mixed>>}
     */
    public function exceptionsAndLogs(Environment $environment, string $executionId, string $around): array
    {
        $bindings = [
            'environment' => $environment->id,
            'execution' => $executionId,
            'start' => date('Y-m-d H:i:s', strtotime($around.' UTC') - 86400),
            'end' => date('Y-m-d H:i:s', strtotime($around.' UTC') + 86400),
        ];
        $where = 'environment_id = {environment:UUID} AND execution_id = {execution:String} AND timestamp BETWEEN {start:DateTime64(6)} AND {end:DateTime64(6)}';

        return [
            'exceptions' => Graph::castAll($this->clickhouse->select(
                "SELECT timestamp, group, class, message, file, line, handled, code FROM exceptions WHERE {$where} ORDER BY timestamp LIMIT 100",
                $bindings,
            )),
            'logs' => Graph::castAll($this->clickhouse->select(
                "SELECT timestamp, level, message, context, extra FROM logs WHERE {$where} ORDER BY timestamp LIMIT 500",
                $bindings,
            )),
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function execution(string $type, string $id, ?string $description, array $row, array $extra): array
    {
        return [
            'id' => $id,
            'name' => $type,
            'description' => (string) $description,
            'duration' => (int) $row['duration'],
            'timestamp' => $row['timestamp'],
            'offset' => 0,
            ...$extra,
            'row' => $row,
        ];
    }

    /**
     * @param  array<string, mixed>  $execution
     * @param  list<array<string, mixed>>  $spans
     * @return list<array<string, mixed>>
     */
    private function stages(array $execution, array $spans): array
    {
        $start = self::micros($execution['timestamp']);
        $stageNames = self::STAGES[$execution['name']] ?? ['action' => 'action'];
        $row = $execution['row'];
        $stages = [];
        $offset = 0;

        foreach ($stageNames as $id => $name) {
            $duration = count($stageNames) === 1 ? (int) $execution['duration'] : (int) ($row[$id] ?? 0);
            $stageSpans = [];

            foreach ($spans as $span) {
                if (count($stageNames) === 1 || $span['execution_stage'] === $id) {
                    $span['offset'] = max(0, self::micros($span['timestamp']) - $start);
                    unset($span['execution_stage']);
                    $stageSpans[] = $span;
                }
            }

            $stages[] = ['id' => $id, 'name' => $name, 'description' => '', 'duration' => $duration, 'offset' => $offset, 'spans' => $stageSpans];
            $offset += $duration;
        }

        return $stages;
    }

    /**
     * @param  list<string>  $executionIds
     * @return array<string, list<array<string, mixed>>>
     */
    private function spans(Environment $environment, array $executionIds, string $start, string $end): array
    {
        if ($executionIds === []) {
            return [];
        }

        $where = 'environment_id = {environment:UUID} AND execution_id IN {ids:Array(String)} AND timestamp BETWEEN {start:DateTime64(6)} AND {end:DateTime64(6)}';
        $common = 'execution_id, execution_stage, group, timestamp, duration';

        $sql = "SELECT * FROM (\n".implode("\nUNION ALL\n", [
            "SELECT {$common}, 'query' AS span_type, file, line, 'query' AS name, sql AS description, connection, connection_type, '' AS queue, '' AS extra FROM queries WHERE {$where}",
            "SELECT {$common}, 'cache_event' AS span_type, '' AS file, 0 AS line, concat('cache ', type) AS name, key AS description, store AS connection, '' AS connection_type, '' AS queue, toString(ttl) AS extra FROM cache_events WHERE {$where}",
            "SELECT {$common}, 'outgoing_request' AS span_type, '' AS file, 0 AS line, concat(method, ' ', toString(status_code)) AS name, url AS description, host AS connection, '' AS connection_type, '' AS queue, toString(status_code) AS extra FROM outgoing_requests WHERE {$where}",
            "SELECT {$common}, 'mail' AS span_type, '' AS file, 0 AS line, 'mail' AS name, class AS description, mailer AS connection, '' AS connection_type, '' AS queue, subject AS extra FROM mail WHERE {$where}",
            "SELECT {$common}, 'notification' AS span_type, '' AS file, 0 AS line, 'notification' AS name, class AS description, channel AS connection, '' AS connection_type, '' AS queue, '' AS extra FROM notifications WHERE {$where}",
            "SELECT {$common}, 'queued_job' AS span_type, '' AS file, 0 AS line, 'job dispatch' AS name, queued_jobs.name AS description, connection, '' AS connection_type, queue, job_id AS extra FROM queued_jobs WHERE {$where}",
            "SELECT execution_id, execution_stage, group, timestamp, toUInt64(0) AS duration, 'exception' AS span_type, file, line, 'exception' AS name, concat(class, ': ', message) AS description, '' AS connection, '' AS connection_type, '' AS queue, if(handled, 'handled', 'unhandled') AS extra FROM exceptions WHERE {$where}",
        ])."\n) ORDER BY timestamp LIMIT 5000";

        $rows = Graph::castAll($this->clickhouse->select($sql, [
            'environment' => $environment->id,
            'ids' => $executionIds,
            'start' => $start,
            'end' => $end,
        ]));

        $byExecution = [];

        foreach ($rows as $row) {
            $id = $row['execution_id'];
            unset($row['execution_id']);
            $byExecution[$id][] = $row;
        }

        return $byExecution;
    }

    public static function micros(string $timestamp): int
    {
        [$date, $fraction] = array_pad(explode('.', $timestamp, 2), 2, '0');

        return strtotime($date.' UTC') * 1_000_000 + (int) str_pad(substr($fraction, 0, 6), 6, '0');
    }
}
