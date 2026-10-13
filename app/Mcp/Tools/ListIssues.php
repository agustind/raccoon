<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Markdown;
use App\Models\Issue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class ListIssues extends RaccoonTool
{
    protected string $name = 'list_issues';

    protected string $description = 'Issues (grouped exceptions and performance threshold breaches) seen in an environment, newest activity first. Use get_issue for the stack trace and occurrences.';

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'status' => $schema->string()->enum(['open', 'resolved', 'ignored', 'all'])->description('Default open.'),
            'type' => $schema->string()->enum(['exception', 'performance', 'all'])->description('Default all.'),
            'limit' => $schema->integer()->min(1)->max(100)->description('Rows to return, default 25.'),
        ];
    }

    public function handle(Request $request): Response
    {
        $environment = $this->environment($request);
        $status = $request->get('status', 'open');
        $type = $request->get('type', 'all');

        $issues = Issue::query()
            ->where('application_id', $environment->application_id)
            ->whereHas('environments', fn ($query) => $query->whereKey($environment->id))
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            ->when($type !== 'all', fn ($query) => $query->where('type', $type))
            ->with('assignee')
            ->orderByDesc('last_seen_at')
            ->limit(min(100, max(1, (int) $request->get('limit', 25))))
            ->get();

        $table = Markdown::table(
            ['Ref', 'Type', 'Status', 'Title', 'Detail', 'Occurrences', 'Last seen (UTC)', 'Assignee'],
            $issues->map(fn (Issue $issue) => [
                "#{$issue->ref}", $issue->issueable_type, $issue->status, $issue->title, Markdown::oneLine($issue->subtitle, 150),
                $issue->occurrences, $issue->last_seen_at->toDateTimeString(), $issue->assignee?->name ?? '',
            ])->all(),
        );

        return Response::text($this->header("Issues ({$status}, {$type})", $environment)."\n".$table);
    }
}
