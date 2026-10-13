<?php

namespace App\Http\Controllers\Environment\Concerns;

use App\ClickHouse\ClickHouse;
use App\Models\Environment;

/**
 * Adds `execution_url` (a path inside the environment, or null) to child events
 * such as queries and outgoing requests, so each one links to the request,
 * command, job attempt or scheduled task run it happened in.
 *
 * Commands, job attempts and scheduled tasks need their parent's group in the
 * URL, so those are looked up by execution id. Scheduled tasks send an empty
 * execution_preview; the task name fills it.
 *
 * @property ClickHouse $clickhouse
 */
trait ResolvesExecutionSources
{
    /**
     * @param  list<array<string, mixed>>  $rows  rows with timestamp, trace_id, execution_source, execution_id and execution_preview
     * @return list<array<string, mixed>>
     */
    protected function withExecutionUrls(Environment $environment, array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $timestamps = array_map(fn ($row) => strtotime($row['timestamp'].' UTC'), $rows);
        $bindings = [
            'environment' => $environment->id,
            'start' => gmdate('Y-m-d H:i:s', min($timestamps) - 86400),
            'end' => gmdate('Y-m-d H:i:s', max($timestamps) + 86400),
        ];
        $window = 'environment_id = {environment:UUID} AND timestamp BETWEEN {start:DateTime64(6)} AND {end:DateTime64(6)}';
        $ids = fn (string $source) => array_values(array_unique(array_column(
            array_filter($rows, fn ($row) => $row['execution_source'] === $source),
            'execution_id',
        )));

        $commands = $this->lookupExecutions("SELECT trace_id AS id, any(group) AS group FROM commands WHERE {$window} AND trace_id IN {ids:Array(String)} GROUP BY trace_id", $bindings, $ids('command'));
        $tasks = $this->lookupExecutions("SELECT trace_id AS id, any(group) AS group, any(name) AS name FROM scheduled_tasks WHERE {$window} AND trace_id IN {ids:Array(String)} GROUP BY trace_id", $bindings, $ids('schedule'));
        $jobs = $this->lookupExecutions("SELECT attempt_id AS id, any(group) AS group, any(job_id) AS job_id FROM job_attempts WHERE {$window} AND attempt_id IN {ids:Array(String)} GROUP BY attempt_id", $bindings, $ids('job'));

        return array_map(function (array $row) use ($commands, $tasks, $jobs) {
            $id = $row['execution_id'];

            // Fatal errors are recorded without an execution, sometimes with a
            // zeroed id; there is nothing to link to.
            $missing = fn (?string $value) => $value === null || trim($value, '0-') === '';

            $row['execution_url'] = match (true) {
                $row['execution_source'] === 'request' => $missing($row['trace_id']) ? null : "requests/{$row['trace_id']}",
                $missing($id) => null,
                default => match ($row['execution_source']) {
                    'command' => isset($commands[$id]) ? "commands/{$commands[$id]['group']}/{$id}" : null,
                    'schedule' => isset($tasks[$id]) ? "scheduled-tasks/{$tasks[$id]['group']}/{$id}" : null,
                    'job' => isset($jobs[$id]) ? "jobs/attempts/{$jobs[$id]['group']}/{$jobs[$id]['job_id']}/{$id}" : null,
                    default => null,
                },
            };

            if ($row['execution_source'] === 'schedule' && $row['execution_preview'] === '') {
                $row['execution_preview'] = $tasks[$id]['name'] ?? '';
            }

            return $row;
        }, $rows);
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @param  list<string>  $ids
     * @return array<string, array<string, string>>
     */
    private function lookupExecutions(string $sql, array $bindings, array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return array_column($this->clickhouse->select($sql, [...$bindings, 'ids' => $ids]), null, 'id');
    }
}
