<?php

namespace App\Http\Controllers\Onboarding;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Organization;
use App\Support\Permissions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Two steps on one page: name the application, then copy the agent setup
 * for its first environment and wait for data to arrive.
 */
class ApplicationController extends Controller
{
    public function create(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $organizations = $user->organizations()->orderBy('name')->get()
            ->filter(fn (Organization $organization) => Permissions::allows($organization->pivot->role, 'application.create'))
            ->values();

        if ($organizations->isEmpty()) {
            return $user->organizations()->exists()
                ? to_route('home')->with('error', 'You need to be an admin to create applications.')
                : to_route('organizations.create');
        }

        $organization = $organizations->firstWhere('id', $request->query('organization'))
            ?? $organizations->firstWhere('id', $user->current_organization_id)
            ?? $organizations->first();

        $application = $request->query('application')
            ? $organization->applications()->with(['environments' => fn ($q) => $q->orderBy('created_at')])->find($request->query('application'))
            : null;
        $environment = $application?->environments->first();

        return Inertia::render('Applications/Create', [
            'organization' => ['id' => $organization->id, 'name' => $organization->name],
            'organizations' => $organizations->map(fn (Organization $organization) => ['id' => $organization->id, 'name' => $organization->name]),
            'created' => $environment ? [
                'application' => ['id' => $application->id, 'name' => $application->name],
                'environment' => [
                    'id' => $environment->id,
                    'name' => $environment->name,
                    'token' => $environment->token,
                    'last_ingested_at' => $environment->last_ingested_at?->toIso8601ZuluString(),
                ],
            ] : null,
            'base_url' => rtrim(config('app.url'), '/'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'organization_id' => ['required', 'uuid'],
            'name' => ['required', 'string', 'max:255'],
            'environment' => ['required', 'string', 'max:100'],
        ]);

        $organization = $request->user()->organizations()->findOrFail($data['organization_id']);
        abort_unless(Permissions::allows($organization->pivot->role, 'application.create'), 403);

        $application = DB::transaction(function () use ($organization, $data) {
            $application = Application::create(['organization_id' => $organization->id, 'name' => $data['name']]);
            $application->environments()->create(['name' => $data['environment'], 'color' => 'blue']);

            return $application;
        });

        $request->user()->forceFill(['current_organization_id' => $organization->id])->saveQuietly();

        return to_route('applications.create', ['organization' => $organization->id, 'application' => $application->id]);
    }
}
