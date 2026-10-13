<?php

namespace App\Alerts;

use App\Events\IssueAssigned;
use App\Events\IssueCreated;
use App\Events\IssueReopened;
use App\Events\IssueStatusUpdated;
use App\Events\ThresholdExceeded;
use App\Models\Environment;
use App\Models\Issue;
use App\Models\User;

/**
 * One issue event, translated into what emails and webhooks need: the
 * webhook event name, the notification preference that gates emails, and
 * the payload.
 */
class Alert
{
    /**
     * @param  string  $event  webhook event name, e.g. issue.created
     * @param  ?string  $preference  notification_preferences column, or null for no email
     * @param  ?User  $recipient  only email this user (assignments) instead of the organization
     * @param  array<string, mixed>  $extra  merged into the webhook data
     */
    public function __construct(
        public readonly string $event,
        public readonly Issue $issue,
        public readonly Environment $environment,
        public readonly ?string $preference,
        public readonly ?User $recipient = null,
        public readonly array $extra = [],
    ) {
        //
    }

    /**
     * Map an issue event to an alert, or null when it should not alert.
     */
    public static function fromEvent(IssueCreated|IssueReopened|IssueAssigned|IssueStatusUpdated|ThresholdExceeded $event): ?self
    {
        // The issue as it was when the event fired, not when the queue runs.
        $issue = $event->issue;
        $environment = $event->environment;

        // Performance issues email once, through threshold.exceeded, so the
        // created/reopened events only reach webhooks.
        $issuePreference = fn (string $preference) => $issue->type === 'performance' ? null : $preference;

        return match (true) {
            $event instanceof IssueCreated => new self('issue.created', $issue, $environment, $issuePreference('issue_created')),
            $event instanceof IssueReopened => new self('issue.reopened', $issue, $environment, $issuePreference('issue_reopened')),
            $event instanceof ThresholdExceeded => new self('threshold.exceeded', $issue, $environment, 'threshold_exceeded', extra: [
                'threshold' => [
                    'type' => $event->threshold->type,
                    'name' => $event->threshold->name,
                    'threshold_ms' => $event->threshold->threshold_ms,
                    'p95_ms' => round($event->p95 / 1000, 2),
                ],
            ]),
            $event instanceof IssueAssigned => $event->assignee
                ? new self('issue.assigned', $issue, $environment, 'issue_assigned', $event->assignee, ['assignee' => self::presentUser($event->assignee)])
                : null,
            $event instanceof IssueStatusUpdated => $event->to === 'resolved' ? new self('issue.resolved', $issue, $environment, null) : null,
            default => null,
        };
    }

    public function url(): string
    {
        return url("/environments/{$this->environment->id}/issues/{$this->issue->ref}");
    }

    /**
     * @return array<string, mixed>
     */
    public function webhookData(): array
    {
        $application = $this->environment->application;
        $issue = $this->issue;

        return [
            'application' => ['id' => $application->id, 'name' => $application->name],
            'environment' => ['id' => $this->environment->id, 'name' => $this->environment->name],
            'issue' => [
                'id' => $issue->id,
                'ref' => $issue->ref,
                'type' => $issue->type,
                'issueable_type' => $issue->issueable_type,
                'group' => $issue->group,
                'title' => $issue->title,
                'subtitle' => $issue->subtitle,
                'status' => $issue->status,
                'priority' => $issue->priority,
                'occurrences' => $issue->occurrences,
                'first_seen_at' => $issue->first_seen_at?->toIso8601ZuluString(),
                'last_seen_at' => $issue->last_seen_at?->toIso8601ZuluString(),
                'url' => $this->url(),
            ],
            ...$this->extra,
        ];
    }

    /**
     * @return array{id: int, name: string, email: string}
     */
    private static function presentUser(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email];
    }
}
