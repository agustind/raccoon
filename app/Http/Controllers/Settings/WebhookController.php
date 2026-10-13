<?php

namespace App\Http\Controllers\Settings;

use App\Models\Application;
use App\Models\Organization;
use App\Models\Webhook;
use App\Webhooks\SendWebhook;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Webhooks are managed from the Issues settings tab. The signing secret is
 * only revealed right after creating or rotating it.
 */
class WebhookController extends SettingsController
{
    public function show(Request $request, Organization $organization, Application $application, Webhook $webhook): Response
    {
        $this->authorizeOrganization($request, $organization, 'application.show');

        $failed = $request->query('failed');
        $deliveries = $webhook->deliveries()->reorder()
            ->when($failed === '1', fn ($q) => $q->where(fn ($q) => $q->whereNull('status_code')->orWhere('status_code', '>=', 400)))
            ->when($failed === '0', fn ($q) => $q->where('status_code', '<', 400))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn ($delivery) => [
                'id' => $delivery->id,
                'event' => $delivery->event,
                'status_code' => $delivery->status_code,
                'payload' => $delivery->payload,
                'response' => $delivery->response,
                'created_at' => $delivery->created_at->toIso8601ZuluString(),
            ]);

        return Inertia::render('Settings/Applications/Webhook', [
            ...$this->applicationProps($organization, $application),
            'webhook' => [
                'id' => $webhook->id,
                'name' => $webhook->name,
                'url' => $webhook->url,
                'events' => $webhook->events,
                'enabled' => $webhook->enabled,
            ],
            'webhook_events' => SendWebhook::EVENTS,
            'webhook_secret' => $request->session()->get('webhook_secret'),
            'failed' => $failed,
            'filterStats' => [
                'success' => $webhook->deliveries()->reorder()->where('status_code', '<', 400)->count(),
                'failed' => $webhook->deliveries()->reorder()->where(fn ($q) => $q->whereNull('status_code')->orWhere('status_code', '>=', 400))->count(),
            ],
            'events' => $deliveries,
        ]);
    }

    public function store(Request $request, Organization $organization, Application $application): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'application.edit');

        $secret = SendWebhook::secret();
        $application->webhooks()->create([...$this->validated($request), 'secret' => $secret]);

        return back()->with('success', 'Webhook created.')->with('webhook_secret', $secret);
    }

    public function update(Request $request, Organization $organization, Application $application, Webhook $webhook): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'application.edit');

        // The list's enable/disable toggle only sends `enabled`.
        $webhook->update($request->has('url') ? $this->validated($request) : $request->validate(['enabled' => ['required', 'boolean']]));

        return back()->with('success', $webhook->wasChanged('enabled') && ! $request->has('url') ? ($webhook->enabled ? 'Webhook enabled.' : 'Webhook disabled.') : 'Webhook updated.');
    }

    public function rotateSecret(Request $request, Organization $organization, Application $application, Webhook $webhook): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'application.edit');

        $secret = SendWebhook::secret();
        $webhook->update(['secret' => $secret]);

        return back()->with('success', 'Signing secret rotated.')->with('webhook_secret', $secret);
    }

    public function test(Request $request, Organization $organization, Application $application, Webhook $webhook, SendWebhook $sender): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'application.edit');

        $delivery = $sender->send($webhook, 'test', [
            'message' => 'This is a test event from Raccoon.',
            'application' => ['id' => $application->id, 'name' => $application->name],
        ]);

        return $delivery->status_code !== null && $delivery->status_code < 400
            ? back()->with('success', "Test event delivered ({$delivery->status_code}).")
            : back()->with('error', 'Test event failed: '.($delivery->status_code ? "HTTP {$delivery->status_code}" : $delivery->response));
    }

    public function destroy(Request $request, Organization $organization, Application $application, Webhook $webhook): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'application.edit');

        $webhook->delete();

        return to_route('settings.applications.issues', [$organization, $application])->with('success', 'Webhook deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'url' => ['required', 'url:http,https', 'max:255'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => ['string', Rule::in(SendWebhook::EVENTS)],
            'enabled' => ['boolean'],
        ]);
    }
}
