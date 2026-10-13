<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Markdown;
use App\Models\Deployment;
use App\Models\Issue;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class EnvironmentOverview extends RaccoonTool
{
    protected string $name = 'environment_overview';

    protected string $description = 'Health summary of an environment for a period: request volume, error rates and latency, jobs, exceptions, the slowest routes, open issues and deployments.';

    public function schema(JsonSchema $schema): array
    {
        return [...$this->environmentSchema($schema), 'period' => $this->periodSchema($schema)];
    }

    public function handle(Request $request): Response
    {
        $environment = $this->environment($request);
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);

        $requests = $this->select('SELECT count() AS count, countIf(status_code >= 400 AND status_code < 500) AS c4xx, countIf(status_code >= 500) AS c5xx,
                toUInt64(round(avgOrNull(duration))) AS avg, toUInt64(round(quantileOrNull(0.95)(duration))) AS p95 FROM requests WHERE '.$this->scope(), $bindings)[0] ?? [];
        $jobs = $this->select("SELECT count() AS count, countIf(status = 'failed') AS failed, countIf(status = 'released') AS released,
                toUInt64(round(quantileOrNull(0.95)(duration))) AS p95 FROM job_attempts WHERE ".$this->scope(), $bindings)[0] ?? [];
        $exceptions = $this->select('SELECT any(class) AS class, any(message) AS message, count() AS count, countIf(NOT handled) AS unhandled
                FROM exceptions WHERE '.$this->scope().' GROUP BY group ORDER BY count DESC LIMIT 5', $bindings);
        $routes = $this->select('SELECT any(route_methods) AS methods, any(route_path) AS path, count() AS count, toUInt64(round(quantile(0.95)(duration))) AS p95, sum(duration) AS total
                FROM requests WHERE '.$this->scope().' GROUP BY group ORDER BY total DESC LIMIT 5', $bindings);

        $openIssues = Issue::where('application_id', $environment->application_id)->where('status', 'open')
            ->whereHas('environments', fn ($query) => $query->whereKey($environment->id))->count();
        $deployments = Deployment::where('environment_id', $environment->id)->whereBetween('deployed_at', [$period->from, $period->to])
            ->orderByDesc('deployed_at')->limit(5)->get();

        $count = (int) ($requests['count'] ?? 0);
        $rate = fn ($n) => $count > 0 ? round($n / $count * 100, 2).'%' : '-';

        $text = $this->header('Overview', $environment, $period)."\n".implode("\n", [
            '## Requests',
            '',
            "- Total: {$count}",
            '- 4xx: '.($requests['c4xx'] ?? 0).' ('.$rate($requests['c4xx'] ?? 0).')',
            '- 5xx: '.($requests['c5xx'] ?? 0).' ('.$rate($requests['c5xx'] ?? 0).')',
            '- Avg: '.Markdown::duration($requests['avg'] ?? null).', p95: '.Markdown::duration($requests['p95'] ?? null),
            '',
            '## Jobs',
            '',
            '- Attempts: '.($jobs['count'] ?? 0).', failed: '.($jobs['failed'] ?? 0).', released: '.($jobs['released'] ?? 0).', p95: '.Markdown::duration($jobs['p95'] ?? null),
            '',
            '## Routes with the most total time',
            '',
            Markdown::table(['Route', 'Requests', 'p95', 'Total time'], array_map(fn ($r) => [implode('|', $r['methods']).' '.$r['path'], $r['count'], Markdown::duration($r['p95']), Markdown::duration($r['total'])], $routes)),
            '',
            '## Top exceptions',
            '',
            Markdown::table(['Class', 'Message', 'Count', 'Unhandled'], array_map(fn ($e) => [$e['class'], Markdown::oneLine($e['message'], 120), $e['count'], $e['unhandled']], $exceptions)),
            '',
            "## Issues\n\n- Open: {$openIssues} (use list_issues)",
            '',
            '## Deployments in this period',
            '',
            $deployments->isEmpty() ? '_none_' : $deployments->map(fn ($d) => "- {$d->deployed_at->toDateTimeString()} UTC: ".($d->ref ? substr($d->ref, 0, 7).' ' : '').($d->name ? strtok($d->name, "\n") : $d->deploy))->implode("\n"),
        ]);

        return Response::text($text);
    }
}
