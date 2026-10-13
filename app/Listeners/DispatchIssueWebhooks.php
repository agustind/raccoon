<?php

namespace App\Listeners;

use App\Alerts\Alert;
use App\Alerts\DeliverWebhook;
use App\Events\IssueAssigned;
use App\Events\IssueCreated;
use App\Events\IssueReopened;
use App\Events\IssueStatusUpdated;
use App\Events\ThresholdExceeded;
use App\Models\Webhook;
use Illuminate\Contracts\Queue\ShouldQueue;

/**
 * Queues a delivery for each enabled webhook of the application that
 * subscribes to the event.
 */
class DispatchIssueWebhooks implements ShouldQueue
{
    public function handle(IssueCreated|IssueReopened|IssueAssigned|IssueStatusUpdated|ThresholdExceeded $event): void
    {
        $alert = Alert::fromEvent($event);

        if (! $alert) {
            return;
        }

        $data = $alert->webhookData();

        Webhook::where('application_id', $alert->issue->application_id)
            ->where('enabled', true)
            ->get()
            ->filter(fn (Webhook $webhook) => in_array($alert->event, $webhook->events ?? [], true))
            ->each(fn (Webhook $webhook) => DeliverWebhook::dispatch($webhook->id, $alert->event, $data));
    }
}
