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

class IssueSettingsController extends SettingsController
{
    public const AUTO_RESOLVE_DAYS = [7, 14, 30];

    public function edit(Request $request, Organization $organization, Application $application): Response
    {
        $this->authorizeOrganization($request, $organization, 'application.show');

        $webhooks = $application->webhooks()
            ->with(['deliveries' => fn ($q) => $q->limit(1)])
            ->orderBy('created_at')
            ->get()
            ->map(fn (Webhook $webhook) => [
                'id' => $webhook->id,
                'name' => $webhook->name,
                'url' => $webhook->url,
                'events' => $webhook->events,
                'enabled' => $webhook->enabled,
                'last_event' => ($delivery = $webhook->deliveries->first()) ? [
                    'event' => $delivery->event,
                    'status_code' => $delivery->status_code,
                    'created_at' => $delivery->created_at->toIso8601ZuluString(),
                ] : null,
            ]);

        return Inertia::render('Settings/Applications/Issues', [
            ...$this->applicationProps($organization, $application),
            'application' => [
                ...$this->applicationProps($organization, $application)['application'],
                'issue_auto_resolve_in_days' => $application->issue_auto_resolve_in_days,
                'webhooks' => $webhooks,
            ],
            // How many open issues each option would resolve right away.
            'auto_resolve_issues_count' => collect(self::AUTO_RESOLVE_DAYS)->mapWithKeys(fn (int $days) => [
                $days => $application->issues()->where('status', 'open')->where('last_seen_at', '<', now()->subDays($days))->count(),
            ]),
            'auto_resolve_options' => self::AUTO_RESOLVE_DAYS,
            'webhook_events' => SendWebhook::EVENTS,
            'webhook_secret' => $request->session()->get('webhook_secret'),
        ]);
    }

    public function update(Request $request, Organization $organization, Application $application): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'application.edit');

        $application->update($request->validate([
            'issue_auto_resolve_in_days' => ['nullable', 'integer', Rule::in(self::AUTO_RESOLVE_DAYS)],
        ]));

        return back()->with('success', 'Issue settings updated.');
    }
}
