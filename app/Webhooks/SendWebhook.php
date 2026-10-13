<?php

namespace App\Webhooks;

use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * POSTs an event to a webhook and records the delivery.
 *
 * Receivers verify `X-Raccoon-Signature: sha256=<hex>`, where <hex> is the
 * HMAC-SHA256 of the raw body keyed with the webhook secret. A connection
 * error records the delivery with a null status_code.
 */
class SendWebhook
{
    public const EVENTS = ['issue.created', 'issue.reopened', 'issue.resolved', 'issue.assigned', 'threshold.exceeded'];

    /**
     * @param  array<string, mixed>  $data
     */
    public function send(Webhook $webhook, string $event, array $data): WebhookDelivery
    {
        $payload = [
            'id' => (string) Str::uuid(),
            'event' => $event,
            'created_at' => now()->toIso8601ZuluString(),
            'data' => $data,
        ];
        $body = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'User-Agent' => 'Raccoon-Webhooks/1.0',
                    'X-Raccoon-Event' => $event,
                    'X-Raccoon-Signature' => 'sha256='.hash_hmac('sha256', $body, $webhook->secret),
                ])
                ->withBody($body, 'application/json')
                ->post($webhook->url);

            $status = $response->status();
            $responseBody = Str::limit($response->body(), 2000);
        } catch (Throwable $e) {
            $status = null;
            $responseBody = Str::limit($e->getMessage(), 2000);
        }

        return $webhook->deliveries()->create([
            'event' => $event,
            'payload' => $payload,
            'status_code' => $status,
            'response' => $responseBody,
        ]);
    }

    public static function secret(): string
    {
        return Str::random(48);
    }
}
