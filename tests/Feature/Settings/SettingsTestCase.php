<?php

namespace Tests\Feature\Settings;

use App\Models\Application;
use App\Models\Environment;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

abstract class SettingsTestCase extends TestCase
{
    use RefreshDatabase;

    protected Organization $organization;

    protected Application $application;

    protected Environment $environment;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organization = Organization::create(['name' => 'Acme']);
        $this->application = $this->organization->applications()->create(['name' => 'Shop']);
        $this->environment = $this->application->environments()->create(['name' => 'Production']);
    }

    protected function member(string $role = 'owner', array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $this->organization->users()->attach($user->id, ['role' => $role]);

        return $user;
    }

    protected function appUrl(string $path = ''): string
    {
        return "/settings/organizations/{$this->organization->id}/applications/{$this->application->id}".($path === '' ? '' : "/{$path}");
    }

    protected function orgUrl(string $path = ''): string
    {
        return "/settings/organizations/{$this->organization->id}".($path === '' ? '' : "/{$path}");
    }
}
