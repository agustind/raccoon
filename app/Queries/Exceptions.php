<?php

namespace App\Queries;

use App\ClickHouse\ClickHouse;
use App\Models\Deployment;

/**
 * Exception group details shared by the exception and issue pages.
 */
class Exceptions
{
    public function __construct(private ClickHouse $clickhouse)
    {
        //
    }

    /**
     * Latest sample of a group plus first/last seen metadata, across the given
     * environments (all time). Null when the group has no stored rows.
     *
     * @param  list<string>  $environmentIds
     * @return array<string, mixed>|null
     */
    public function details(array $environmentIds, string $group): ?array
    {
        $row = $this->clickhouse->first(
            'SELECT count() AS count,
                argMax(class, timestamp) AS class, argMax(code, timestamp) AS code, argMax(file, timestamp) AS file,
                argMax(line, timestamp) AS line, argMax(message, timestamp) AS message, argMax(trace, timestamp) AS trace,
                argMax(handled, timestamp) AS handled,
                argMin(deploy, timestamp) AS first_seen_deploy, argMax(deploy, timestamp) AS last_seen_deploy,
                argMin(php_version, timestamp) AS first_php_version, argMax(php_version, timestamp) AS last_php_version,
                argMin(laravel_version, timestamp) AS first_laravel_version, argMax(laravel_version, timestamp) AS last_laravel_version,
                min(timestamp) AS first_seen_at, max(timestamp) AS last_seen_at,
                argMin(environment_id, timestamp) AS first_environment_id, argMax(environment_id, timestamp) AS last_environment_id
             FROM exceptions WHERE environment_id IN {environments:Array(UUID)} AND group = {group:String}',
            ['environments' => $environmentIds, 'group' => $group],
        );

        if (! $row || (int) $row['count'] === 0) {
            return null;
        }

        $row = Graph::cast($row);
        $row['trace'] = self::decodeTrace((string) $row['trace']);
        $row['code'] = (string) $row['code'];

        return $row;
    }

    /**
     * Frames are {file: "path:line", source, code: {line: text}|null}. Code
     * stays an object so line numbers survive JSON encoding.
     *
     * @return list<array{file: string, source: string, code: object|null}>
     */
    public static function decodeTrace(string $trace): array
    {
        $frames = json_decode($trace, true);

        if (! is_array($frames)) {
            return [];
        }

        return array_values(array_map(fn ($frame) => [
            'file' => (string) ($frame['file'] ?? ''),
            'source' => (string) ($frame['source'] ?? ''),
            'code' => is_array($frame['code'] ?? null) && $frame['code'] !== [] ? (object) $frame['code'] : null,
        ], array_filter($frames, 'is_array')));
    }

    /**
     * The deployment record for a deploy value, in the deployment shape pages use.
     *
     * @return array<string, mixed>|null
     */
    public static function deployment(?string $environmentId, ?string $deploy): ?array
    {
        if (! $environmentId || ! $deploy) {
            return null;
        }

        $deployment = Deployment::where('environment_id', $environmentId)->where('deploy', $deploy)->first();

        return Deployments::present($deployment) ?? [
            'deploy' => $deploy,
            'ref' => null,
            'name' => null,
            'url' => null,
            'timestamp' => null,
        ];
    }
}
