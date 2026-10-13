<?php

namespace App\Ingest;

use App\Events\IssueCreated;
use App\Events\IssueReopened;
use App\Models\Environment;
use App\Models\Issue;
use Illuminate\Support\Facades\DB;

class IssueRecorder
{
    /**
     * Upsert one exception issue per exception group seen in the batch.
     *
     * @param  list<array<string, mixed>>  $exceptions  normalized exception rows
     */
    public function recordExceptions(Environment $environment, array $exceptions): void
    {
        $application = $environment->application;

        // Resolve-on-deploy marks first, so an exception from the new release
        // reopens the issue instead of being swallowed by the pending mark.
        Issue::resolveDeployed($application->id);

        foreach (collect($exceptions)->groupBy('group') as $group => $rows) {
            $first = $rows->min('timestamp');
            $last = $rows->max('timestamp');
            $sample = $rows->sortByDesc('timestamp')->first();

            [$issue, $event] = DB::transaction(function () use ($application, $environment, $group, $rows, $first, $last, $sample) {
                $issue = Issue::where('application_id', $application->id)
                    ->where('issueable_type', 'exception')
                    ->where('group', $group)
                    ->lockForUpdate()
                    ->first();

                $event = null;

                if (! $issue) {
                    $issue = Issue::create([
                        'application_id' => $application->id,
                        'ref' => $application->reserveIssueRef(),
                        'type' => 'exception',
                        'issueable_type' => 'exception',
                        'group' => $group,
                        'title' => $sample['class'],
                        'subtitle' => mb_substr((string) $sample['message'], 0, 1000),
                        'first_seen_at' => $first,
                        'last_seen_at' => $last,
                        'occurrences' => $rows->count(),
                    ]);
                    $issue->activities()->create(['type' => 'created']);
                    $event = new IssueCreated($issue, $environment);
                } else {
                    $updates = [
                        'last_seen_at' => max($issue->last_seen_at->format('Y-m-d H:i:s.u'), $last),
                        'occurrences' => $issue->occurrences + $rows->count(),
                    ];

                    if ($issue->status === 'resolved') {
                        $updates += ['status' => 'open', 'resolved_at' => null];
                        $issue->activities()->create(['type' => 'reopened']);
                        $event = new IssueReopened($issue, $environment);
                    }

                    $issue->update($updates);
                }

                DB::statement(
                    'INSERT INTO issue_environment (issue_id, environment_id, first_seen_at, last_seen_at, occurrences)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT (issue_id, environment_id) DO UPDATE SET
                        last_seen_at = CASE WHEN excluded.last_seen_at > issue_environment.last_seen_at THEN excluded.last_seen_at ELSE issue_environment.last_seen_at END,
                        occurrences = issue_environment.occurrences + excluded.occurrences',
                    [$issue->id, $environment->id, $first, $last, $rows->count()],
                );

                return [$issue, $event];
            });

            if ($event) {
                event($event);
            }
        }
    }
}
