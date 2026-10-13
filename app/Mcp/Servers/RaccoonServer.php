<?php

namespace App\Mcp\Servers;

use App\Mcp\Tools\EnvironmentOverview;
use App\Mcp\Tools\GetIssue;
use App\Mcp\Tools\GetJobAttempt;
use App\Mcp\Tools\GetRequest;
use App\Mcp\Tools\GetRoute;
use App\Mcp\Tools\ListEnvironments;
use App\Mcp\Tools\ListIssues;
use App\Mcp\Tools\SearchLogs;
use App\Mcp\Tools\SlowJobs;
use App\Mcp\Tools\SlowRoutes;
use App\Mcp\Tools\TopQueries;
use App\Mcp\Tools\UpdateIssue;
use Laravel\Mcp\Server;

class RaccoonServer extends Server
{
    protected string $name = 'Raccoon';

    protected string $version = '1.0.0';

    protected string $instructions = <<<'MARKDOWN'
        Raccoon is a self-hosted monitor for Laravel apps. These tools read production telemetry: requests, jobs, database queries, exceptions (grouped into issues) and logs.

        Typical workflow:
        1. list_environments, then environment_overview to see what is slow or failing.
        2. slow_routes / slow_jobs / top_queries to rank problems (sort by total_time to find where time goes; top_queries with sort=calls_per_execution to find N+1 queries).
        3. get_route, get_request, get_job_attempt or get_issue for evidence: SQL, file:line locations, stack traces.
        4. Fix the code in the repository, then check the same numbers again after the deploy.
        5. Optionally update_issue to resolve the issue with a comment describing the fix (needs a write token).

        Durations are wall-clock times measured in production. Data covers the last 30 days at most.
        MARKDOWN;

    protected array $tools = [
        ListEnvironments::class,
        EnvironmentOverview::class,
        SlowRoutes::class,
        GetRoute::class,
        GetRequest::class,
        SlowJobs::class,
        GetJobAttempt::class,
        TopQueries::class,
        ListIssues::class,
        GetIssue::class,
        SearchLogs::class,
        UpdateIssue::class,
    ];
}
