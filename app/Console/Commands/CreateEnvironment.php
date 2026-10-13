<?php

namespace App\Console\Commands;

use App\Models\Application;
use App\Models\Environment;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Console\Command;

class CreateEnvironment extends Command
{
    protected $signature = 'raccoon:environment
        {application : Application name}
        {environment=Production : Environment name}
        {--organization= : Organization name (defaults to the application name)}
        {--user= : Email of a user to add as organization owner}
        {--token= : Use this exact token instead of generating one}';

    protected $description = 'Create an organization, application and environment, and print its NIGHTWATCH_TOKEN';

    public function handle(): int
    {
        $organization = Organization::firstOrCreate(['name' => $this->option('organization') ?? $this->argument('application')]);
        $application = Application::firstOrCreate(['organization_id' => $organization->id, 'name' => $this->argument('application')]);

        $environment = Environment::firstOrNew(['application_id' => $application->id, 'name' => $this->argument('environment')]);

        if ($this->option('token')) {
            $environment->setToken($this->option('token'));
        }

        $environment->save();

        if ($email = $this->option('user')) {
            $user = User::where('email', $email)->firstOrFail();
            $organization->users()->syncWithoutDetaching([$user->id => ['role' => 'owner']]);
            $user->current_organization_id ??= $organization->id;
            $user->save();
        }

        $this->components->twoColumnDetail('Environment', $environment->id);
        $this->components->twoColumnDetail('NIGHTWATCH_TOKEN', $environment->token);
        $this->components->twoColumnDetail('NIGHTWATCH_BASE_URL', config('app.url'));

        return self::SUCCESS;
    }
}
