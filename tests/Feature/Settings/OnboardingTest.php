<?php

namespace Tests\Feature\Settings;

use App\Models\Application;
use App\Models\Organization;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

class OnboardingTest extends SettingsTestCase
{
    public function test_users_without_an_organization_are_sent_to_create_one()
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/applications/create')->assertRedirect('/organizations/create');

        $this->actingAs($user)->post('/organizations', ['name' => 'Startup'])
            ->assertRedirect(route('applications.create', ['organization' => Organization::firstWhere('name', 'Startup')->id]));

        $this->assertSame('owner', $user->roleIn(Organization::firstWhere('name', 'Startup')));
    }

    public function test_create_application_with_its_first_environment()
    {
        $user = $this->member('admin');

        $this->actingAs($user)
            ->get("/applications/create?organization={$this->organization->id}")
            ->assertInertia(fn (Assert $page) => $page->component('Applications/Create')->where('created', null));

        $response = $this->actingAs($user)->post('/applications', ['organization_id' => $this->organization->id, 'name' => 'Blog', 'environment' => 'Production']);

        $application = Application::firstWhere('name', 'Blog');
        $environment = $application->environments()->sole();
        $response->assertRedirect(route('applications.create', ['organization' => $this->organization->id, 'application' => $application->id]));

        $this->actingAs($user)
            ->get("/applications/create?organization={$this->organization->id}&application={$application->id}")
            ->assertInertia(fn (Assert $page) => $page
                ->where('created.environment.token', $environment->token)
                ->where('created.environment.last_ingested_at', null));
    }

    public function test_members_cannot_create_applications()
    {
        $user = $this->member('member');

        $this->actingAs($user)->get('/applications/create')->assertRedirect(route('home'));
        $this->actingAs($user)->post('/applications', ['organization_id' => $this->organization->id, 'name' => 'Blog', 'environment' => 'Production'])->assertForbidden();
        $this->actingAs(User::factory()->create())->post('/applications', ['organization_id' => $this->organization->id, 'name' => 'Blog', 'environment' => 'Production'])->assertNotFound();
    }
}
