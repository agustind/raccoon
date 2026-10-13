<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('Settings/Profile/Edit', [
            'status' => $request->session()->get('status'),
            'mcpUrl' => url('/mcp'),
            'newToken' => $request->session()->get('api_token'),
            'tokens' => $request->user()->tokens()->latest()->get()->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'write' => in_array('write', $token->abilities, true),
                'last_used_at' => $token->last_used_at?->toIso8601String(),
                'created_at' => $token->created_at->toIso8601String(),
            ]),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $request->user()->update($request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]));

        return back()->with('success', 'Profile updated.');
    }

    public function updateEmail(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class)->ignore($request->user()->id)],
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();
        $user->email = $data['email'];

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return back()->with('success', 'Email address updated.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        // Don't leave an organization with members but no owner.
        $stranded = $user->organizations()->wherePivot('role', 'owner')->get()->first(fn ($organization) => ! $organization->users()->wherePivot('role', 'owner')->whereKeyNot($user->id)->exists()
            && $organization->users()->whereKeyNot($user->id)->exists());

        if ($stranded) {
            throw ValidationException::withMessages(['password' => "Make someone else an owner of {$stranded->name} first."]);
        }

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
