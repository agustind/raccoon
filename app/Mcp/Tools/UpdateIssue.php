<?php

namespace App\Mcp\Tools;

use App\Models\Issue;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Facades\DB;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsIdempotent;
use RuntimeException;

#[IsIdempotent]
class UpdateIssue extends RaccoonTool
{
    protected string $name = 'update_issue';

    protected string $description = 'Change an issue\'s status (open, resolved, ignored) and/or add a comment, e.g. to note the fix you made. Needs a token with write access.';

    public function schema(JsonSchema $schema): array
    {
        return [
            ...$this->environmentSchema($schema),
            'ref' => $schema->integer()->required()->description('Issue number.'),
            'status' => $schema->string()->enum(Issue::STATUSES)->description('New status.'),
            'comment' => $schema->string()->description('Comment for the activity log, e.g. what was changed and in which commit.'),
        ];
    }

    public function handle(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->tokenCan('write')) {
            return Response::error('This token is read-only. Create a token with write access in Settings → Profile.');
        }

        $environment = $this->environment($request);
        $issue = Issue::where('application_id', $environment->application_id)->where('ref', (int) $request->get('ref'))->first();

        if (! $issue) {
            throw new RuntimeException("No issue #{$request->get('ref')} in this application.");
        }

        $status = $request->get('status');
        $comment = trim((string) $request->get('comment', '')) ?: null;

        if (! $status && ! $comment) {
            return Response::error('Pass a status, a comment, or both.');
        }

        DB::transaction(function () use ($issue, $environment, $user, $status, $comment) {
            $status
                ? $issue->updateStatus($status, $environment, $user, $comment)
                : $issue->log('comment_added', $user, ['comment' => $comment]);
        });

        $issue->refresh();

        return Response::text("Issue #{$issue->ref} is now {$issue->status}.".($comment ? ' Comment added.' : '').' '.$this->url($environment, "issues/{$issue->ref}"));
    }
}
