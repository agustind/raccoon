<?php

namespace App\Queries;

/**
 * Turns sparse ClickHouse bucket rows into a dense series with one entry per
 * bucket, filling gaps with the given empty values.
 */
class Graph
{
    /**
     * @param  list<array<string, mixed>>  $rows  rows with a `bucket` key
     * @param  array<string, mixed>  $empty  values for a bucket with no rows
     * @return list<array<string, mixed>>
     */
    public static function fill(Period $period, array $rows, array $empty): array
    {
        $byBucket = [];

        foreach ($rows as $row) {
            $byBucket[$row['bucket']] = $row;
        }

        return array_map(
            fn (string $bucket) => ['bucket' => $bucket, ...$empty, ...self::cast($byBucket[$bucket] ?? [])],
            $period->buckets(),
        );
    }

    /**
     * ClickHouse JSON returns 64-bit integers as strings. Cast numeric strings
     * back so the frontend gets numbers.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public static function cast(array $row): array
    {
        foreach ($row as $key => $value) {
            if (is_string($value) && $key !== 'bucket' && is_numeric($value) && ! in_array($key, self::STRING_KEYS, true)) {
                $row[$key] = str_contains($value, '.') ? (float) $value : (int) $value;
            }
        }

        return $row;
    }

    /**
     * Keys that look numeric but are identifiers.
     */
    public const STRING_KEYS = ['id', 'user', 'group', 'code', 'trace_id', 'execution_id', 'job_id', 'attempt_id', 'line_text', 'deploy'];

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    public static function castAll(array $rows): array
    {
        return array_map(self::cast(...), $rows);
    }
}
