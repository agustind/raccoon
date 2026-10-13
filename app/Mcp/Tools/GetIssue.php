<?php

namespace App\Mcp\Tools;

use App\ClickHouse\ClickHouse;
use App\Mcp\Support\Markdown;
use App\Models\Environment;
use App\Models\Issue;
use App\Queries\Exceptions;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use RuntimeException;

#[IsReadOnly]
class GetIssue extends RaccoonTool
{
    protected string $name = 'get_issue';

    protected string $description = 'One issue in full: status and history, the exception with its application stack frames and source code around them, and recent occurrences with the request or job they happened in.';

    public function __construct(ClickHouse $clickhouse, private Exceptions $exceptions)
    {
        parent::__construct($clickhouse);
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'ref' => $schema->integer()->required()->description('Issue number, e.g. 12 for #12.'),
        ];
    }

    public function handle(Request $request): Response
    {
        $environment = $this->environment($request);
        $issue = Issue::where('application_id', $environment->application_id)->where('ref', (int) $request->get('ref'))->with(['assignee', 'activities.user'])->first();

        if (! $issue) {
            throw new RuntimeException("No issue #{$request->get('ref')} in this application.");
        }

        $lines = [
            "# Issue #{$issue->ref}: {$issue->title}",
            '',
            'Dashboard: '.$this->url($environment, "issues/{$issue->ref}"),
            '',
            '## Details',
            '',
            "- Status: {$issue->status}",
            "- Type: {$issue->issueable_type}",
            '- Assignee: '.($issue->assignee?->name ?? 'unassigned'),
            "- First seen: {$issue->first_seen_at} UTC, last seen: {$issue->last_seen_at} UTC",
            "- Occurrences (all environments): {$issue->occurrences}",
        ];

        if ($issue->subtitle) {
            $lines[] = '';
            $lines[] = $issue->subtitle;
        }

        if ($issue->description) {
            $lines = [...$lines, '', '## Description', '', $issue->description];
        }

        if ($issue->issueable_type === 'exception') {
            $lines = [...$lines, '', ...$this->exception($environment, $issue)];
        } else {
            $lines = [...$lines, '', "This is a performance issue: the {$issue->issueable_type}'s p95 went over its threshold. Inspect it with get_route or slow_jobs."];
        }

        $activity = $issue->activities->take(15);

        if ($activity->isNotEmpty()) {
            $lines = [...$lines, '', '## Activity', ''];

            foreach ($activity as $entry) {
                $comment = $entry->data['comment'] ?? null;
                $lines[] = "- {$entry->created_at} ".($entry->user?->name ?? 'Raccoon').' '.str_replace('_', ' ', $entry->type).($comment ? ": {$comment}" : '');
            }
        }

        return Response::text(implode("\n", $lines)."\n");
    }

    /**
     * @return list<string>
     */
    private function exception(Environment $environment, Issue $issue): array
    {
        $details = $this->exceptions->details([$environment->id], $issue->group);

        if (! $details) {
            return ['_No stored occurrences in this environment (they may be older than the retention period)._'];
        }

        $lines = ['## Exception', '', "**{$details['class']}**: ".Markdown::oneLine($details['message'], 2000), '', "At {$details['file']}:{$details['line']}"];

        if ($details['last_laravel_version'] || $details['last_php_version']) {
            $lines[] = "Laravel {$details['last_laravel_version']}, PHP {$details['last_php_version']}";
        }

        $lines = [...$lines, '', '### Stack trace (application frames; vendor frames collapsed)', '', '```'];
        $vendor = 0;

        foreach ($details['trace'] as $index => $frame) {
            if (str_starts_with($frame['file'], 'vendor/') && $index > 0) {
                $vendor++;

                continue;
            }

            if ($vendor > 0) {
                $lines[] = "... {$vendor} vendor ".($vendor === 1 ? 'frame' : 'frames');
                $vendor = 0;
            }

            $caller = $details['trace'][$index + 1]['source'] ?? '';
            $lines[] = "#{$index} {$frame['file']}".($caller !== '' ? " {$caller}" : '');
        }

        if ($vendor > 0) {
            $lines[] = "... {$vendor} vendor ".($vendor === 1 ? 'frame' : 'frames');
        }

        $lines[] = '```';

        foreach (array_slice(array_filter($details['trace'], fn ($frame) => $frame['code'] !== null && ! str_starts_with($frame['file'], 'vendor/')), 0, 3) as $frame) {
            $lines = [...$lines, '', "### {$frame['file']}", '', '```php'];

            foreach ((array) $frame['code'] as $number => $text) {
                $lines[] = "{$number}: {$text}";
            }

            $lines[] = '```';
        }

        $recent = $this->select(
            'SELECT timestamp, execution_source, execution_preview, trace_id, execution_id, user, message FROM exceptions
             WHERE environment_id = {environment:UUID} AND group = {group:String} ORDER BY timestamp DESC LIMIT 10',
            ['environment' => $environment->id, 'group' => $issue->group],
        );

        $lines = [...$lines, '', '## Recent occurrences', '', 'For a request source, pass its trace id to get_request; for a job, the execution id is the attempt id for get_job_attempt.', ''];
        $lines[] = Markdown::table(['Date (UTC)', 'Source', 'Where', 'User id', 'Trace id', 'Execution id'], array_map(fn ($row) => [
            substr($row['timestamp'], 0, 19), $row['execution_source'], Markdown::oneLine($row['execution_preview'], 100), $row['user'] ?: 'guest', $row['trace_id'], $row['execution_id'],
        ], $recent));

        return $lines;
    }
}
