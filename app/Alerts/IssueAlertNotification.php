<?php

namespace App\Alerts;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class IssueAlertNotification extends Notification
{
    private const HEADLINES = [
        'issue.created' => 'New issue',
        'issue.reopened' => 'Issue reopened',
        'issue.assigned' => 'Issue assigned to you',
        'threshold.exceeded' => 'Performance threshold exceeded',
    ];

    public function __construct(public Alert $alert)
    {
        //
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $issue = $this->alert->issue;
        $environment = $this->alert->environment;
        $headline = self::HEADLINES[$this->alert->event] ?? 'Issue update';
        $where = "{$environment->application->name} ({$environment->name})";

        $message = (new MailMessage)
            ->subject("[{$where}] {$headline} #{$issue->ref}: ".str($issue->title)->limit(80))
            ->greeting("{$headline} in {$where}")
            ->line("**#{$issue->ref} {$issue->title}**");

        if ($issue->subtitle) {
            $message->line(str($issue->subtitle)->limit(300)->toString());
        }

        if ($threshold = $this->alert->extra['threshold'] ?? null) {
            $message->line("P95 over the last 5 minutes was {$threshold['p95_ms']}ms, above the {$threshold['threshold_ms']}ms threshold.");
        }

        return $message
            ->line("Occurrences: {$issue->occurrences}. First seen {$issue->first_seen_at?->toDayDateTimeString()} UTC.")
            ->action('View issue', $this->alert->url())
            ->salutation('You can change which alerts you receive in your notification settings.');
    }
}
