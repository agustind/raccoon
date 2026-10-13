<?php

namespace Tests\Feature\Settings;

use App\Models\Application;
use App\Models\Environment;
use App\Models\Organization;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

class ApplicationSettingsTest extends SettingsTestCase
{
    public function test_members_see_the_general_tab()
    {
        $this->actingAs($this->member('member'))
            ->get($this->appUrl('general'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings/Applications/General')
                ->where('application.name', 'Shop')
                ->where('auth.org.id', $this->organization->id)
                ->where('auth.permissions', fn ($permissions) => ! collect($permissions)->contains('application.edit')));
    }

    public function test_application_index_redirects_to_general()
    {
        $this->actingAs($this->member())->get($this->appUrl())->assertRedirect($this->appUrl('general'));
    }

    public function test_non_members_get_404()
    {
        $other = Organization::create(['name' => 'Other']);
        $user = User::factory()->create();
        $other->users()->attach($user->id, ['role' => 'owner']);

        $this->actingAs($user)->get($this->appUrl('general'))->assertNotFound();
    }

    public function test_application_from_another_organization_404s()
    {
        $other = Organization::create(['name' => 'Other']);
        $foreign = $other->applications()->create(['name' => 'Foreign']);

        $this->actingAs($this->member())
            ->get("/settings/organizations/{$this->organization->id}/applications/{$foreign->id}/general")
            ->assertNotFound();
    }

    public function test_admins_can_rename()
    {
        $this->actingAs($this->member('admin'))
            ->patch($this->appUrl(), ['name' => 'Storefront'])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this->assertSame('Storefront', $this->application->fresh()->name);
    }

    public function test_members_cannot_rename()
    {
        $this->actingAs($this->member('member'))->patch($this->appUrl(), ['name' => 'Nope'])->assertForbidden();

        $this->assertSame('Shop', $this->application->fresh()->name);
    }

    public function test_delete_requires_the_name()
    {
        $user = $this->member('admin');

        $this->actingAs($user)->delete($this->appUrl(), ['name' => 'wrong'])->assertSessionHasErrors('name');
        $this->assertNotNull($this->application->fresh());

        $this->actingAs($user)->delete($this->appUrl(), ['name' => 'Shop'])->assertRedirect(route('home'));
        $this->assertNull(Application::find($this->application->id));
        $this->assertSame(0, Environment::count());
    }
}
