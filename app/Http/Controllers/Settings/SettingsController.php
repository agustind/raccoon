<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Organization;
use App\Support\Permissions;
use Illuminate\Http\Request;

/**
 * Base for organization and application settings pages.
 */
abstract class SettingsController extends Controller
{
    /**
     * Abort unless the user belongs to the organization and their role grants
     * the permission. Also makes it the current organization, so the shared
     * `auth.org` and `auth.permissions` props describe it.
     */
    protected function authorizeOrganization(Request $request, Organization $organization, ?string $permission = null): string
    {
        $user = $request->user();
        $role = $user->roleIn($organization);

        abort_if($role === null, 404);
        abort_if($permission !== null && ! Permissions::allows($role, $permission), 403);

        if ($user->current_organization_id !== $organization->id) {
            $user->forceFill(['current_organization_id' => $organization->id])->saveQuietly();
        }

        return $role;
    }

    /**
     * Props every application settings tab receives.
     *
     * @return array<string, mixed>
     */
    protected function applicationProps(Organization $organization, Application $application): array
    {
        return [
            'organization' => ['id' => $organization->id, 'name' => $organization->name],
            'application' => [
                'id' => $application->id,
                'name' => $application->name,
                'avatar_url' => $application->avatar_url,
            ],
        ];
    }
}
