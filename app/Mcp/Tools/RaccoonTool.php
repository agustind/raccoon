<?php

namespace App\Mcp\Tools;

use App\ClickHouse\ClickHouse;
use App\Models\Environment;
use App\Models\User;
use App\Queries\Graph;
use App\Queries\Period;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\Types\Type;
use Illuminate\Support\Collection;
use Laravel\Mcp\Request;
use Laravel\Mcp\Server\Tool;
use RuntimeException;

/**
 * Base for Raccoon's MCP tools: resolves the environment the token's user may
 * see, parses the period, and runs ClickHouse queries scoped to both.
 */
abstract class RaccoonTool extends Tool
{
    public const PERIODS = ['1h', '24h', '7d', '14d', '30d'];

    public function __construct(protected ClickHouse $clickhouse)
    {
        //
    }

    /**
     * Environments of every organization the user belongs to.
     *
     * @return Collection<int, Environment>
     */
    protected function environments(User $user): Collection
    {
        return Environment::query()
            ->with('application.organization')
            ->whereHas('application.organization.users', fn ($query) => $query->whereKey($user->id))
            ->get()
            ->sortBy(fn (Environment $environment) => $environment->application->name.'/'.$environment->name)
            ->values();
    }

    /**
     * Find an environment by id or "Application/Environment" name (case-insensitive).
     */
    protected function environment(Request $request): Environment
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new RuntimeException('Not authenticated.');
        }

        $value = trim((string) $request->get('environment', ''));
        $environments = $this->environments($user);

        if ($value === '' && $environments->count() === 1) {
            return $environments->first();
        }

        $match = $environments->first(fn (Environment $environment) => $environment->id === $value
            || strcasecmp($environment->application->name.'/'.$environment->name, $value) === 0);

        if (! $match) {
            $names = $environments->map(fn (Environment $e) => $e->application->name.'/'.$e->name)->implode(', ');

            throw new RuntimeException("Unknown environment \"{$value}\". Use list_environments. Available: {$names}");
        }

        return $match;
    }

    protected function period(Request $request, string $default = '24h'): Period
    {
        return Period::preset((string) $request->get('period', $default));
    }

    /**
     * @return array<string, mixed>
     */
    protected function bindings(Environment $environment, Period $period, array $extra = []): array
    {
        return ['environment' => $environment->id, ...$period->bindings(), ...$extra];
    }

    protected function scope(): string
    {
        return 'environment_id = {environment:UUID} AND timestamp >= {from:DateTime64(6)} AND timestamp <= {to:DateTime64(6)}';
    }

    /**
     * @param  array<string, mixed>  $bindings
     * @return list<array<string, mixed>>
     */
    protected function select(string $sql, array $bindings): array
    {
        return Graph::castAll($this->clickhouse->select($sql, $bindings));
    }

    protected function header(string $title, Environment $environment, ?Period $period = null): string
    {
        $lines = ["# {$title}", '', "Environment: {$environment->application->name}/{$environment->name}"];

        if ($period) {
            $lines[] = "Period: last {$period->label()} ({$period->from->format('Y-m-d H:i')} to {$period->to->format('Y-m-d H:i')} UTC)";
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * Absolute dashboard URL for a path inside the environment.
     */
    protected function url(Environment $environment, string $path): string
    {
        return rtrim(config('app.url'), '/')."/environments/{$environment->id}/".ltrim($path, '/');
    }

    /**
     * @return array<string, Type>
     */
    protected function environmentSchema(JsonSchema $schema): array
    {
        return [
            'environment' => $schema->string()->description('Environment id or "Application/Environment" name from list_environments. Optional when you can see only one environment.'),
        ];
    }

    protected function periodSchema(JsonSchema $schema, string $default = '24h'): Type
    {
        return $schema->string()->enum(self::PERIODS)->description("Time window ending now. Default {$default}.");
    }
}
