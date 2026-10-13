<?php

namespace Tests\Feature\Settings;

use App\Models\Organization;
use App\Models\OrganizationInvite;
use App\Notifications\OrganizationInvitation;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

class OrganizationSettingsTest extends SettingsTestCase
{
    public function test_page_lists_members_and_invites()
    {
        $owner = $this->member('owner');
        $this->member('member', ['name' => 'Zed']);
        $this->organization->invites()->create(['email' => 'new@example.com', 'role' => 'admin', 'token' => str_repeat('a', 64), 'expires_at' => now()->addDay()]);

        $this->actingAs($owner)
            ->get($this->orgUrl())
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings/Organizations/Edit')
                ->has('users', 2)
                ->where('invites.0.email', 'new@example.com')
                ->where('invites.0.url', fn ($url) => str_contains($url, 'signature=')));
    }

    public function test_rename_and_member_restriction()
    {
        $this->actingAs($this->member('admin'))->patch($this->orgUrl(), ['name' => 'Acme Corp'])->assertSessionHasNoErrors();
        $this->assertSame('Acme Corp', $this->organization->fresh()->name);

        $this->actingAs($this->member('member'))->patch($this->orgUrl(), ['name' => 'Nope'])->assertForbidden();
    }

    public function test_invite_sends_a_signed_link()
    {
        Notification::fake();

        $this->actingAs($this->member('admin'))
            ->post($this->orgUrl('invites'), ['email' => 'friend@example.com', 'role' => 'member'])
            ->assertSessionHasNoErrors();

        $invite = OrganizationInvite::sole();
        $this->assertSame('member', $invite->role);
        $this->assertTrue($invite->expires_at->isFuture());

        Notification::assertSentTo(new AnonymousNotifiable, OrganizationInvitation::class, function (OrganizationInvitation $notification, array $channels, AnonymousNotifiable $notifiable) use ($invite) {
            return $notifiable->routes['mail'] === 'friend@example.com'
                && str_contains($notification->url, "/invites/{$invite->token}")
                && str_contains($notification->url, 'signature=');
        });
    }

    public function test_admins_cannot_invite_owners_or_existing_members()
    {
        Notification::fake();
        $admin = $this->member('admin');
        $this->member('member', ['email' => 'taken@example.com']);

        $this->actingAs($admin)->post($this->orgUrl('invites'), ['email' => 'boss@example.com', 'role' => 'owner'])->assertSessionHasErrors('role');
        $this->actingAs($admin)->post($this->orgUrl('invites'), ['email' => 'taken@example.com', 'role' => 'member'])->assertSessionHasErrors('email');
        $this->actingAs($this->member('member'))->post($this->orgUrl('invites'), ['email' => 'x@example.com', 'role' => 'member'])->assertForbidden();
    }

    public function test_resend_and_revoke_invites()
    {
        Notification::fake();
        $admin = $this->member('admin');
        $invite = $this->organization->invites()->create(['email' => 'new@example.com', 'role' => 'member', 'token' => str_repeat('b', 64), 'expires_at' => now()->addHour()]);

        $this->actingAs($admin)->post($this->orgUrl("invites/{$invite->id}/resend"))->assertSessionHas('success');
        $this->assertTrue($invite->fresh()->expires_at->gt(now()->addDays(6)));
        Notification::assertSentTimes(OrganizationInvitation::class, 1);

        $this->actingAs($admin)->delete($this->orgUrl("invites/{$invite->id}"))->assertRedirect();
        $this->assertSame(0, OrganizationInvite::count());
    }

    public function test_role_changes_respect_owner_rules()
    {
        $owner = $this->member('owner');
        $admin = $this->member('admin');
        $member = $this->member('member');

        $this->actingAs($admin)->patch($this->orgUrl("users/{$member->id}"), ['role' => 'admin'])->assertSessionHasNoErrors();
        $this->assertSame('admin', $member->roleIn($this->organization));

        $this->actingAs($admin)->patch($this->orgUrl("users/{$member->id}"), ['role' => 'owner'])->assertForbidden();
        $this->actingAs($admin)->patch($this->orgUrl("users/{$owner->id}"), ['role' => 'member'])->assertForbidden();

        // The only owner can't step down until someone else is an owner.
        $this->actingAs($owner)->patch($this->orgUrl("users/{$owner->id}"), ['role' => 'admin'])->assertSessionHasErrors('role');
        $this->actingAs($owner)->patch($this->orgUrl("users/{$admin->id}"), ['role' => 'owner'])->assertSessionHasNoErrors();
        $this->actingAs($owner)->patch($this->orgUrl("users/{$owner->id}"), ['role' => 'admin'])->assertSessionHasNoErrors();
        $this->assertSame('admin', $owner->roleIn($this->organization));
    }

    public function test_remove_member_and_leave()
    {
        $owner = $this->member('owner');
        $member = $this->member('member');
        $leaver = $this->member('admin');

        $this->actingAs($member)->delete($this->orgUrl("users/{$leaver->id}"))->assertForbidden();

        $this->actingAs($owner)->delete($this->orgUrl("users/{$member->id}"))->assertRedirect();
        $this->assertFalse($member->belongsToOrganization($this->organization));

        $this->actingAs($leaver)->delete($this->orgUrl("users/{$leaver->id}"))->assertRedirect(route('home'));
        $this->assertFalse($leaver->belongsToOrganization($this->organization));

        $this->actingAs($owner)->delete($this->orgUrl("users/{$owner->id}"))->assertSessionHasErrors('role');
        $this->assertTrue($owner->belongsToOrganization($this->organization));
    }

    public function test_only_owners_delete_the_organization()
    {
        $this->actingAs($this->member('admin'))->delete($this->orgUrl(), ['name' => 'Acme'])->assertForbidden();

        $this->actingAs($this->member('owner'))->delete($this->orgUrl(), ['name' => 'Acme'])->assertRedirect(route('home'));
        $this->assertNull(Organization::find($this->organization->id));
    }
}
