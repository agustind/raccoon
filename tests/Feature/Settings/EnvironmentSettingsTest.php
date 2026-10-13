<?php

namespace Tests\Feature\Settings;

use App\Models\Environment;
use Inertia\Testing\AssertableInertia as Assert;

class EnvironmentSettingsTest extends SettingsTestCase
{
    public function test_page_lists_environments_with_tokens()
    {
        $this->actingAs($this->member())
            ->get($this->appUrl('environments'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings/Applications/Environments')
                ->has('environments', 1)
                ->where('environments.0.token', $this->environment->token)
                ->where('base_url', rtrim(config('app.url'), '/')));
    }

    public function test_create_environment()
    {
        $this->actingAs($this->member('admin'))
            ->post($this->appUrl('environments'), ['name' => 'Staging', 'color' => 'green', 'url' => 'https://staging.example.com'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('created_environment_id');

        $staging = $this->application->environments()->firstWhere('name', 'Staging');
        $this->assertSame('green', $staging->color);
        $this->assertSame('https://staging.example.com', $staging->url);
        $this->assertSame(64, strlen($staging->token));
    }

    public function test_names_are_unique_per_application_and_colors_validated()
    {
        $this->actingAs($this->member())
            ->post($this->appUrl('environments'), ['name' => 'Production', 'color' => 'magenta'])
            ->assertSessionHasErrors(['name', 'color']);
    }

    public function test_update_environment()
    {
        $this->actingAs($this->member())
            ->patch($this->appUrl("environments/{$this->environment->id}"), ['name' => 'Live', 'color' => 'red', 'url' => ''])
            ->assertSessionHasNoErrors();

        $this->assertSame(['Live', 'red', null], [$this->environment->fresh()->name, $this->environment->fresh()->color, $this->environment->fresh()->url]);
    }

    public function test_regenerate_token_invalidates_the_old_one()
    {
        $old = $this->environment->token;

        $this->actingAs($this->member())->post($this->appUrl("environments/{$this->environment->id}/refresh-token"))->assertRedirect();

        $this->assertNull(Environment::findByToken($old));
        $this->assertTrue(Environment::findByToken($this->environment->fresh()->token)->is($this->environment));
    }

    public function test_members_cannot_manage_environments()
    {
        $user = $this->member('member');

        $this->actingAs($user)->post($this->appUrl('environments'), ['name' => 'Staging', 'color' => 'blue'])->assertForbidden();
        $this->actingAs($user)->post($this->appUrl("environments/{$this->environment->id}/refresh-token"))->assertForbidden();
        $this->actingAs($user)->delete($this->appUrl("environments/{$this->environment->id}"))->assertForbidden();
    }

    public function test_delete_environment()
    {
        $this->actingAs($this->member())->delete($this->appUrl("environments/{$this->environment->id}"))->assertRedirect();

        $this->assertNull(Environment::find($this->environment->id));
    }
}
