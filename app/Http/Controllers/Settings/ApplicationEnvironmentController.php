<?php

namespace App\Http\Controllers\Settings;

use App\Models\Application;
use App\Models\Environment;
use App\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ApplicationEnvironmentController extends SettingsController
{
    public const COLORS = ['blue', 'green', 'red', 'yellow', 'purple', 'orange', 'gray', 'pink'];

    public function index(Request $request, Organization $organization, Application $application): Response
    {
        $this->authorizeOrganization($request, $organization, 'environment.show');

        return Inertia::render('Settings/Applications/Environments', [
            ...$this->applicationProps($organization, $application),
            'environments' => $application->environments()->orderBy('created_at')->get()->map(fn (Environment $environment) => [
                'id' => $environment->id,
                'name' => $environment->name,
                'token' => $environment->token,
                'color' => $environment->color,
                'url' => $environment->url,
                'last_ingested_at' => $environment->last_ingested_at?->toIso8601ZuluString(),
            ]),
            'colors' => self::COLORS,
            'base_url' => rtrim(config('app.url'), '/'),
            'created_environment_id' => $request->session()->get('created_environment_id'),
        ]);
    }

    public function store(Request $request, Organization $organization, Application $application): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'environment.create');

        $environment = $application->environments()->create($this->validated($request, $application));

        return back()
            ->with('success', "Created the {$environment->name} environment.")
            ->with('created_environment_id', $environment->id);
    }

    public function update(Request $request, Organization $organization, Application $application, Environment $environment): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'environment.edit');

        $environment->update($this->validated($request, $application, $environment));

        return back();
    }

    public function refreshToken(Request $request, Organization $organization, Application $application, Environment $environment): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'environment.edit');

        $environment->setToken(Environment::generateToken());
        $environment->save();

        return back()->with('success', "Regenerated the {$environment->name} token. Update NIGHTWATCH_TOKEN and restart the agent.");
    }

    public function destroy(Request $request, Organization $organization, Application $application, Environment $environment): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'environment.delete');

        if ($request->session()->get('last_environment_id') === $environment->id) {
            $request->session()->forget('last_environment_id');
        }

        $environment->delete();

        return back()->with('success', "Deleted the {$environment->name} environment.");
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, Application $application, ?Environment $environment = null): array
    {
        return $request->validate([
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('environments', 'name')->where('application_id', $application->id)->ignore($environment?->id),
            ],
            'color' => ['required', Rule::in(self::COLORS)],
            'url' => ['nullable', 'url:http,https', 'max:255'],
        ]);
    }
}
