<?php

namespace App\Http\Controllers\Settings;

use App\Models\Organization;
use App\Models\OrganizationInvite;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationController extends SettingsController
{
    public function edit(Request $request, Organization $organization): Response
    {
        $role = $this->authorizeOrganization($request, $organization, 'organization.show');
        $canInvite = Permissions::allows($role, 'organization_invite.create');

        return Inertia::render('Settings/Organizations/Edit', [
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'avatar_url' => $organization->avatar_url,
            ],
            'users' => $organization->users()->orderBy('name')->get()->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $user->avatar_url,
                'role' => $user->pivot->role,
            ]),
            'invites' => $organization->invites()->where('expires_at', '>', now())->orderBy('email')->get()->map(fn (OrganizationInvite $invite) => [
                'id' => $invite->id,
                'email' => $invite->email,
                'role' => $invite->role,
                'expires_at' => $invite->expires_at->toIso8601ZuluString(),
                // Lets admins share the link directly when mail isn't set up.
                'url' => $canInvite ? self::inviteUrl($invite) : null,
            ]),
            'roles' => [
                ['value' => 'owner', 'label' => 'Owner', 'description' => 'Full access, including deleting the organization'],
                ['value' => 'admin', 'label' => 'Admin', 'description' => 'Manage members, applications and settings'],
                ['value' => 'member', 'label' => 'Member', 'description' => 'Access to application data and issues only'],
            ],
        ]);
    }

    public function update(Request $request, Organization $organization): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'organization.edit');

        $organization->update($request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]));

        return back()->with('success', 'Organization updated.');
    }

    public function destroy(Request $request, Organization $organization): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'organization.delete');

        $request->validate(['name' => ['required', 'in:'.$organization->name]], ['name.in' => 'The name does not match the organization name.']);

        $request->session()->forget('last_environment_id');
        $organization->delete();

        return to_route('home')->with('success', "Deleted {$organization->name}.");
    }

    public static function inviteUrl(OrganizationInvite $invite): string
    {
        return URL::temporarySignedRoute('invites.show', $invite->expires_at, ['token' => $invite->token]);
    }
}
