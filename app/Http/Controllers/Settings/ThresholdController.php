<?php

namespace App\Http\Controllers\Settings;

use App\ClickHouse\ClickHouse;
use App\Models\Application;
use App\Models\Organization;
use App\Models\Threshold;
use App\Queries\Graph;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Duration thresholds per route, job, command or scheduled task. The
 * candidates come from what the application's environments reported to
 * ClickHouse, identified by the same `group` hash the dashboards use.
 */
class ThresholdController extends SettingsController
{
    /**
     * Threshold type => [paginator prop, ClickHouse table, select list, label expression
     * over the select list's aliases].
     */
    private const TYPES = [
        'route' => ['routes', 'requests', 'any(route_methods) AS methods, any(route_domain) AS domain, any(route_path) AS path', "concat(arrayStringConcat(methods, '|'), ' ', domain, path)"],
        'job' => ['jobs', 'job_attempts', 'any(name) AS name', 'name'],
        'command' => ['commands', 'commands', 'any(name) AS name', 'name'],
        'scheduled_task' => ['scheduled_tasks', 'scheduled_tasks', 'any(name) AS name, any(cron) AS cron', 'name'],
    ];

    private const PER_PAGE = 25;

    public function __construct(private ClickHouse $clickhouse)
    {
        //
    }

    public function index(Request $request, Organization $organization, Application $application): Response
    {
        $this->authorizeOrganization($request, $organization, 'threshold.show');

        $environmentIds = $application->environments()->pluck('id')->all();
        $candidates = [];

        foreach (self::TYPES as $type => [$prop]) {
            $candidates[$prop] = fn () => $this->candidates($request, $type, $environmentIds);
        }

        return Inertia::render('Settings/Applications/Thresholds', [
            ...$this->applicationProps($organization, $application),
            'thresholds' => $this->thresholds($application),
            ...$candidates,
        ]);
    }

    public function store(Request $request, Organization $organization, Application $application): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'threshold.create');

        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(self::TYPES))],
            'group' => [
                'required', 'string', 'max:64',
                Rule::unique('thresholds', 'group')->where('application_id', $application->id)->where('type', $request->input('type')),
            ],
            'duration' => ['required', 'integer', 'min:1', 'max:3600000'],
        ], ['group.unique' => 'This one already has a threshold.', 'group.required' => 'Pick one from the list.']);

        $name = $this->name($data['type'], $data['group'], $application->environments()->pluck('id')->all());

        abort_if($name === null, 422, 'Unknown target.');

        $application->thresholds()->create([
            'type' => $data['type'],
            'group' => $data['group'],
            'name' => $name,
            'threshold_ms' => $data['duration'],
        ]);

        return back()->with('success', 'Threshold added.');
    }

    public function update(Request $request, Organization $organization, Application $application, Threshold $threshold): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'threshold.edit');

        $data = $request->validate(['duration' => ['required', 'integer', 'min:1', 'max:3600000']]);

        $threshold->update(['threshold_ms' => $data['duration']]);

        return back()->with('success', 'Threshold updated.');
    }

    public function destroy(Request $request, Organization $organization, Application $application, Threshold $threshold): RedirectResponse
    {
        $this->authorizeOrganization($request, $organization, 'threshold.delete');

        $threshold->delete();

        return back()->with('success', 'Threshold deleted.');
    }

    /**
     * @return array<string, list<array<string, mixed>>>
     */
    private function thresholds(Application $application): array
    {
        $byType = array_fill_keys(array_keys(self::TYPES), []);

        foreach ($application->thresholds()->orderBy('name')->get() as $threshold) {
            $byType[$threshold->type][] = [
                'id' => $threshold->id,
                'type' => $threshold->type,
                'group' => $threshold->group,
                'name' => $threshold->name,
                'duration' => $threshold->threshold_ms,
            ];
        }

        return $byType;
    }

    /**
     * Paginated distinct groups for one type, searchable with ?<prop>_search=
     * and paged with ?<prop>=<page>.
     *
     * @param  list<string>  $environmentIds
     * @return array<string, mixed>
     */
    private function candidates(Request $request, string $type, array $environmentIds): array
    {
        [$prop, $table, $select, $label] = self::TYPES[$type];
        $page = max(1, $request->integer($prop, 1));
        $search = trim($request->string("{$prop}_search")->toString());
        $bindings = ['environments' => $environmentIds, 'search' => $search, 'limit' => self::PER_PAGE, 'offset' => ($page - 1) * self::PER_PAGE];

        $sql = "SELECT group, {$select}, {$label} AS label FROM {$table}"
            .' WHERE environment_id IN {environments:Array(UUID)} AND timestamp >= now() - INTERVAL 30 DAY'
            .' GROUP BY group'
            .' HAVING {search:String} = \'\' OR positionCaseInsensitive(label, {search:String}) > 0';

        $total = $environmentIds === [] ? 0 : (int) $this->clickhouse->value("SELECT count() FROM ({$sql})", $bindings);
        $rows = $total === 0 ? [] : Graph::castAll($this->clickhouse->select("{$sql} ORDER BY label LIMIT {limit:UInt32} OFFSET {offset:UInt32}", $bindings));

        return (new LengthAwarePaginator($rows, $total, self::PER_PAGE, $page, [
            'path' => $request->url(),
            'pageName' => $prop,
        ]))->toArray();
    }

    /**
     * Display name stored with the threshold, e.g. "GET /users/{user}".
     *
     * @param  list<string>  $environmentIds
     */
    private function name(string $type, string $group, array $environmentIds): ?string
    {
        if ($environmentIds === []) {
            return null;
        }

        [, $table, $select] = self::TYPES[$type];
        $row = $this->clickhouse->first(
            "SELECT {$select} FROM {$table} WHERE environment_id IN {environments:Array(UUID)} AND group = {group:String} GROUP BY group",
            ['environments' => $environmentIds, 'group' => $group],
        );

        if ($row === null) {
            return null;
        }

        return $type === 'route'
            ? trim(implode('|', array_diff($row['methods'], ['HEAD'])).' '.$row['domain'].$row['path'])
            : $row['name'];
    }
}
