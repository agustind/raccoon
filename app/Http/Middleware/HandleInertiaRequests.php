<?php

namespace App\Http\Middleware;

use App\Models\Environment;
use App\Models\Issue;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * One `auth` prop carries the user, their organizations and the current
     * organization, application and environment for every page.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => fn () => $this->auth($request),
            'flash' => fn () => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function auth(Request $request): array
    {
        $user = $request->user();

        if (! $user) {
            return ['user' => null, 'permissions' => [], 'app' => null, 'env' => null, 'org' => null];
        }

        $organizations = $user->organizations()
            ->with(['applications' => fn ($q) => $q->orderBy('name'), 'applications.environments' => fn ($q) => $q->orderBy('created_at')])
            ->orderBy('name')
            ->get();

        /** @var Environment|null $environment */
        $environment = app()->bound('current.environment') ? app('current.environment') : null;
        $application = $environment?->application;
        $organization = $application?->organization
            ?? $organizations->firstWhere('id', $user->current_organization_id)
            ?? $organizations->first();

        $role = $organization ? $organizations->firstWhere('id', $organization->id)?->pivot->role : null;

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $user->avatar_url,
                'organizations' => $organizations->map(fn ($org) => [
                    'id' => $org->id,
                    'name' => $org->name,
                    'avatar_url' => $org->avatar_url,
                    'role' => $org->pivot->role,
                    'applications' => $org->applications->map(fn ($app) => [
                        'id' => $app->id,
                        'name' => $app->name,
                        'avatar_url' => $app->avatar_url,
                        'environments' => $app->environments->map(fn ($env) => [
                            'id' => $env->id,
                            'name' => $env->name,
                            'application_id' => $env->application_id,
                            'color' => $env->color,
                        ])->values(),
                    ])->values(),
                ])->values(),
            ],
            'permissions' => Permissions::forRole($role),
            'org' => $organization ? [
                'id' => $organization->id,
                'name' => $organization->name,
                'avatar_url' => $organization->avatar_url,
                'lookback_period' => $organization->lookback_period,
            ] : null,
            'app' => $application ? [
                'id' => $application->id,
                'name' => $application->name,
                'avatar_url' => $application->avatar_url,
            ] : null,
            'env' => $environment ? [
                'id' => $environment->id,
                'application_id' => $environment->application_id,
                'name' => $environment->name,
                'color' => $environment->color,
                'issues' => [
                    'open' => Issue::where('application_id', $application->id)
                        ->where('status', 'open')
                        ->whereHas('environments', fn ($q) => $q->whereKey($environment->id))
                        ->count(),
                ],
            ] : null,
        ];
    }
}
