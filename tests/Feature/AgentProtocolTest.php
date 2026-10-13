<?php

namespace Tests\Feature;

use App\Ingest\IngestToken;
use App\Models\Application;
use App\Models\Deployment;
use App\Models\Environment;
use App\Models\Issue;
use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * The endpoints the stock laravel/nightwatch agent calls. ClickHouse is faked
 * at the HTTP layer so the tests can inspect exactly what gets inserted.
 */
class AgentProtocolTest extends TestCase
{
    use RefreshDatabase;

    private Environment $environment;

    protected function setUp(): void
    {
        parent::setUp();

        config(['clickhouse.url' => 'http://clickhouse.test:8123']);
        Http::fake(['clickhouse.test:8123/*' => Http::response('', 200)]);

        $organization = Organization::create(['name' => 'Acme']);
        $application = Application::create(['organization_id' => $organization->id, 'name' => 'Shop']);
        $this->environment = Environment::create(['application_id' => $application->id, 'name' => 'Production', 'token' => 'agent-token']);
        $this->environment->setToken('agent-token');
        $this->environment->save();
    }

    public function test_agent_auth_exchanges_the_environment_token_for_an_ingest_token()
    {
        $response = $this->withToken('agent-token')->postJson('/api/agent-auth', []);

        $response->assertOk()->assertJsonStructure(['token', 'expires_in', 'refresh_in', 'ingest_url']);
        $this->assertIsInt($response->json('expires_in'));
        $this->assertIsInt($response->json('refresh_in'));
        $this->assertSame(url('/api/ingest'), $response->json('ingest_url'));
        $this->assertSame($this->environment->id, IngestToken::verify($response->json('token')));
    }

    public function test_agent_auth_rejects_unknown_tokens_without_stopping_the_agent()
    {
        $this->withToken('wrong')->postJson('/api/agent-auth', [])
            ->assertUnauthorized()
            ->assertJson(['stop' => false]);
    }

    public function test_ingest_rejects_expired_or_forged_tokens()
    {
        $expired = IngestToken::issue($this->environment->id, now()->subHours(2)->getTimestamp())['token'];

        $this->call('POST', '/api/ingest', server: ['HTTP_AUTHORIZATION' => "Bearer {$expired}"], content: '{"records":[]}')->assertUnauthorized();
        $this->call('POST', '/api/ingest', server: ['HTTP_AUTHORIZATION' => 'Bearer forged.token'], content: '{"records":[]}')->assertUnauthorized();
    }

    public function test_ingest_accepts_a_gzipped_batch_and_routes_records_to_tables()
    {
        $records = [
            $this->record('request', ['_group' => 'g1', 'trace_id' => 't1', 'user' => '42', 'method' => 'GET', 'url' => 'https://shop.test/', 'route_path' => '/', 'duration' => 1500, 'status_code' => 200, 'deploy' => 'v1']),
            $this->record('query', ['_group' => 'g2', 'trace_id' => 't1', 'execution_id' => 't1', 'sql' => 'select 1', 'duration' => 300]),
            $this->record('user', ['id' => 42, 'name' => 'Ada', 'username' => 'ada@example.com']),
            $this->record('unknown-type', []),
        ];

        $this->ingest($records)->assertOk()->assertJson(['records' => 3]);

        $inserts = $this->insertsByTable();
        $this->assertSame('t1', $inserts['requests'][0]['trace_id']);
        $this->assertSame('g1', $inserts['requests'][0]['group']);
        $this->assertSame('42', $inserts['requests'][0]['user']);
        $this->assertArrayNotHasKey('_group', $inserts['requests'][0]);
        $this->assertSame($this->environment->id, $inserts['queries'][0]['environment_id']);
        $this->assertSame('42', $inserts['users'][0]['id']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/', $inserts['requests'][0]['timestamp']);
        $this->assertArrayHasKey('ingest_usage', $inserts);

        $this->assertDatabaseHas('deployments', ['environment_id' => $this->environment->id, 'deploy' => 'v1']);
    }

    public function test_the_agent_stream_buffer_format_is_accepted()
    {
        // The agent joins payloads as {"records":[a,b,...]} without re-encoding.
        $body = '{"records":['.json_encode($this->record('log', ['level' => 'info', 'message' => 'hi'])).']}';

        $this->call('POST', '/api/ingest', server: [
            'HTTP_AUTHORIZATION' => 'Bearer '.$this->ingestToken(),
            'HTTP_CONTENT_ENCODING' => 'gzip',
            'CONTENT_TYPE' => 'application/json',
        ], content: gzencode($body))->assertOk()->assertJson(['records' => 1]);
    }

    public function test_exceptions_create_and_update_issues()
    {
        $exception = ['_group' => 'exc-1', 'class' => 'RuntimeException', 'message' => 'Boom', 'file' => 'app/Foo.php', 'line' => 10, 'handled' => false, 'trace' => '[]'];

        $this->ingest([$this->record('exception', $exception), $this->record('exception', $exception)])->assertOk();
        $this->ingest([$this->record('exception', $exception)])->assertOk();

        $issue = Issue::where('group', 'exc-1')->sole();
        $this->assertSame('RuntimeException', $issue->title);
        $this->assertSame(3, (int) $issue->occurrences);
        $this->assertSame(1, (int) $issue->ref);
        $this->assertSame('open', $issue->status);
    }

    public function test_deployments_endpoint_records_deploys()
    {
        $this->withToken('agent-token')->postJson('/api/deployments', [
            'deploy' => 'v2',
            'ref' => 'abc1234',
            'name' => 'Release 2',
            'url' => 'https://example.com/releases/2',
            'timestamp' => '2026-10-13 10:00:00.000000',
        ])->assertOk();

        $deployment = Deployment::where('deploy', 'v2')->sole();
        $this->assertSame('abc1234', $deployment->ref);
        $this->assertSame($this->environment->id, $deployment->environment_id);
    }

    /**
     * @param  array<string, mixed>  $fields
     * @return array<string, mixed>
     */
    private function record(string $type, array $fields): array
    {
        return ['v' => 1, 't' => $type, 'timestamp' => microtime(true), 'deploy' => '', 'server' => 'web-1', ...$fields];
    }

    /**
     * @param  list<array<string, mixed>>  $records
     */
    private function ingest(array $records): TestResponse
    {
        return $this->call('POST', '/api/ingest', server: [
            'HTTP_AUTHORIZATION' => 'Bearer '.$this->ingestToken(),
            'HTTP_CONTENT_ENCODING' => 'gzip',
            'CONTENT_TYPE' => 'application/json',
        ], content: gzencode(json_encode(['records' => $records])));
    }

    private function ingestToken(): string
    {
        return IngestToken::issue($this->environment->id)['token'];
    }

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    private function insertsByTable(): array
    {
        $tables = [];

        Http::recorded(function (Request $request) use (&$tables) {
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

            if (preg_match('/^INSERT INTO (\w+)/', $query['query'] ?? '', $match)) {
                foreach (array_filter(explode("\n", $request->body())) as $line) {
                    $tables[$match[1]][] = json_decode($line, true);
                }
            }

            return true;
        });

        return $tables;
    }
}
