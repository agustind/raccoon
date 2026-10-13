<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Environment;
use App\Models\NotificationPreference;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Per-user, per-environment notification switches. Environments without a
 * row use the column defaults (everything on).
 */
class NotificationPreferenceController extends Controller
{
    public const EVENTS = ['issue_created', 'issue_reopened', 'issue_assigned', 'threshold_exceeded'];

    public function edit(Request $request): Response
    {
        return Inertia::render('Settings/Notifications/Edit', [
            'environmentNotificationPreferences' => NotificationPreference::where('user_id', $request->user()->id)
                ->get()
                ->mapWithKeys(fn (NotificationPreference $preference) => [$preference->environment_id => $preference->only(self::EVENTS)])
                ->toArray() ?: new \stdClass,
            'notificationEvents' => [
                ['key' => 'issue_created', 'label' => 'New issues'],
                ['key' => 'issue_reopened', 'label' => 'Reopened issues'],
                ['key' => 'issue_assigned', 'label' => 'Assigned to me'],
                ['key' => 'threshold_exceeded', 'label' => 'Thresholds exceeded'],
            ],
        ]);
    }

    public function update(Request $request, Environment $environment): RedirectResponse
    {
        $environment->loadMissing('application.organization');
        abort_unless($request->user()->belongsToOrganization($environment->application->organization), 404);

        $data = $request->validate(array_fill_keys(self::EVENTS, ['sometimes', 'boolean']));

        NotificationPreference::updateOrCreate(
            ['user_id' => $request->user()->id, 'environment_id' => $environment->id],
            $data,
        );

        return back();
    }
}
