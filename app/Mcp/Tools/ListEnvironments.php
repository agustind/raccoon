<?php

namespace App\Mcp\Tools;

use App\Mcp\Support\Markdown;
use App\Models\Environment;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
class ListEnvironments extends RaccoonTool
{
    protected string $name = 'list_environments';

    protected string $description = 'List the applications and environments you can query, with their ids. Start here; every other tool takes an environment.';

    public function handle(Request $request): Response
    {
        $rows = $this->environments($request->user())->map(fn (Environment $environment) => [
            $environment->application->organization->name,
            "{$environment->application->name}/{$environment->name}",
            $environment->id,
            $environment->last_ingested_at?->toDateTimeString() ?? 'never',
        ])->all();

        return Response::text("# Environments\n\n".Markdown::table(['Organization', 'Environment', 'Id', 'Last event (UTC)'], $rows));
    }
}
