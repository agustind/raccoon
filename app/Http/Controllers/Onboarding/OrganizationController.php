<?php

namespace App\Http\Controllers\Onboarding;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Organizations/Create');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);

        $organization = self::createFor($request->user(), $data['name']);

        return to_route('applications.create', ['organization' => $organization->id]);
    }

    public static function createFor(User $user, string $name): Organization
    {
        $organization = Organization::create(['name' => $name]);
        $organization->users()->attach($user->id, ['role' => 'owner']);
        $user->forceFill(['current_organization_id' => $organization->id])->saveQuietly();

        return $organization;
    }
}
