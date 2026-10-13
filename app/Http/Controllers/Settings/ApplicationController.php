<?php

namespace App\Http\Controllers\Settings;

use App\Models\Application;
use App\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ApplicationController extends SettingsController
{
    public function general(Request $request, Organization $organization, Application $application): Response
    {
        $this->authorizeOrganization($request, $organization, 'application.show');

        return Inertia::render('Settings/Applications/General', [
            ...$this->applicationProps($organization, $application),
            'environments' => $application->environments()->orderBy('created_at')->get(['id', 'name', 'color']),
        ]);
    }

    public function update(Request $request, Organization $organization, Application $application): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'application.edit');

        $application->update($request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]));

        return back()->with('success', 'Application updated.');
    }

    public function destroy(Request $request, Organization $organization, Application $application): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'application.delete');

        $request->validate(['name' => ['required', 'in:'.$application->name]], ['name.in' => 'The name does not match the application name.']);

        $environmentIds = $application->environments()->pluck('id');

        if ($environmentIds->contains($request->session()->get('last_environment_id'))) {
            $request->session()->forget('last_environment_id');
        }

        $application->delete();

        return to_route('home')->with('success', "Deleted {$application->name}.");
    }
}
