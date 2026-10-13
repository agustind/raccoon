<?php

namespace App\Thresholds;

use App\ClickHouse\ClickHouse;
use App\Events\IssueCreated;
use App\Events\IssueReopened;
use App\Events\ThresholdExceeded;
use App\Models\Environment;
use App\Models\Issue;
use App\Models\Threshold;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Compares each thresholded group's recent p95 duration with its threshold
 * and opens a performance issue when it is over.
 */
class ThresholdEvaluator
{
    public const WINDOW_SECONDS = 300;

    /**
     * Threshold type => ClickHouse table and the column used as the issue title.
     */
    private const SOURCES = [
        'route' => ['table' => 'requests', 'title' => 'route_path'],
        'job' => ['table' => 'job_attempts', 'title' => 'name'],
        'command' => ['table' => 'commands', 'title' => 'name'],
        'scheduled_task' => ['table' => 'scheduled_tasks', 'title' => 'name'],
    ];

    public function __construct(private ClickHouse $clickhouse)
    {
        //
    }

    /**
     * Evaluate every environment that has thresholds. Returns the number of
     * groups found over their threshold.
     */
    public function evaluateAll(?CarbonImmutable $now = null): int
    {
        $now ??= CarbonImmutable::now('UTC');
        $exceeded = 0;

        $thresholds = Threshold::whereIn('type', array_keys(self::SOURCES))->get()->groupBy('application_id');

        Environment::whereIn('application_id', $thresholds->keys())->with('application')->each(
            function (Environment $environment) use ($thresholds, $now, &$exceeded) {
                $exceeded += $this->evaluate($environment, $thresholds[$environment->application_id], $now);
            },
        );

        return $exceeded;
    }

    /**
     * @param  Collection<int, Threshold>  $thresholds  the application's thresholds
     */
    public function evaluate(Environment $environment, Collection $thresholds, CarbonImmutable $now): int
    {
        $exceeded = 0;
        $from = $now->subSeconds(self::WINDOW_SECONDS);

        foreach ($thresholds->groupBy('type') as $type => $byType) {
            $source = self::SOURCES[$type] ?? null;

            if (! $source) {
                continue;
            }

            $byGroup = $byType->keyBy('group');

            $rows = $this->clickhouse->select(
                "SELECT group, any({$source['title']}) AS title, toUInt64(round(quantile(0.95)(duration))) AS p95
                 FROM {$source['table']}
                 WHERE environment_id = {environment:UUID} AND timestamp > {from:DateTime64(6)} AND timestamp <= {to:DateTime64(6)}
                    AND group IN {groups:Array(String)}
                 GROUP BY group",
                [
                    'environment' => $environment->id,
                    'from' => $from->format('Y-m-d H:i:s.u'),
                    'to' => $now->format('Y-m-d H:i:s.u'),
                    'groups' => $byGroup->keys()->all(),
                ],
            );

            foreach ($rows as $row) {
                $threshold = $byGroup[$row['group']];
                $p95 = (int) $row['p95'];

                if ($p95 > $threshold->threshold_ms * 1000) {
                    $this->record($environment, $threshold, $source['table'], $row['title'] !== '' ? $row['title'] : $threshold->name, $p95, $from, $now);
                    $exceeded++;
                }
            }
        }

        return $exceeded;
    }

    /**
     * Create, update or reopen the group's performance issue. Occurrences count
     * the executions over the threshold that earlier runs have not counted yet,
     * since consecutive windows overlap.
     */
    private function record(Environment $environment, Threshold $threshold, string $table, string $title, int $p95, CarbonImmutable $from, CarbonImmutable $now): void
    {
        $application = $environment->application;

        $lastCounted = DB::table('issue_environment')
            ->join('issues', 'issues.id', '=', 'issue_environment.issue_id')
            ->where('issues.application_id', $application->id)
            ->where('issues.issueable_type', $threshold->type)
            ->where('issues.group', $threshold->group)
            ->where('issue_environment.environment_id', $environment->id)
            ->value('issue_environment.last_seen_at');

        $since = $lastCounted ? max($from, CarbonImmutable::parse($lastCounted, 'UTC')) : $from;

        $slow = $this->clickhouse->first(
            "SELECT count() AS count, min(timestamp) AS first, max(timestamp) AS last
             FROM {$table}
             WHERE environment_id = {environment:UUID} AND group = {group:String} AND duration > {limit:UInt64}
                AND timestamp > {since:DateTime64(6)} AND timestamp <= {to:DateTime64(6)}",
            [
                'environment' => $environment->id,
                'group' => $threshold->group,
                'limit' => $threshold->threshold_ms * 1000,
                'since' => $since->format('Y-m-d H:i:s.u'),
                'to' => $now->format('Y-m-d H:i:s.u'),
            ],
        );

        $count = (int) ($slow['count'] ?? 0);
        $first = $count > 0 ? $slow['first'] : $now->format('Y-m-d H:i:s.u');
        $last = $count > 0 ? $slow['last'] : $now->format('Y-m-d H:i:s.u');
        $subtitle = "P95 above {$threshold->threshold_ms}ms";

        $events = DB::transaction(function () use ($application, $environment, $threshold, $title, $subtitle, $count, $first, $last, $p95) {
            $issue = Issue::where('application_id', $application->id)
                ->where('issueable_type', $threshold->type)
                ->where('group', $threshold->group)
                ->lockForUpdate()
                ->first();

            $events = [];

            if (! $issue) {
                $issue = Issue::create([
                    'application_id' => $application->id,
                    'ref' => $application->reserveIssueRef(),
                    'type' => 'performance',
                    'issueable_type' => $threshold->type,
                    'group' => $threshold->group,
                    'title' => $title,
                    'subtitle' => $subtitle,
                    'first_seen_at' => $first,
                    'last_seen_at' => $last,
                    'occurrences' => $count,
                ]);
                $issue->activities()->create(['type' => 'created']);
                $events = [new IssueCreated($issue, $environment), new ThresholdExceeded($issue, $environment, $threshold, $p95)];
            } else {
                $updates = [
                    'subtitle' => $subtitle,
                    'last_seen_at' => max($issue->last_seen_at->format('Y-m-d H:i:s.u'), $last),
                    'occurrences' => $issue->occurrences + $count,
                ];

                if ($issue->status === 'resolved') {
                    $updates += ['status' => 'open', 'resolved_at' => null];
                    $issue->activities()->create(['type' => 'reopened']);
                    $events = [new IssueReopened($issue, $environment), new ThresholdExceeded($issue, $environment, $threshold, $p95)];
                }

                $issue->update($updates);
            }

            DB::statement(
                'INSERT INTO issue_environment (issue_id, environment_id, first_seen_at, last_seen_at, occurrences)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT (issue_id, environment_id) DO UPDATE SET
                    last_seen_at = GREATEST(issue_environment.last_seen_at, EXCLUDED.last_seen_at),
                    occurrences = issue_environment.occurrences + EXCLUDED.occurrences',
                [$issue->id, $environment->id, $first, $last, $count],
            );

            return $events;
        });

        foreach ($events as $event) {
            event($event);
        }
    }
}
