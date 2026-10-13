<?php

namespace App\Ingest;

use App\ClickHouse\ClickHouse;
use App\Models\Environment;

/**
 * Maps agent records onto ClickHouse tables and fans out side effects
 * (issues, deployments, usage counters).
 */
class RecordIngestor
{
    /**
     * Agent record type => ClickHouse table.
     */
    public const TABLES = [
        'request' => 'requests',
        'command' => 'commands',
        'job-attempt' => 'job_attempts',
        'scheduled-task' => 'scheduled_tasks',
        'query' => 'queries',
        'exception' => 'exceptions',
        'log' => 'logs',
        'queued-job' => 'queued_jobs',
        'mail' => 'mail',
        'notification' => 'notifications',
        'outgoing-request' => 'outgoing_requests',
        'cache-event' => 'cache_events',
        'user' => 'users',
    ];

    public function __construct(
        private ClickHouse $clickhouse,
        private IssueRecorder $issues,
        private DeploymentRecorder $deployments,
    ) {
        //
    }

    /**
     * @param  list<array<string, mixed>>  $records
     * @return array<string, int> Number of records stored per type.
     */
    public function ingest(Environment $environment, array $records): array
    {
        $rows = [];
        $usage = [];
        $deploys = [];

        foreach ($records as $record) {
            $type = $record['t'] ?? null;

            if (! is_array($record) || ! isset(self::TABLES[$type])) {
                continue;
            }

            $row = $this->normalize($environment->id, $record);
            $rows[$type][] = $row;

            $bucket = substr($row['timestamp'], 0, 13).':00:00';
            $usage["{$bucket}|{$type}"] = ($usage["{$bucket}|{$type}"] ?? 0) + 1;

            if (($row['deploy'] ?? '') !== '') {
                $deploys[$row['deploy']] = min($deploys[$row['deploy']] ?? $row['timestamp'], $row['timestamp']);
            }
        }

        foreach ($rows as $type => $typeRows) {
            $this->clickhouse->insert(self::TABLES[$type], $typeRows);
        }

        $this->clickhouse->insert('ingest_usage', collect($usage)->map(function ($events, $key) use ($environment) {
            [$bucket, $type] = explode('|', $key);

            return ['environment_id' => $environment->id, 'bucket' => $bucket, 'type' => $type, 'events' => $events];
        })->values()->all());

        if (isset($rows['exception'])) {
            $this->issues->recordExceptions($environment, $rows['exception']);
        }

        if ($deploys !== []) {
            $this->deployments->recordSeen($environment, $deploys);
        }

        return array_map('count', $rows);
    }

    /**
     * @param  array<string, mixed>  $record
     * @return array<string, mixed>
     */
    private function normalize(string $environmentId, array $record): array
    {
        $row = $record;
        unset($row['v'], $row['t'], $row['_group']);

        $row['environment_id'] = $environmentId;
        $row['timestamp'] = self::formatTimestamp($record['timestamp'] ?? microtime(true));

        if (array_key_exists('_group', $record)) {
            $row['group'] = (string) $record['_group'];
        }

        if (array_key_exists('user', $row)) {
            $row['user'] = (string) ($row['user'] ?? '');
        }

        if (($record['t'] ?? null) === 'user') {
            $row['id'] = (string) ($record['id'] ?? '');
        }

        return $row;
    }

    public static function formatTimestamp(mixed $timestamp): string
    {
        if (is_string($timestamp) && ! is_numeric($timestamp)) {
            return $timestamp;
        }

        $seconds = (int) floor((float) $timestamp);
        $micros = (int) round(((float) $timestamp - $seconds) * 1_000_000);

        if ($micros >= 1_000_000) {
            $seconds++;
            $micros -= 1_000_000;
        }

        return gmdate('Y-m-d H:i:s', $seconds).sprintf('.%06d', $micros);
    }
}
