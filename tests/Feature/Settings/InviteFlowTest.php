<?php

namespace Tests\Feature\Settings;

use App\Http\Controllers\Settings\OrganizationController;
use App\Models\OrganizationInvite;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

class InviteFlowTest extends SettingsTestCase
{
    private OrganizationInvite $invite;

    protected function setUp(): void
    {
        parent::setUp();

        $this->member('owner');
        $this->invite = $this->organization->invites()->create([
            'email' => 'friend@example.com', 'role' => 'admin', 'token' => str_repeat('c', 64), 'expires_at' => now()->addDays(7),
        ]);
    }

    private function link(): string
    {
        return OrganizationController::inviteUrl($this->invite);
    }

    public function test_guests_see_the_invite_and_can_sign_up_to_join()
    {
        $this->get($this->link())
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Invites/Show')
                ->where('organization.name', 'Acme')
                ->where('can_accept_invite', false));

        // Sign-up is otherwise closed, but the invite in the session opens it.
        $this->get('/register')->assertInertia(fn (Assert $page) => $page->component('Auth/SignUp/Create')->where('organization_invite.email', 'friend@example.com'));

        $this->post('/register', [
            'name' => 'Friend',
            'email' => 'friend@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertRedirect(route('environments.dashboard', $this->environment));

        $user = User::firstWhere('email', 'friend@example.com');
        $this->assertSame('admin', $user->roleIn($this->organization));
        $this->assertSame(0, OrganizationInvite::count());
    }

    public function test_sign_up_with_an_invite_requires_the_invited_email()
    {
        $this->get($this->link());

        $this->post('/register', [
            'name' => 'Someone',
            'email' => 'someone@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertSessionHasErrors('email');
    }

    public function test_existing_users_sign_in_then_accept()
    {
        $user = User::factory()->create(['email' => 'friend@example.com']);

        $this->get($this->link());
        $this->get('/login')->assertInertia(fn (Assert $page) => $page->component('Auth/SignIn')->where('organization_invite.organization_name', 'Acme'));
        $this->post('/login', ['email' => 'friend@example.com', 'password' => 'password'])->assertRedirect($this->link());

        $this->get($this->link())->assertInertia(fn (Assert $page) => $page->component('Invites/Show')->where('can_accept_invite', true));
        $this->post("/invites/{$this->invite->token}/accept")->assertRedirect(route('environments.dashboard', $this->environment));

        $this->assertSame('admin', $user->roleIn($this->organization));
    }

    public function test_email_mismatch()
    {
        $this->actingAs(User::factory()->create(['email' => 'other@example.com']))
            ->get($this->link())
            ->assertInertia(fn (Assert $page) => $page->component('Invites/EmailMismatch'));

        $this->post("/invites/{$this->invite->token}/accept")->assertSessionHas('error');
        $this->assertSame(1, OrganizationInvite::count());
    }

    public function test_tampered_or_expired_links_are_invalid()
    {
        $this->get(str_replace('signature=', 'signature=0', $this->link()))->assertInertia(fn (Assert $page) => $page->component('Invites/Invalid'));
        $this->get("/invites/{$this->invite->token}")->assertInertia(fn (Assert $page) => $page->component('Invites/Invalid'));

        $link = $this->link();
        $this->invite->update(['expires_at' => now()->subMinute()]);
        $this->get($link)->assertInertia(fn (Assert $page) => $page->component('Invites/Invalid'));
    }
}
