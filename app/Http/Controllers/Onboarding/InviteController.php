<?php

namespace App\Http\Controllers\Onboarding;

use App\Http\Controllers\Controller;
use App\Models\Environment;
use App\Models\OrganizationInvite;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Invite links are signed and expire with the invite. Guests see who
 * invited them and can sign in or sign up; the token is kept in the session
 * so either flow comes back here (sign up joins right away).
 */
class InviteController extends Controller
{
    public const SESSION_KEY = 'invite_token';

    public function show(Request $request, string $token): Response
    {
        $invite = self::find($token);

        if (! $invite || ! $request->hasValidSignature()) {
            return Inertia::render('Invites/Invalid');
        }

        $user = $request->user();

        if (! $user) {
            $request->session()->put(self::SESSION_KEY, $invite->token);
            $request->session()->put('url.intended', $request->fullUrl());
        } elseif (strcasecmp($user->email, $invite->email) !== 0) {
            return Inertia::render('Invites/EmailMismatch', ['invite_email' => $invite->email]);
        }

        return Inertia::render('Invites/Show', [
            'organization' => ['id' => $invite->organization->id, 'name' => $invite->organization->name, 'avatar_url' => $invite->organization->avatar_url],
            'organization_invite' => ['id' => $invite->id, 'email' => $invite->email, 'role' => $invite->role, 'token' => $invite->token],
            'inviter' => $invite->inviter?->name,
            'can_accept_invite' => $user !== null,
            'has_account' => $user === null && User::where('email', $invite->email)->exists(),
        ]);
    }

    public function accept(Request $request, string $token): RedirectResponse
    {
        $invite = self::find($token);

        if (! $invite || strcasecmp($request->user()->email, $invite->email) !== 0) {
            return to_route('home')->with('error', 'This invite is no longer valid.');
        }

        return self::join($request, $request->user(), $invite);
    }

    public static function find(?string $token): ?OrganizationInvite
    {
        return $token ? OrganizationInvite::with('organization')->where('token', $token)->where('expires_at', '>', now())->first() : null;
    }

    /**
     * Add the user to the invite's organization and land on its first environment.
     */
    public static function join(Request $request, User $user, OrganizationInvite $invite): RedirectResponse
    {
        $organization = $invite->organization;

        if (! $user->belongsToOrganization($organization)) {
            $organization->users()->attach($user->id, ['role' => $invite->role]);
        }

        $invite->delete();
        $user->forceFill(['current_organization_id' => $organization->id])->saveQuietly();
        $request->session()->forget([self::SESSION_KEY, 'url.intended', 'last_environment_id']);

        $environment = Environment::whereHas('application', fn ($q) => $q->where('organization_id', $organization->id))->oldest()->first();

        return ($environment ? to_route('environments.dashboard', $environment) : to_route('applications.create', ['organization' => $organization->id]))
            ->with('success', "Welcome to {$organization->name}.");
    }
}
