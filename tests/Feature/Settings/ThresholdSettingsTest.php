<?php

namespace Tests\Feature\Settings;

use App\ClickHouse\ClickHouse;
use App\Models\Threshold;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;

class ThresholdSettingsTest extends SettingsTestCase
{
    private const GROUP = 'abc123';

    protected function setUp(): void
    {
        parent::setUp();

        $this->mock(ClickHouse::class, function (MockInterface $mock) {
            $mock->shouldReceive('value')->andReturn('1');
            $mock->shouldReceive('select')->andReturn([['group' => self::GROUP, 'methods' => ['GET', 'HEAD'], 'domain' => '', 'path' => '/users/{user}', 'label' => 'GET|HEAD /users/{user}']]);
            $mock->shouldReceive('first')->andReturnUsing(fn (string $sql, array $bindings) => $bindings['group'] === self::GROUP
                ? ['methods' => ['GET', 'HEAD'], 'domain' => '', 'path' => '/users/{user}', 'name' => 'App\\Jobs\\Sync']
                : null);
        });
    }

    public function test_page_lists_thresholds_and_candidates()
    {
        $this->application->thresholds()->create(['type' => 'job', 'group' => 'j1', 'name' => 'App\\Jobs\\Sync', 'threshold_ms' => 500]);

        $this->actingAs($this->member('member'))
            ->get($this->appUrl('thresholds'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Settings/Applications/Thresholds')
                ->where('thresholds.job.0.duration', 500)
                ->has('thresholds.route', 0)
                ->where('routes.data.0.group', self::GROUP)
                ->where('routes.total', 1));
    }

    public function test_create_route_threshold()
    {
        $this->actingAs($this->member('admin'))
            ->post($this->appUrl('thresholds'), ['type' => 'route', 'group' => self::GROUP, 'duration' => 750])
            ->assertSessionHasNoErrors();

        $threshold = Threshold::sole();
        $this->assertSame(['route', self::GROUP, 'GET /users/{user}', 750], [$threshold->type, $threshold->group, $threshold->name, $threshold->threshold_ms]);
    }

    public function test_duplicates_are_rejected()
    {
        $this->application->thresholds()->create(['type' => 'route', 'group' => self::GROUP, 'name' => 'GET /users/{user}', 'threshold_ms' => 500]);

        $this->actingAs($this->member())
            ->post($this->appUrl('thresholds'), ['type' => 'route', 'group' => self::GROUP, 'duration' => 750])
            ->assertSessionHasErrors('group');
    }

    public function test_unknown_groups_are_rejected()
    {
        $this->actingAs($this->member())
            ->post($this->appUrl('thresholds'), ['type' => 'job', 'group' => 'nope', 'duration' => 750])
            ->assertStatus(422);
    }

    public function test_update_and_delete()
    {
        $threshold = $this->application->thresholds()->create(['type' => 'command', 'group' => 'c1', 'name' => 'app:sync', 'threshold_ms' => 500]);
        $user = $this->member('admin');

        $this->actingAs($user)->patch($this->appUrl("thresholds/{$threshold->id}"), ['duration' => 2000])->assertSessionHasNoErrors();
        $this->assertSame(2000, $threshold->fresh()->threshold_ms);

        $this->actingAs($user)->delete($this->appUrl("thresholds/{$threshold->id}"))->assertRedirect();
        $this->assertSame(0, Threshold::count());
    }

    public function test_members_cannot_create()
    {
        $this->actingAs($this->member('member'))
            ->post($this->appUrl('thresholds'), ['type' => 'route', 'group' => self::GROUP, 'duration' => 750])
            ->assertForbidden();
    }
}
