<?php

namespace Tests\Feature\Settings;

use App\ClickHouse\ClickHouse;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;

class PersonalSettingsTest extends SettingsTestCase
{
    public function test_profile_page_and_name_update()
    {
        $user = $this->member();

        $this->actingAs($user)->get('/settings/profile')->assertInertia(fn (Assert $page) => $page->component('Settings/Profile/Edit'));
        $this->actingAs($user)->patch('/settings/profile', ['name' => 'New Name'])->assertSessionHasNoErrors();

        $this->assertSame('New Name', $user->fresh()->name);
    }

    public function test_email_update_requires_the_password()
    {
        $user = $this->member();

        $this->actingAs($user)->put('/settings/profile/email', ['email' => 'new@example.com', 'password' => 'wrong'])->assertSessionHasErrors('password');
        $this->actingAs($user)->put('/settings/profile/email', ['email' => 'new@example.com', 'password' => 'password'])->assertSessionHasNoErrors();

        $this->assertSame('new@example.com', $user->fresh()->email);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_password_update()
    {
        $user = $this->member();

        $this->actingAs($user)->put('/settings/password', ['current_password' => 'wrong', 'password' => 'new-password', 'password_confirmation' => 'new-password'])->assertSessionHasErrors('current_password');
        $this->actingAs($user)->put('/settings/password', ['current_password' => 'password', 'password' => 'new-password', 'password_confirmation' => 'new-password'])->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('new-password', $user->fresh()->password));
    }

    public function test_delete_account_unless_sole_owner_with_members()
    {
        $owner = $this->member('owner');
        $this->member('member');

        $this->actingAs($owner)->delete('/settings/profile', ['password' => 'password'])->assertSessionHasErrors('password');
        $this->assertNotNull($owner->fresh());

        $member = $this->member('member');
        $this->actingAs($member)->delete('/settings/profile', ['password' => 'password'])->assertRedirect('/');
        $this->assertGuest();
        $this->assertNull(User::find($member->id));
    }

    public function test_notification_preferences()
    {
        $user = $this->member('member');

        $this->actingAs($user)->get('/settings/notifications')->assertInertia(fn (Assert $page) => $page->component('Settings/Notifications/Edit')->has('notificationEvents', 4));

        $this->actingAs($user)->put("/settings/notifications/environments/{$this->environment->id}", ['issue_created' => false])->assertSessionHasNoErrors();

        $preference = NotificationPreference::sole();
        $this->assertFalse($preference->issue_created);
        $this->assertTrue($preference->threshold_exceeded);

        $this->actingAs($user)->get('/settings/notifications')
            ->assertInertia(fn (Assert $page) => $page->where("environmentNotificationPreferences.{$this->environment->id}.issue_created", false));

        $this->actingAs(User::factory()->create())->put("/settings/notifications/environments/{$this->environment->id}", ['issue_created' => false])->assertNotFound();
    }

    public function test_usage_page()
    {
        $this->mock(ClickHouse::class, function (MockInterface $mock) {
            $hour = now()->utc()->startOfHour()->format('Y-m-d H:i:s');
            $mock->shouldReceive('select')->andReturnUsing(fn (string $sql) => str_contains($sql, 'AS hour')
                ? [['environment_id' => $this->environment->id, 'hour' => $hour, 'events' => '42']]
                : [['environment_id' => $this->environment->id, 'type' => 'request', 'events' => '40'], ['environment_id' => $this->environment->id, 'type' => 'query', 'events' => '2']]);
        });

        $daysInMonth = now()->utc()->daysInMonth;

        $this->actingAs($this->member('member'))
            ->get($this->orgUrl('usage'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings/Organizations/Usage')
                ->has('periods', 12)
                ->loadDeferredProps(fn (Assert $reload) => $reload
                    ->where('captured_total', 42)
                    ->has('graph', 24 * $daysInMonth)
                    ->where('applications.0.environments.0.captured_total', 42)
                    ->where('applications.0.environments.0.events', fn ($events) => collect($events)->contains(['label' => 'Requests', 'captured' => 40, 'rate_limited' => 0]))));
    }
}
