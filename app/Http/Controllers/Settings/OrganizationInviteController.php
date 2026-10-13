<?php

namespace App\Http\Controllers\Settings;

use App\Models\Organization;
use App\Models\OrganizationInvite;
use App\Notifications\OrganizationInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrganizationInviteController extends SettingsController
{
    public const EXPIRES_IN_DAYS = 7;

    public function store(Request $request, Organization $organization): RedirectResponse
    {
        $role = $this->authorizeOrganization($request, $organization, 'organization_invite.create');

        $data = $request->validate([
            'email' => [
                'required', 'string', 'lowercase', 'email', 'max:255',
                function (string $attribute, string $value, \Closure $fail) use ($organization) {
                    if ($organization->users()->where('email', $value)->exists()) {
                        $fail('This person is already a member.');
                    }
                },
            ],
            // Only owners can hand out the owner role.
            'role' => ['required', Rule::in($role === 'owner' ? ['owner', 'admin', 'member'] : ['admin', 'member'])],
        ]);

        $organization->invites()->where('email', $data['email'])->delete();

        $invite = $organization->invites()->create([
            ...$data,
            'invited_by' => $request->user()->id,
            'token' => Str::random(64),
            'expires_at' => now()->addDays(self::EXPIRES_IN_DAYS),
        ]);

        $this->send($invite);

        return back()->with('success', "Invited {$invite->email}.");
    }

    public function resend(Request $request, Organization $organization, OrganizationInvite $invite): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'organization_invite.edit');

        $invite->update(['expires_at' => now()->addDays(self::EXPIRES_IN_DAYS)]);
        $this->send($invite);

        return back()->with('success', "Resent the invite to {$invite->email}.");
    }

    public function destroy(Request $request, Organization $organization, OrganizationInvite $invite): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'organization_invite.delete');

        $invite->delete();

        return back()->with('success', "Revoked the invite for {$invite->email}.");
    }

    private function send(OrganizationInvite $invite): void
    {
        Notification::route('mail', $invite->email)->notify(new OrganizationInvitation($invite, OrganizationController::inviteUrl($invite)));
    }
}
