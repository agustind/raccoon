<?php

namespace App\Listeners;

use App\Alerts\Alert;
use App\Alerts\IssueAlertNotification;
use App\Events\IssueAssigned;
use App\Events\IssueCreated;
use App\Events\IssueReopened;
use App\Events\IssueStatusUpdated;
use App\Events\ThresholdExceeded;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Notification;

/**
 * Emails organization members about issue events, honoring their per
 * environment notification preferences (on when they have no row).
 */
class SendIssueEmails implements ShouldQueue
{
    public function handle(IssueCreated|IssueReopened|IssueAssigned|IssueStatusUpdated|ThresholdExceeded $event): void
    {
        $alert = Alert::fromEvent($event);

        if (! $alert || ! $alert->preference) {
            return;
        }

        $users = $alert->recipient
            ? collect([$alert->recipient])
            : User::whereHas('organizations', fn ($query) => $query->where('organizations.id', $alert->environment->application->organization_id))->get();

        $optedOut = NotificationPreference::where('environment_id', $alert->environment->id)
            ->whereIn('user_id', $users->pluck('id'))
            ->where($alert->preference, false)
            ->pluck('user_id');

        $recipients = $users->reject(fn (User $user) => $optedOut->contains($user->id));

        if ($recipients->isNotEmpty()) {
            Notification::send($recipients, new IssueAlertNotification($alert));
        }
    }
}
