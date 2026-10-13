<?php

namespace Tests\Feature;

use App\Mcp\Servers\RaccoonServer;
use App\Mcp\Tools\ListEnvironments;
use App\Mcp\Tools\ListIssues;
use App\Mcp\Tools\UpdateIssue;
use App\Models\Application;
use App\Models\Environment;
use App\Models\Issue;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class McpServerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Environment $environment;

    protected function setUp(): void
    {
        parent::setUp();

        $organization = Organization::create(['name' => 'Acme']);
        $application = Application::create(['organization_id' => $organization->id, 'name' => 'Shop']);
        $this->environment = Environment::create(['application_id' => $application->id, 'name' => 'Production']);
        $this->user = User::factory()->create();
        $organization->users()->attach($this->user->id, ['role' => 'member']);

        $issue = Issue::create([
            'application_id' => $application->id, 'ref' => 1, 'type' => 'exception', 'issueable_type' => 'exception', 'group' => 'g1',
            'title' => 'RuntimeException', 'subtitle' => 'Boom', 'first_seen_at' => now(), 'last_seen_at' => now(), 'occurrences' => 3,
        ]);
        $issue->environments()->attach($this->environment->id, ['first_seen_at' => now(), 'last_seen_at' => now(), 'occurrences' => 3]);
    }

    public function test_the_endpoint_requires_a_token()
    {
        $this->postJson('/mcp', ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize'])->assertUnauthorized();
    }

    public function test_a_token_can_initialize_and_list_tools()
    {
        $token = $this->user->createToken('agent', ['read'])->plainTextToken;
        $headers = ['Authorization' => "Bearer {$token}", 'Accept' => 'application/json, text/event-stream'];

        $this->postJson('/mcp', [
            'jsonrpc' => '2.0', 'id' => 1, 'method' => 'initialize',
            'params' => ['protocolVersion' => '2025-06-18', 'capabilities' => [], 'clientInfo' => ['name' => 'test', 'version' => '1']],
        ], $headers)->assertOk()->assertJsonPath('result.serverInfo.name', 'Raccoon');

        $names = collect($this->postJson('/mcp', ['jsonrpc' => '2.0', 'id' => 2, 'method' => 'tools/list'], $headers)->json('result.tools'))->pluck('name');

        $this->assertContains('slow_routes', $names);
        $this->assertContains('get_request', $names);
        $this->assertContains('update_issue', $names);
    }

    public function test_environments_are_limited_to_the_users_organizations()
    {
        $other = Organization::create(['name' => 'Other']);
        $hidden = Environment::create(['application_id' => Application::create(['organization_id' => $other->id, 'name' => 'Secret'])->id, 'name' => 'Production']);

        RaccoonServer::actingAs($this->agentWithToken(['read']))->tool(ListEnvironments::class)
            ->assertOk()
            ->assertSee('Shop/Production')
            ->assertDontSee('Secret');

        RaccoonServer::actingAs($this->agentWithToken(['read']))->tool(ListIssues::class, ['environment' => $hidden->id])
            ->assertHasErrors();
    }

    public function test_issues_can_be_listed_by_name()
    {
        RaccoonServer::actingAs($this->agentWithToken(['read']))->tool(ListIssues::class, ['environment' => 'shop/production'])
            ->assertOk()
            ->assertSee(['#1', 'RuntimeException', 'Boom']);
    }

    public function test_updating_issues_needs_a_write_token()
    {
        RaccoonServer::actingAs($this->agentWithToken(['read']))->tool(UpdateIssue::class, ['ref' => 1, 'status' => 'resolved'])
            ->assertHasErrors();

        $this->assertSame('open', Issue::where('ref', 1)->value('status'));

        RaccoonServer::actingAs($this->agentWithToken(['read', 'write']))->tool(UpdateIssue::class, ['ref' => 1, 'status' => 'resolved', 'comment' => 'Fixed in abc123'])
            ->assertOk()
            ->assertSee('resolved');

        $issue = Issue::where('ref', 1)->sole();
        $this->assertSame('resolved', $issue->status);
        $this->assertSame('Fixed in abc123', $issue->activities()->first()->data['comment']);
    }

    public function test_tokens_are_created_and_revoked_from_settings()
    {
        $this->actingAs($this->user)->post('/settings/api-tokens', ['name' => 'Laptop', 'write' => true])
            ->assertRedirect()
            ->assertSessionHas('api_token');

        $token = $this->user->tokens()->sole();
        $this->assertSame(['read', 'write'], $token->abilities);

        $intruder = User::factory()->create();
        $this->actingAs($intruder)->delete("/settings/api-tokens/{$token->id}");
        $this->assertSame(1, $this->user->tokens()->count());

        $this->actingAs($this->user)->delete("/settings/api-tokens/{$token->id}")->assertRedirect();
        $this->assertSame(0, $this->user->tokens()->count());
    }

    /**
     * @param  list<string>  $abilities
     */
    private function agentWithToken(array $abilities): User
    {
        return $this->user->withAccessToken($this->user->createToken('test', $abilities)->accessToken);
    }
}
