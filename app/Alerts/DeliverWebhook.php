<?php

namespace App\Alerts;

use App\Models\Webhook;
use App\Webhooks\SendWebhook;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use RuntimeException;

/**
 * One webhook delivery. Each attempt is logged in webhook_deliveries by
 * SendWebhook; a failed attempt throws so the queue retries it.
 */
class DeliverWebhook implements ShouldQueue
{
    use Queueable;

    /** The first attempt plus three retries. */
    public int $tries = 4;

    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(public string $webhookId, public string $event, public array $data)
    {
        //
    }

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(SendWebhook $sender): void
    {
        $webhook = Webhook::find($this->webhookId);

        if (! $webhook || ! $webhook->enabled) {
            return;
        }

        $delivery = $sender->send($webhook, $this->event, $this->data);

        if ($delivery->status_code === null || $delivery->status_code >= 400) {
            throw new RuntimeException("Webhook {$webhook->id} delivery {$delivery->id} failed: ".($delivery->status_code ?? $delivery->response));
        }
    }
}
