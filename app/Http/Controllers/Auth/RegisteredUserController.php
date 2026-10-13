<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Onboarding\InviteController;
use App\Http\Controllers\Onboarding\OrganizationController;
use App\Models\OrganizationInvite;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Sign-up is open for the very first user (who gets a new organization),
 * for anyone holding a valid invite, or for everyone when
 * RACCOON_ALLOW_REGISTRATION=true.
 */
class RegisteredUserController extends Controller
{
    public function create(Request $request): Response|RedirectResponse
    {
        $invite = $this->invite($request);

        if (! self::open() && ! $invite) {
            return to_route('login')->with('status', 'Sign-up is invite only. Ask an organization admin to invite you.');
        }

        return Inertia::render('Auth/SignUp/Create', [
            'first_user' => User::doesntExist(),
            'organization_invite' => $invite ? ['email' => $invite->email, 'organization_name' => $invite->organization->name, 'token' => $invite->token] : null,
        ]);
    }

    /**
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $invite = $this->invite($request);
        $firstUser = User::doesntExist();

        abort_unless(self::open() || $invite, 403);

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class, ...(! self::open() && $invite ? ['in:'.strtolower($invite->email)] : [])],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'organization' => [$firstUser ? 'required' : 'nullable', 'string', 'max:255'],
        ], ['email.in' => 'Use the email address the invite was sent to.']);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        event(new Registered($user));

        Auth::login($user);

        if ($invite && strcasecmp($invite->email, $user->email) === 0) {
            return InviteController::join($request, $user, $invite);
        }

        if ($firstUser) {
            OrganizationController::createFor($user, $request->string('organization')->toString());
        }

        return to_route('home');
    }

    public static function open(): bool
    {
        return config('auth.allow_registration') || User::doesntExist();
    }

    private function invite(Request $request): ?OrganizationInvite
    {
        return InviteController::find($request->input('invite') ?? $request->session()->get(InviteController::SESSION_KEY));
    }
}
