<?php

namespace Tests\Feature\Settings;

use App\Models\Webhook;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

class IssueSettingsTest extends SettingsTestCase
{
    public function test_auto_resolve_can_be_set_and_cleared()
    {
        $user = $this->member('admin');

        $this->actingAs($user)->patch($this->appUrl('issues'), ['issue_auto_resolve_in_days' => 14])->assertSessionHasNoErrors();
        $this->assertSame(14, $this->application->fresh()->issue_auto_resolve_in_days);

        $this->actingAs($user)->patch($this->appUrl('issues'), ['issue_auto_resolve_in_days' => 9])->assertSessionHasErrors('issue_auto_resolve_in_days');

        $this->actingAs($user)->patch($this->appUrl('issues'), ['issue_auto_resolve_in_days' => null])->assertSessionHasNoErrors();
        $this->assertNull($this->application->fresh()->issue_auto_resolve_in_days);
    }

    public function test_creating_a_webhook_reveals_the_secret_once()
    {
        $user = $this->member('admin');

        $this->actingAs($user)
            ->post($this->appUrl('webhooks'), ['name' => 'Ops', 'url' => 'https://hooks.example.com/nw', 'events' => ['issue.created', 'threshold.exceeded'], 'enabled' => true])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('webhook_secret');

        $webhook = Webhook::sole();
        $this->assertSame(['issue.created', 'threshold.exceeded'], $webhook->events);

        $this->actingAs($user)
            ->withSession(['webhook_secret' => $webhook->secret])
            ->get($this->appUrl('issues'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings/Applications/Issues')
                ->where('webhook_secret', $webhook->secret)
                ->where('application.webhooks.0.name', 'Ops')
                ->missing('application.webhooks.0.secret'));

        $this->actingAs($user)->get($this->appUrl('issues'))->assertInertia(fn (Assert $page) => $page->where('webhook_secret', null));
    }

    public function test_webhook_events_are_validated()
    {
        $this->actingAs($this->member())
            ->post($this->appUrl('webhooks'), ['name' => 'Ops', 'url' => 'not a url', 'events' => ['issue.exploded']])
            ->assertSessionHasErrors(['url', 'events.0']);
    }

    public function test_toggle_rotate_and_delete()
    {
        $user = $this->member('admin');
        $webhook = $this->application->webhooks()->create(['name' => 'Ops', 'url' => 'https://hooks.example.com', 'events' => ['issue.created'], 'secret' => 'old']);

        $this->actingAs($user)->patch($this->appUrl("webhooks/{$webhook->id}"), ['enabled' => false])->assertSessionHasNoErrors();
        $this->assertFalse($webhook->fresh()->enabled);

        $this->actingAs($user)->post($this->appUrl("webhooks/{$webhook->id}/rotate-secret"))->assertSessionHas('webhook_secret');
        $this->assertNotSame('old', $webhook->fresh()->secret);

        $this->actingAs($user)->delete($this->appUrl("webhooks/{$webhook->id}"))->assertRedirect($this->appUrl('issues'));
        $this->assertSame(0, Webhook::count());
    }

    public function test_send_test_records_a_signed_delivery()
    {
        Http::fake(['hooks.example.com/*' => Http::response('ok', 200)]);
        $webhook = $this->application->webhooks()->create(['name' => 'Ops', 'url' => 'https://hooks.example.com/nw', 'events' => ['issue.created'], 'secret' => 'shh']);

        $this->actingAs($this->member())->post($this->appUrl("webhooks/{$webhook->id}/test"))->assertSessionHas('success');

        Http::assertSent(fn (Request $request) => $request['event'] === 'test'
            && $request->header('X-Raccoon-Signature')[0] === 'sha256='.hash_hmac('sha256', $request->body(), 'shh'));

        $delivery = $webhook->deliveries()->sole();
        $this->assertSame([200, 'test'], [$delivery->status_code, $delivery->event]);

        $this->actingAs($this->member('member'))
            ->get($this->appUrl("webhooks/{$webhook->id}"))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings/Applications/Webhook')
                ->where('events.total', 1)
                ->where('filterStats.success', 1));
    }

    public function test_failed_test_delivery_is_reported()
    {
        Http::fake(['*' => Http::response('nope', 500)]);
        $webhook = $this->application->webhooks()->create(['name' => 'Ops', 'url' => 'https://hooks.example.com/nw', 'events' => ['issue.created'], 'secret' => 'shh']);

        $this->actingAs($this->member())->post($this->appUrl("webhooks/{$webhook->id}/test"))->assertSessionHas('error');
        $this->assertSame(500, $webhook->deliveries()->sole()->status_code);
    }

    public function test_members_cannot_manage_webhooks()
    {
        $this->actingAs($this->member('member'))
            ->post($this->appUrl('webhooks'), ['name' => 'Ops', 'url' => 'https://hooks.example.com', 'events' => ['issue.created']])
            ->assertForbidden();
    }
}
