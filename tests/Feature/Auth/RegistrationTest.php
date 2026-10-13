<?php

namespace Tests\Feature\Auth;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_can_be_rendered_for_the_first_user()
    {
        $this->get('/register')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Auth/SignUp/Create')->where('first_user', true));
    }

    public function test_first_user_registers_and_owns_a_new_organization()
    {
        $response = $this->post('/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'organization' => 'Acme',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('home', absolute: false));

        $user = User::firstWhere('email', 'test@example.com');
        $organization = Organization::firstWhere('name', 'Acme');
        $this->assertSame('owner', $user->roleIn($organization));
        $this->assertSame($organization->id, $user->current_organization_id);
    }

    public function test_registration_is_closed_once_a_user_exists()
    {
        User::factory()->create();

        $this->get('/register')->assertRedirect('/login');

        $this->post('/register', [
            'name' => 'Intruder',
            'email' => 'intruder@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertForbidden();

        $this->assertGuest();
    }

    public function test_registration_can_be_opened_with_config()
    {
        User::factory()->create();
        config(['auth.allow_registration' => true]);

        $this->post('/register', [
            'name' => 'New User',
            'email' => 'new@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertRedirect(route('home', absolute: false));

        $this->assertAuthenticated();
        $this->assertSame(0, User::firstWhere('email', 'new@example.com')->organizations()->count());
    }
}
