<?php

namespace App\Mcp\Support;

use App\Models\Deployment;
use App\Models\Environment;
use App\Queries\Traces;

/**
 * Markdown report for one execution (request or job attempt): details, event
 * summary, repeated queries, slowest events, the timeline, exceptions and logs.
 * The server-side twin of the dashboard's "Copy for AI" export.
 */
class ExecutionReport
{
    private const MAX_TIMELINE = 150;

    public function __construct(private Traces $traces)
    {
        //
    }

    /**
     * @param  array<string, string|int|float|null>  $fields
     */
    public function build(Environment $environment, string $title, string $traceId, string $executionId, string $timestamp, string $deploy, array $fields, string $url): string
    {
        $summary = $this->traces->summary($environment, $executionId, $timestamp);
        $timeline = $this->traces->executions($environment, $traceId, $timestamp);
        $children = $this->traces->exceptionsAndLogs($environment, $executionId, $timestamp);
        $deployment = $deploy !== '' ? Deployment::where('environment_id', $environment->id)->where('deploy', $deploy)->first() : null;

        $lines = ["# {$title}", '', "Dashboard: {$url}", '', '## Details', ''];

        foreach ($fields as $label => $value) {
            if ($value !== null && $value !== '') {
                $lines[] = "- **{$label}:** {$value}";
            }
        }

        if ($deployment) {
            $lines[] = '- **Deployment:** '.trim(($deployment->ref ? substr($deployment->ref, 0, 7).' ' : '').($deployment->name ? strtok($deployment->name, "\n") : $deployment->deploy));
        }

        $lines[] = '';
        $lines[] = '## Events';
        $lines[] = '';
        $lines[] = Markdown::table(['Type', 'Count', 'Total time'], array_map(
            fn ($type, $row) => [str_replace('_', ' ', $type), $row['count'], $row['count'] ? Markdown::duration($row['duration']) : '-'],
            array_keys($summary),
            $summary,
        ));
        $lines[] = '';

        $current = collect($timeline['executions'])->firstWhere('id', $executionId) ?? ($timeline['executions'][0] ?? null);
        $spans = $current ? collect($current['stages'])->flatMap(fn ($stage) => array_map(fn ($span) => [...$span, 'stage' => $stage['name']], $stage['spans']))->values() : collect();

        if ($current) {
            $lines[] = '## Stages';
            $lines[] = '';

            foreach ($current['stages'] as $stage) {
                if ($stage['duration'] > 0 || $stage['spans'] !== []) {
                    $lines[] = "- {$stage['name']}: ".Markdown::duration($stage['duration']).', '.count($stage['spans']).' '.(count($stage['spans']) === 1 ? 'event' : 'events');
                }
            }

            $lines[] = '';
        }

        $repeated = $spans->where('span_type', 'query')->groupBy('description')
            ->filter(fn ($group) => $group->count() > 1)
            ->sortByDesc(fn ($group) => $group->sum('duration'));

        if ($repeated->isNotEmpty()) {
            $lines[] = '## Repeated queries (possible N+1)';
            $lines[] = '';

            foreach ($repeated as $sql => $group) {
                $locations = $group->filter(fn ($span) => $span['file'])->map(fn ($span) => "{$span['file']}:{$span['line']}")->unique()->implode(', ');
                $lines[] = "- {$group->count()}x, ".Markdown::duration($group->sum('duration')).' total'.($locations ? ", from {$locations}" : '');
                $lines[] = '';
                $lines[] = '```sql';
                $lines[] = $sql;
                $lines[] = '```';
                $lines[] = '';
            }
        }

        $slowest = $spans->sortByDesc('duration')->take(5)->filter(fn ($span) => $span['duration'] > 0);

        if ($slowest->isNotEmpty()) {
            $lines[] = '## Slowest events';
            $lines[] = '';

            foreach ($slowest as $span) {
                $lines[] = '- '.Markdown::duration($span['duration'])." {$span['span_type']}: ".Markdown::oneLine($span['description'], 400).self::location($span);
            }

            $lines[] = '';
        }

        if ($spans->isNotEmpty()) {
            $lines[] = '## Timeline';
            $lines[] = '';
            $lines[] = 'Offset from the start, duration, type, stage, details.';
            $lines[] = '';

            foreach ($spans->take(self::MAX_TIMELINE) as $span) {
                $meta = implode(', ', array_filter([$span['connection'], $span['connection_type'], $span['queue']]));
                $lines[] = '- +'.Markdown::duration($span['offset']).' | '.Markdown::duration($span['duration'])." | {$span['span_type']}".($meta ? " ({$meta})" : '')." | {$span['stage']}".self::location($span).' | '.Markdown::oneLine($span['description'], 400);
            }

            if ($spans->count() > self::MAX_TIMELINE) {
                $lines[] = '- … '.($spans->count() - self::MAX_TIMELINE).' more events';
            }

            $lines[] = '';
        }

        $others = collect($timeline['executions'])->filter(fn ($execution) => $execution['id'] !== ($current['id'] ?? null));

        if ($others->isNotEmpty()) {
            $lines[] = '## Other executions in this trace';
            $lines[] = '';

            foreach ($others as $execution) {
                $lines[] = '- '.str_replace('_', ' ', $execution['name'])." {$execution['description']}: ".Markdown::duration($execution['duration']).", status {$execution['status']}, starts at +".Markdown::duration($execution['offset']);
            }

            $lines[] = '';
        }

        if ($children['exceptions'] !== []) {
            $lines[] = '## Exceptions';
            $lines[] = '';

            foreach ($children['exceptions'] as $exception) {
                $lines[] = "- **{$exception['class']}** (".($exception['handled'] ? 'handled' : 'unhandled').") at {$exception['file']}:{$exception['line']}: ".Markdown::oneLine($exception['message'], 500);
            }

            $lines[] = '';
        }

        if ($children['logs'] !== []) {
            $lines[] = '## Logs';
            $lines[] = '';

            foreach (array_slice($children['logs'], 0, 100) as $log) {
                $context = $log['context'] && ! in_array($log['context'], ['{}', '[]'], true) ? ' '.Markdown::oneLine($log['context'], 300) : '';
                $lines[] = "- {$log['timestamp']} [{$log['level']}] ".Markdown::oneLine($log['message'], 500).$context;
            }
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * @param  array<string, mixed>  $span
     */
    private static function location(array $span): string
    {
        return $span['file'] ? " @ {$span['file']}".($span['line'] ? ":{$span['line']}" : '') : '';
    }
}
