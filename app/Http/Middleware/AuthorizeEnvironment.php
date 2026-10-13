<?php

namespace App\Http\Middleware;

use App\Models\Environment;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Only members of the environment's organization can see its data. Also
 * remembers the environment so the sidebar and shared props can use it.
 */
class AuthorizeEnvironment
{
    public function handle(Request $request, Closure $next): Response
    {
        $environment = $request->route('environment');

        if (! $environment instanceof Environment) {
            abort(404);
        }

        $environment->loadMissing('application.organization');
        $organization = $environment->application->organization;
        $user = $request->user();

        abort_unless($user && $user->belongsToOrganization($organization), 403);

        if ($user->current_organization_id !== $organization->id) {
            $user->forceFill(['current_organization_id' => $organization->id])->saveQuietly();
        }

        $request->session()->put('last_environment_id', $environment->id);
        app()->instance('current.environment', $environment);

        return $next($request);
    }
}
