<?php

namespace App\Mcp\Support;

/**
 * Small Markdown helpers for tool output. Agents read Markdown tables and
 * headed sections more reliably than raw JSON dumps.
 */
class Markdown
{
    /**
     * @param  list<string>  $headers
     * @param  list<list<string|int|float|null>>  $rows
     */
    public static function table(array $headers, array $rows): string
    {
        if ($rows === []) {
            return '_none_';
        }

        $lines = ['| '.implode(' | ', $headers).' |', '|'.str_repeat(' --- |', count($headers))];

        foreach ($rows as $row) {
            $lines[] = '| '.implode(' | ', array_map(fn ($cell) => self::cell($cell), $row)).' |';
        }

        return implode("\n", $lines);
    }

    public static function duration(int|float|null $micros): string
    {
        if ($micros === null) {
            return '-';
        }

        return match (true) {
            $micros < 1000 => round($micros).'μs',
            $micros < 1_000_000 => round($micros / 1000, 2).'ms',
            $micros < 60_000_000 => round($micros / 1_000_000, 2).'s',
            default => round($micros / 60_000_000, 1).'min',
        };
    }

    public static function bytes(int|float|null $bytes): string
    {
        if ($bytes === null) {
            return '-';
        }

        foreach (['B', 'kB', 'MB', 'GB'] as $unit) {
            if ($bytes < 1000 || $unit === 'GB') {
                return round($bytes, 2).' '.$unit;
            }

            $bytes /= 1000;
        }

        return (string) $bytes;
    }

    public static function oneLine(?string $text, int $limit = 300): string
    {
        $text = trim((string) preg_replace('/\s+/', ' ', (string) $text));

        return mb_strlen($text) > $limit ? mb_substr($text, 0, $limit).'…' : $text;
    }

    private static function cell(string|int|float|null $value): string
    {
        return str_replace(['|', "\n"], ['\\|', ' '], (string) ($value ?? ''));
    }
}
