<?php

namespace App\Http\Controllers\Environment;

use App\Http\Controllers\Environment\Concerns\ResolvesExecutionSources;
use App\Models\Environment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LogController extends EnvironmentController
{
    use ResolvesExecutionSources;

    public const LEVELS = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];

    private const PER_PAGE = 100;

    public function index(Request $request, Environment $environment): Response|JsonResponse
    {
        $period = $this->period($request);
        $bindings = $this->bindings($environment, $period);
        $where = $this->scope().$this->cursorWhere($request, $bindings);

        if ($request->filled('user')) {
            $bindings['user'] = $request->string('user')->toString();
            $where .= ' AND user = {user:String}';
        }

        $levels = array_values(array_intersect(self::LEVELS, explode(',', $request->string('levels')->toString())));

        if ($levels !== []) {
            $bindings['levels'] = $levels;
            $where .= ' AND level IN {levels:Array(String)}';
        }

        // LIKE (not ILIKE) so the tokenbf index on message can skip granules.
        if ($request->filled('search')) {
            $bindings['search'] = '%'.addcslashes($request->string('search')->toString(), '%_\\').'%';
            $where .= ' AND message LIKE {search:String}';
        }

        $rows = $this->select(
            "SELECT timestamp, trace_id, execution_source, execution_id, execution_preview, user, level, message, context, extra
             FROM logs WHERE {$where} ORDER BY timestamp DESC LIMIT ".(self::PER_PAGE + 1),
            $bindings,
        );

        $logs = $this->cursorPaginator($request, $rows, self::PER_PAGE);
        $logs['data'] = $this->withExecutionUrls($environment, $logs['data']);

        // Scrolling up loads older pages as plain JSON.
        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json($logs);
        }

        return Inertia::render('Logs/Index', [
            ...$period->toProps(),
            'activeUserFilter' => $request->query('user'),
            'search' => $request->query('search'),
            'levels' => $levels,
            'now' => now('UTC')->toIso8601ZuluString('microsecond'),
            'logs' => $logs,
        ]);
    }
}
