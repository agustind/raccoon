<?php

namespace App\Http\Controllers\Settings;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrganizationMemberController extends SettingsController
{
    public function update(Request $request, Organization $organization, User $user): RedirectResponse
    {
        $role = $this->authorizeOrganization($request, $organization, 'membership.edit');

        $data = $request->validate(['role' => ['required', Rule::in(['owner', 'admin', 'member'])]]);
        $current = $user->pivot->role ?? $user->roleIn($organization);

        // Admins manage admins and members; only owners touch the owner role.
        if ($role !== 'owner' && ($current === 'owner' || $data['role'] === 'owner')) {
            abort(403);
        }

        if ($current === 'owner' && $data['role'] !== 'owner') {
            $this->ensureAnotherOwner($organization, $user);
        }

        $organization->users()->updateExistingPivot($user->id, ['role' => $data['role']]);

        return back()->with('success', "{$user->name} is now ".($data['role'] === 'admin' ? 'an admin' : "a {$data['role']}").'.');
    }

    /**
     * Remove a member, or leave the organization when the user is yourself.
     */
    public function destroy(Request $request, Organization $organization, User $user): RedirectResponse
    {
        $self = $request->user()->is($user);
        $role = $this->authorizeOrganization($request, $organization, $self ? null : 'membership.delete');
        $current = $user->roleIn($organization);

        if (! $self && $current === 'owner' && $role !== 'owner') {
            abort(403);
        }

        if ($current === 'owner') {
            $this->ensureAnotherOwner($organization, $user);
        }

        $organization->users()->detach($user->id);

        if ($user->current_organization_id === $organization->id) {
            $user->forceFill(['current_organization_id' => $user->organizations()->value('organizations.id')])->saveQuietly();
        }

        if ($self) {
            $request->session()->forget('last_environment_id');

            return to_route('home')->with('success', "You left {$organization->name}.");
        }

        return back()->with('success', "Removed {$user->name}.");
    }

    private function ensureAnotherOwner(Organization $organization, User $user): void
    {
        $others = $organization->users()->wherePivot('role', 'owner')->whereKeyNot($user->id)->exists();

        if (! $others) {
            throw ValidationException::withMessages(['role' => 'The organization needs at least one other owner first.']);
        }
    }
}
