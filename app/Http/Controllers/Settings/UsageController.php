<?php

namespace App\Http\Controllers\Settings;

use App\ClickHouse\ClickHouse;
use App\Models\Application;
use App\Models\Environment;
use App\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Events ingested per environment and record type, from `ingest_usage`
 * (hourly buckets written by the ingest endpoint). Periods are calendar
 * months; there are no plans or limits.
 */
class UsageController extends SettingsController
{
    private const LABELS = [
        'cache-event' => 'Cache events',
        'command' => 'Commands',
        'exception' => 'Exceptions',
        'job-attempt' => 'Job attempts',
        'log' => 'Logs',
        'mail' => 'Mail',
        'notification' => 'Notifications',
        'outgoing-request' => 'Outgoing requests',
        'query' => 'Queries',
        'queued-job' => 'Queued jobs',
        'request' => 'Requests',
        'scheduled-task' => 'Scheduled tasks',
        'user' => 'Users',
    ];

    private const MONTHS = 12;

    public function __construct(private ClickHouse $clickhouse)
    {
        //
    }

    public function show(Request $request, Organization $organization): Response
    {
        $this->authorizeOrganization($request, $organization, 'organization.show');

        $periods = $this->periods();
        $from = collect($periods)->firstWhere('key', $request->query('period'))['from'] ?? $periods[0]['from'];
        $from = CarbonImmutable::parse($from)->utc();
        $to = $from->endOfMonth();

        $applications = $organization->applications()->with(['environments' => fn ($q) => $q->orderBy('created_at')])->orderBy('name')->get();
        $environmentIds = $applications->flatMap->environments->pluck('id')->all();
        $bindings = ['environments' => $environmentIds, 'from' => $from->format('Y-m-d H:i:s'), 'to' => $to->format('Y-m-d H:i:s')];

        // Shared by the deferred props of one request, loaded on first use.
        $rows = null;
        $hourly = function () use (&$rows, $environmentIds, $bindings) {
            return $rows ??= $environmentIds === [] ? [] : $this->clickhouse->select(
                'SELECT environment_id, formatDateTime(bucket, \'%Y-%m-%d %H:%i:%S\') AS hour, sum(events) AS events FROM ingest_usage'
                .' WHERE environment_id IN {environments:Array(UUID)} AND bucket >= {from:DateTime} AND bucket <= {to:DateTime}'
                .' GROUP BY environment_id, hour',
                $bindings,
            );
        };

        return Inertia::render('Settings/Organizations/Usage', [
            'organization' => ['id' => $organization->id, 'name' => $organization->name],
            'periods' => $periods,
            'current_period' => ['key' => $from->format('Y-m'), 'from' => $from->toIso8601ZuluString(), 'to' => $to->toIso8601ZuluString()],
            'graph' => Inertia::defer(fn () => $this->graph($from, $to, $hourly()), 'graph'),
            'captured_total' => Inertia::defer(fn () => (int) array_sum(array_column($hourly(), 'events')), 'events'),
            'rate_limited_total' => Inertia::defer(fn () => 0, 'events'),
            'applications' => Inertia::defer(fn () => $this->applications($applications, $from, $to, $bindings, $hourly()), 'events'),
        ]);
    }

    /**
     * The last twelve calendar months, newest first.
     *
     * @return list<array{key: string, label: string, from: string, to: string}>
     */
    private function periods(): array
    {
        $month = CarbonImmutable::now('UTC')->startOfMonth();

        return array_map(function (int $i) use ($month) {
            $from = $month->subMonthsNoOverflow($i);

            return ['key' => $from->format('Y-m'), 'label' => $from->format('F Y'), 'from' => $from->toIso8601ZuluString(), 'to' => $from->endOfMonth()->toIso8601ZuluString()];
        }, range(0, self::MONTHS - 1));
    }

    /**
     * One entry per hour of the month. `total` is the running sum; hours in
     * the future are null so the chart stops at now.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function graph(CarbonImmutable $from, CarbonImmutable $to, array $rows, ?string $environmentId = null): array
    {
        $byBucket = [];

        foreach ($rows as $row) {
            if ($environmentId === null || $row['environment_id'] === $environmentId) {
                $byBucket[$row['hour']] = ($byBucket[$row['hour']] ?? 0) + (int) $row['events'];
            }
        }

        $now = CarbonImmutable::now('UTC');
        $graph = [];
        $total = 0;

        for ($bucket = $from; $bucket->lte($to); $bucket = $bucket->addHour()) {
            $key = $bucket->format('Y-m-d H:i:s');

            if ($bucket->gt($now)) {
                $graph[] = ['bucket' => $key, 'captured' => null, 'rate_limited' => null, 'total' => null];

                continue;
            }

            $captured = $byBucket[$key] ?? 0;
            $total += $captured;
            $graph[] = ['bucket' => $key, 'captured' => $captured, 'rate_limited' => 0, 'total' => $total];
        }

        return $graph;
    }

    /**
     * @param  Collection<int, Application>  $applications
     * @param  array<string, mixed>  $bindings
     * @param  list<array<string, mixed>>  $hourly
     * @return list<array<string, mixed>>
     */
    private function applications($applications, CarbonImmutable $from, CarbonImmutable $to, array $bindings, array $hourly): array
    {
        $byType = [];

        if ($bindings['environments'] !== []) {
            foreach ($this->clickhouse->select(
                'SELECT environment_id, type, sum(events) AS events FROM ingest_usage'
                .' WHERE environment_id IN {environments:Array(UUID)} AND bucket >= {from:DateTime} AND bucket <= {to:DateTime}'
                .' GROUP BY environment_id, type',
                $bindings,
            ) as $row) {
                $byType[$row['environment_id']][$row['type']] = (int) $row['events'];
            }
        }

        return $applications->map(fn (Application $application) => [
            'id' => $application->id,
            'name' => $application->name,
            'avatar_url' => $application->avatar_url,
            'environments' => $application->environments->map(function (Environment $environment) use ($byType, $from, $to, $hourly) {
                $counts = $byType[$environment->id] ?? [];
                $types = array_unique([...array_keys(self::LABELS), ...array_keys($counts)]);
                sort($types);

                return [
                    'id' => $environment->id,
                    'name' => $environment->name,
                    'application_id' => $environment->application_id,
                    'color' => $environment->color,
                    'events' => array_values(array_map(fn (string $type) => [
                        'label' => self::LABELS[$type] ?? ucfirst(str_replace('-', ' ', $type)),
                        'captured' => $counts[$type] ?? 0,
                        'rate_limited' => 0,
                    ], $types)),
                    'captured_total' => array_sum($counts),
                    'rate_limited_total' => 0,
                    'graph' => $this->graph($from, $to, $hourly, $environment->id),
                ];
            })->values()->all(),
        ])->values()->all();
    }
}
