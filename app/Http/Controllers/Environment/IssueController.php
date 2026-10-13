<?php

namespace App\Http\Controllers\Environment;

use App\Http\Controllers\Environment\Concerns\ResolvesExecutionSources;
use App\Models\Environment;
use App\Models\Issue;
use App\Models\IssueActivity;
use App\Models\Threshold;
use App\Models\User;
use App\Queries\Exceptions;
use App\Queries\Graph;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Issues belong to the application; the environment scopes which ones show
 * (those seen in it, via issue_environment) and where occurrences come from.
 *
 * Pages call performance issues "alert" in props; the database type is
 * "performance".
 */
class IssueController extends EnvironmentController
{
    use ResolvesExecutionSources;

    /** URL segment => issue type as pages name it. */
    private const TYPES = ['exceptions' => 'exception', 'performance' => 'alert'];

    private const FILTERS = ['open', 'unassigned', 'mine', 'resolved', 'ignored'];

    /** Days of occurrences shown per environment in the sidebar. */
    private const ENVIRONMENT_STATS_DAYS = 14;

    /** Performance issue type => [ClickHouse table, columns for the occurrence list]. */
    private const PERFORMANCE_TABLES = [
        'route' => ['requests', 'timestamp, trace_id, group, method, url, status_code, duration'],
        'job' => ['job_attempts', 'timestamp, trace_id, group, job_id, attempt_id, attempt, status, queue, connection, duration'],
        'command' => ['commands', 'timestamp, trace_id, group, exit_code, command, name, duration'],
        'scheduled_task' => ['scheduled_tasks', 'timestamp, trace_id, group, status, name, duration'],
    ];

    public function redirect(Request $request, Environment $environment): RedirectResponse
    {
        return redirect()->route('environments.issues.index', ['environment' => $environment, 'type' => 'exceptions', ...$request->query()]);
    }

    public function index(Request $request, Environment $environment, string $type): Response
    {
        Issue::resolveDeployed($environment->application_id);

        $type = self::TYPES[$type];
        $filter = in_array($request->query('filter'), self::FILTERS, true) ? $request->query('filter') : 'open';
        $sortBy = $request->string('sortBy', 'last_seen')->toString();
        $sortBy = in_array($sortBy, ['ref', 'priority', 'title', 'count', 'users', 'type', 'first_seen', 'last_seen', 'assigned'], true) ? $sortBy : 'last_seen';
        $sortDirection = strtolower($request->string('sortDirection', 'desc')->toString()) === 'asc' ? 'asc' : 'desc';

        return Inertia::render('Issues/Index', [
            'type' => $type,
            'filter' => $filter,
            'search' => $request->query('search'),
            'sortBy' => $sortBy,
            'sortDirection' => $sortDirection,
            'issues' => $this->issues($request, $environment, $type, $filter, $sortBy, $sortDirection),
            'users' => $this->members($environment),
            'filterStats' => $this->filterStats($request, $environment, $type),
        ]);
    }

    public function show(Request $request, Environment $environment, string $issue, Exceptions $exceptions): Response
    {
        Issue::resolveDeployed($environment->application_id);

        $issue = $this->find($environment, $issue);
        $issue->load(['assignee', 'activities.user']);
        $environments = $environment->application->environments()->orderBy('created_at')->get(['id', 'name', 'color']);
        $lookback = $this->lookbackDays($environment);
        $now = CarbonImmutable::now('UTC')->startOfMinute();
        $from = max(CarbonImmutable::parse($issue->first_seen_at)->startOfMinute(), $now->subDays($lookback));

        return Inertia::render('Issues/Show', [
            'issue' => $this->presentIssue($issue),
            'environment' => $environment->only(['id', 'name', 'color']),
            'environments' => $environments->map->only(['id', 'name', 'color'])->values(),
            'group' => $issue->group,
            'subscribed' => $issue->subscribers()->whereKey($request->user()->id)->exists(),
            'users' => $this->members($environment),
            'environment_stats_period' => self::ENVIRONMENT_STATS_DAYS,
            'ai_description_enabled' => false,
            'ai_model_options' => [],
            'details' => $this->details($issue, $environments->pluck('id')->all(), $exceptions),
            'from' => $from->toIso8601ZuluString('microsecond'),
            'to' => $now->toIso8601ZuluString('microsecond'),
            'lookback_period' => $lookback,
            'environment_stats' => $environments->map(fn (Environment $env) => [
                'environment' => $env->only(['id', 'name', 'color']),
                'group' => $issue->group,
                'count' => $this->occurrenceCount($issue, $env, $now->subDays(self::ENVIRONMENT_STATS_DAYS), $now),
            ])->values(),
            'occurrences' => Inertia::defer(fn () => $this->occurrences($request, $environment, $issue, $now->subDays($lookback), $now), 'table'),
        ]);
    }

    public function update(Request $request, Environment $environment, string $issue): RedirectResponse
    {
        $issue = $this->find($environment, $issue);
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(Issue::STATUSES)],
            'priority' => ['sometimes', 'integer', Rule::in(Issue::PRIORITIES)],
            'user_id' => ['sometimes', 'nullable', 'integer'],
            'resolve_on_deploy_environment_id' => ['sometimes', 'uuid'],
            'description' => ['sometimes', 'nullable', 'string', 'max:20000'],
        ]);

        DB::transaction(fn () => $this->apply($request, $environment, $issue, $data));

        return back();
    }

    public function bulkUpdate(Request $request, Environment $environment): RedirectResponse
    {
        $data = $request->validate([
            'issues' => ['required', 'array', 'min:1', 'max:500'],
            'issues.*' => ['integer'],
            'status' => ['sometimes', Rule::in(Issue::STATUSES)],
            'priority' => ['sometimes', 'integer', Rule::in(Issue::PRIORITIES)],
            'user_id' => ['sometimes', 'nullable', 'integer'],
            'resolve_on_deploy_environment_id' => ['sometimes', 'uuid'],
            'comment' => ['sometimes', 'nullable', 'string', 'max:20000'],
        ]);

        $issues = Issue::where('application_id', $environment->application_id)->whereIn('ref', $data['issues'])->get();

        DB::transaction(function () use ($request, $environment, $issues, $data) {
            foreach ($issues as $issue) {
                $this->apply($request, $environment, $issue, $data);
            }
        });

        return back()->with('success', $issues->count() === 1 ? 'Updated 1 issue' : "Updated {$issues->count()} issues");
    }

    public function comment(Request $request, Environment $environment, string $issue): RedirectResponse
    {
        $issue = $this->find($environment, $issue);
        $data = $request->validate([
            'comment' => ['required', 'string', 'max:20000'],
            'status' => ['sometimes', Rule::in(Issue::STATUSES)],
            'resolve_on_deploy_environment_id' => ['sometimes', 'uuid'],
        ]);

        DB::transaction(function () use ($request, $environment, $issue, $data) {
            if (isset($data['status']) || isset($data['resolve_on_deploy_environment_id'])) {
                $this->apply($request, $environment, $issue, $data);
            } else {
                $issue->log('comment_added', $request->user(), ['comment' => $data['comment']]);
            }
        });

        return back();
    }

    public function updateComment(Request $request, Environment $environment, string $issue, IssueActivity $activity): RedirectResponse
    {
        $activity = $this->ownComment($request, $environment, $issue, $activity);
        $data = $request->validate(['comment' => ['required', 'string', 'max:20000']]);

        $activity->update([
            'type' => str_starts_with($activity->type, 'status_update') ? 'status_update_comment_updated' : 'comment_updated',
            'data' => [...($activity->data ?? []), 'comment' => $data['comment']],
        ]);

        return back();
    }

    public function destroyComment(Request $request, Environment $environment, string $issue, IssueActivity $activity): RedirectResponse
    {
        $activity = $this->ownComment($request, $environment, $issue, $activity);

        $activity->update([
            'type' => str_starts_with($activity->type, 'status_update') ? 'status_update_comment_deleted' : 'comment_deleted',
            'data' => collect($activity->data ?? [])->except('comment')->all(),
        ]);

        return back();
    }

    public function subscribe(Request $request, Environment $environment, string $issue): RedirectResponse
    {
        $this->find($environment, $issue)->subscribers()->syncWithoutDetaching([$request->user()->id]);

        return back()->with('success', 'Subscribed to issue');
    }

    public function unsubscribe(Request $request, Environment $environment, string $issue): RedirectResponse
    {
        $this->find($environment, $issue)->subscribers()->detach($request->user()->id);

        return back()->with('success', 'Unsubscribed from issue');
    }

    /**
     * Apply status / resolve-on-deploy / priority / assignee / description
     * changes, logging one activity per change.
     *
     * @param  array<string, mixed>  $data
     */
    private function apply(Request $request, Environment $environment, Issue $issue, array $data): void
    {
        $user = $request->user();
        $comment = isset($data['comment']) && trim((string) $data['comment']) !== '' ? $data['comment'] : null;

        if (isset($data['resolve_on_deploy_environment_id'])) {
            $target = $environment->application->environments()->findOrFail($data['resolve_on_deploy_environment_id']);
            $issue->markResolveOnDeploy($target, $environment, $user, $comment);
        } elseif (isset($data['status'])) {
            $issue->updateStatus($data['status'], $environment, $user, $comment);
        }

        if (array_key_exists('priority', $data)) {
            $issue->setPriority((int) $data['priority'], $user);
        }

        if (array_key_exists('user_id', $data)) {
            $assignee = $data['user_id'] === null ? null : $environment->application->organization->users()->whereKey($data['user_id'])->first()
                ?? throw ValidationException::withMessages(['user_id' => 'The assignee must be a member of the organization.']);
            $issue->assign($assignee, $environment, $user);
        }

        if (array_key_exists('description', $data)) {
            $issue->update(['description' => $data['description']]);
        }
    }

    private function find(Environment $environment, string $ref): Issue
    {
        abort_unless(ctype_digit($ref), 404);

        return Issue::where('application_id', $environment->application_id)->where('ref', (int) $ref)->firstOrFail();
    }

    private function ownComment(Request $request, Environment $environment, string $ref, IssueActivity $activity): IssueActivity
    {
        $issue = $this->find($environment, $ref);

        abort_unless((int) $activity->issue_id === $issue->id && (int) $activity->user_id === $request->user()->id, 403);
        abort_unless(in_array($activity->type, ['comment_added', 'comment_updated', 'status_updated_with_comment', 'status_update_comment_updated'], true), 404);

        return $activity;
    }

    /**
     * Issues seen in this environment, with search applied.
     */
    private function scoped(Request $request, Environment $environment): Builder
    {
        $query = Issue::query()
            ->where('issues.application_id', $environment->application_id)
            ->whereExists(fn ($q) => $q->from('issue_environment')
                ->whereColumn('issue_environment.issue_id', 'issues.id')
                ->where('issue_environment.environment_id', $environment->id));

        if ($request->filled('search')) {
            $search = $request->string('search')->trim()->toString();
            $query->where(function (Builder $q) use ($search) {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $q->where('title', 'ilike', $like)->orWhere('subtitle', 'ilike', $like);

                if (ctype_digit($search)) {
                    $q->orWhere('ref', (int) $search);
                }
            });
        }

        return $query;
    }

    /**
     * @return array<string, mixed>
     */
    private function issues(Request $request, Environment $environment, string $type, string $filter, string $sortBy, string $direction): array
    {
        $query = $this->scoped($request, $environment)->where('type', $type === 'alert' ? 'performance' : 'exception');

        match ($filter) {
            'unassigned' => $query->where('status', 'open')->whereNull('assignee_id'),
            'mine' => $query->where('status', 'open')->where('assignee_id', $request->user()->id),
            default => $query->where('status', $filter),
        };

        $perPage = 25;
        $page = $this->page($request);
        $total = (clone $query)->count();

        if ($type === 'exception' && in_array($sortBy, ['count', 'users'], true)) {
            // Counts live in ClickHouse, so sort the matching ids in PHP.
            $all = (clone $query)->get(['id', 'group', 'last_seen_at']);
            $stats = $this->exceptionStats($environment, $all->pluck('group')->all());
            $key = $sortBy === 'count' ? 'occurrences' : 'impacted_users';
            $value = fn (Issue $issue) => $stats[$issue->group][$key] ?? 0;
            $ids = ($direction === 'desc' ? $all->sortByDesc($value) : $all->sortBy($value))
                ->slice(($page - 1) * $perPage, $perPage)->pluck('id')->all();
            $rows = Issue::with('assignee')->whereIn('id', $ids)->get()->sortBy(fn ($issue) => array_search($issue->id, $ids))->values();
        } else {
            $column = match ($sortBy) {
                'ref' => 'ref', 'priority' => 'priority', 'title' => 'title', 'count' => 'occurrences', 'users' => 'impacted_users',
                'type' => 'issueable_type', 'first_seen' => 'first_seen_at', 'assigned' => 'assignee_id', default => 'last_seen_at',
            };
            $rows = $query->with('assignee')->orderByRaw("{$column} {$direction} NULLS LAST")->orderByDesc('id')
                ->offset(($page - 1) * $perPage)->limit($perPage)->get();
            $stats = $type === 'exception' ? $this->exceptionStats($environment, $rows->pluck('group')->all()) : [];
        }

        $items = $rows->map(fn (Issue $issue) => [
            'type' => $type,
            'ref' => $issue->ref,
            'priority' => $issue->priority,
            'title' => $issue->title,
            'subtitle' => $issue->subtitle,
            'status' => $issue->status,
            'issueable_type' => $issue->issueable_type,
            'group' => $issue->group,
            'first_seen_at' => $issue->first_seen_at?->toJSON(),
            'last_seen_at' => $issue->last_seen_at?->toJSON(),
            'user' => self::presentMember($issue->assignee),
            'occurrences' => $type === 'exception' ? ($stats[$issue->group]['occurrences'] ?? 0) : $issue->occurrences,
            'impacted_users' => $type === 'exception' ? ($stats[$issue->group]['impacted_users'] ?? 0) : $issue->impacted_users,
            'resolve_on_deploy_environment_id' => $issue->resolve_on_deploy_environment_id,
        ])->values()->all();

        return $this->paginator($request, $items, $total, $perPage);
    }

    /**
     * Occurrences and impacted users per exception group over the lookback period.
     *
     * @param  list<string>  $groups
     * @return array<string, array{occurrences: int, impacted_users: int}>
     */
    private function exceptionStats(Environment $environment, array $groups): array
    {
        if ($groups === []) {
            return [];
        }

        $rows = $this->select(
            "SELECT group, count() AS occurrences, uniqExactIf(user, user != '') AS impacted_users FROM exceptions
             WHERE environment_id = {environment:UUID} AND group IN {groups:Array(String)} AND timestamp >= now64() - INTERVAL {days:UInt32} DAY
             GROUP BY group",
            ['environment' => $environment->id, 'groups' => array_values(array_unique($groups)), 'days' => $this->lookbackDays($environment)],
        );

        return array_column(array_map(fn ($row) => [...$row, 'group' => (string) $row['group']], $rows), null, 'group');
    }

    /**
     * @return array<string, int>
     */
    private function filterStats(Request $request, Environment $environment, string $type): array
    {
        $dbType = $type === 'alert' ? 'performance' : 'exception';
        $row = $this->scoped($request, $environment)->toBase()->selectRaw(
            "count(*) filter (where status = 'open' and type = ?) as open,
             count(*) filter (where status = 'open' and type = ? and assignee_id is null) as unassigned,
             count(*) filter (where status = 'open' and type = ? and assignee_id = ?) as mine,
             count(*) filter (where status = 'resolved' and type = ?) as resolved,
             count(*) filter (where status = 'ignored' and type = ?) as ignored,
             count(*) filter (where status = 'open' and type = 'exception') as exception,
             count(*) filter (where status = 'open' and type = 'performance') as alert",
            [$dbType, $dbType, $dbType, $request->user()->id, $dbType, $dbType],
        )->first();

        return array_map('intval', (array) $row);
    }

    /**
     * @return list<array{id: int, name: string, avatar_url: ?string}>
     */
    private function members(Environment $environment): array
    {
        return $environment->application->organization->users()->orderBy('name')->get(['users.id', 'users.name', 'users.avatar_url'])
            ->map(fn (User $user) => self::presentMember($user))->values()->all();
    }

    /**
     * @return array{id: int, name: string, avatar_url: ?string}|null
     */
    private static function presentMember(?User $user): ?array
    {
        return $user ? ['id' => $user->id, 'name' => $user->name, 'avatar_url' => $user->avatar_url] : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function presentIssue(Issue $issue): array
    {
        $title = $issue->type === 'exception' && $issue->subtitle ? "{$issue->title}: {$issue->subtitle}" : $issue->title;

        return [
            'ref' => $issue->ref,
            'type' => $issue->type === 'performance' ? 'alert' : 'exception',
            'issueable_type' => $issue->issueable_type,
            'linear_issue_identifier' => null,
            'status' => $issue->status,
            'priority' => $issue->priority,
            'title' => $title,
            'subtitle' => $issue->subtitle,
            'description' => (string) $issue->description,
            'created_at' => $issue->created_at?->toJSON(),
            'first_seen_at' => $issue->first_seen_at?->toJSON(),
            'last_seen_at' => $issue->last_seen_at?->toJSON(),
            'user' => self::presentMember($issue->assignee),
            'resolve_on_deploy_environment_id' => $issue->resolve_on_deploy_environment_id,
            'activityLogs' => $issue->activities
                ->reject(fn (IssueActivity $activity) => $activity->type === 'created')
                ->sortBy('id')
                ->map(fn (IssueActivity $activity) => self::presentActivity($activity))
                ->values()
                ->all(),
        ];
    }

    /**
     * Activity log shape: {id, event, payload, user, timestamp}.
     *
     * @return array<string, mixed>
     */
    private static function presentActivity(IssueActivity $activity): array
    {
        // The ingest side logs `reopened` when an occurrence reopens a resolved issue.
        [$event, $payload] = $activity->type === 'reopened'
            ? ['status_updated', ['new_status' => 'open', 'previous_status' => 'resolved']]
            : [$activity->type, $activity->data ?? []];

        return [
            'id' => $activity->id,
            'event' => $event,
            'payload' => (object) $payload,
            'user_id' => $activity->user_id,
            'user' => self::presentMember($activity->user),
            'timestamp' => $activity->created_at?->toJSON(),
            'created_at' => $activity->created_at?->toJSON(),
            'updated_at' => $activity->updated_at?->toJSON(),
        ];
    }

    /**
     * Exception details for exception issues; deploy info for every issue.
     *
     * @param  list<string>  $environmentIds
     * @return array<string, mixed>
     */
    private function details(Issue $issue, array $environmentIds, Exceptions $exceptions): array
    {
        if ($issue->issueable_type !== 'exception') {
            return ['first_deploy' => null, 'last_deploy' => null];
        }

        $details = $exceptions->details($environmentIds, $issue->group);

        if (! $details) {
            return [
                'class' => $issue->title, 'code' => '0', 'file' => '', 'line' => 0, 'message' => (string) $issue->subtitle,
                'php_version' => null, 'laravel_version' => null, 'trace' => [], 'handled' => false, 'group' => $issue->group,
                'first_deploy' => null, 'last_deploy' => null,
            ];
        }

        return [
            ...collect($details)->only(['class', 'code', 'file', 'line', 'message', 'trace', 'handled'])->all(),
            'php_version' => $details['last_php_version'],
            'laravel_version' => $details['last_laravel_version'],
            'group' => $issue->group,
            'first_deploy' => Exceptions::deployment($details['first_environment_id'], $details['first_seen_deploy']),
            'last_deploy' => Exceptions::deployment($details['last_environment_id'], $details['last_seen_deploy']),
        ];
    }

    private function lookbackDays(Environment $environment): int
    {
        return max(1, (int) ($environment->application->organization->lookback_period ?? 30));
    }

    /**
     * Table and extra WHERE for the issue's occurrences: exception rows of the
     * group, or executions of the group over its threshold.
     *
     * @return array{0: string, 1: string, 2: array<string, mixed>}
     */
    private function occurrenceSource(Issue $issue): array
    {
        if ($issue->issueable_type === 'exception') {
            return ['exceptions', '', []];
        }

        $threshold = Threshold::where('application_id', $issue->application_id)
            ->where('type', $issue->issueable_type)
            ->where('group', $issue->group)
            ->value('threshold_ms');

        return [
            self::PERFORMANCE_TABLES[$issue->issueable_type][0] ?? 'requests',
            $threshold ? ' AND duration > {limit:UInt64}' : '',
            $threshold ? ['limit' => $threshold * 1000] : [],
        ];
    }

    private function occurrenceCount(Issue $issue, Environment $environment, CarbonImmutable $from, CarbonImmutable $to): int
    {
        [$table, $where, $extra] = $this->occurrenceSource($issue);

        return (int) $this->clickhouse->value(
            "SELECT count() FROM {$table} WHERE environment_id = {environment:UUID} AND group = {group:String}
             AND timestamp >= {from:DateTime64(6)} AND timestamp <= {to:DateTime64(6)}{$where}",
            ['environment' => $environment->id, 'group' => $issue->group, 'from' => $from->format('Y-m-d H:i:s.u'), 'to' => $to->format('Y-m-d H:i:s.u'), ...$extra],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function occurrences(Request $request, Environment $environment, Issue $issue, CarbonImmutable $from, CarbonImmutable $to): array
    {
        [$table, $where, $extra] = $this->occurrenceSource($issue);
        $perPage = 10;
        $bindings = ['environment' => $environment->id, 'group' => $issue->group, 'from' => $from->format('Y-m-d H:i:s.u'), 'to' => $to->format('Y-m-d H:i:s.u'), ...$extra];
        $scope = "environment_id = {environment:UUID} AND group = {group:String} AND timestamp >= {from:DateTime64(6)} AND timestamp <= {to:DateTime64(6)}{$where}";
        $columns = $table === 'exceptions'
            ? 'timestamp, message, user, execution_source, trace_id, execution_id, execution_preview'
            : self::PERFORMANCE_TABLES[$issue->issueable_type][1];

        $total = (int) $this->clickhouse->value("SELECT count() FROM {$table} WHERE {$scope}", $bindings);
        $rows = $this->select(
            "SELECT {$columns} FROM {$table} WHERE {$scope} ORDER BY timestamp DESC LIMIT {$perPage} OFFSET {$this->offset($request, $perPage)}",
            $bindings,
        );

        if ($table === 'exceptions') {
            $users = $this->users($environment, array_column($rows, 'user'));
            $rows = array_map(fn ($row) => [...$row, 'message' => (string) $row['message'], 'user' => self::presentUser($users, $row['user'])], $rows);
            $rows = $this->withExecutionUrls($environment, $rows);
        }

        return $this->paginator($request, array_map(Graph::cast(...), $rows), $total, $perPage);
    }
}
