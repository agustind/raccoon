<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Controller;
use App\Ingest\DeploymentRecorder;
use App\Ingest\IngestToken;
use App\Ingest\RecordIngestor;
use App\Models\Environment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Endpoints the stock laravel/nightwatch agent talks to when
 * NIGHTWATCH_BASE_URL points at this app.
 */
class AgentController extends Controller
{
    /**
     * POST /api/agent-auth: exchange the environment token for an ingest token.
     */
    public function authenticate(Request $request): JsonResponse
    {
        $environment = $this->environmentFromBearer($request);

        if (! $environment) {
            return response()->json(['message' => 'Invalid token.', 'stop' => false, 'refresh_in' => 300], 401);
        }

        return response()->json([
            ...IngestToken::issue($environment->id),
            'ingest_url' => url('/api/ingest'),
        ]);
    }

    /**
     * POST /api/ingest: a gzipped {"records": [...]} batch from the agent.
     */
    public function ingest(Request $request, RecordIngestor $ingestor): JsonResponse
    {
        $environmentId = IngestToken::verify((string) $request->bearerToken());
        $environment = $environmentId ? Environment::with('application')->find($environmentId) : null;

        if (! $environment) {
            return response()->json(['message' => 'Invalid or expired ingest token.'], 401);
        }

        $body = $request->getContent();

        if (str_contains(strtolower((string) $request->header('Content-Encoding')), 'gzip') || str_starts_with($body, "\x1f\x8b")) {
            $body = @gzdecode($body);
        }

        if ($body === false) {
            return response()->json(['message' => 'Unable to decompress payload.'], 400);
        }

        try {
            $payload = json_decode($body, true, 512, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
        } catch (Throwable) {
            return response()->json(['message' => 'Invalid JSON payload.'], 400);
        }

        $records = $payload['records'] ?? null;

        if (! is_array($records)) {
            return response()->json(['message' => 'Missing records.'], 422);
        }

        try {
            $counts = $ingestor->ingest($environment, $records);
        } catch (Throwable $e) {
            Log::error('Ingest failed', ['environment' => $environment->id, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Ingest failed, retry later.'], 503);
        }

        if (! $environment->last_ingested_at || $environment->last_ingested_at->lt(now()->subMinute())) {
            $environment->forceFill(['last_ingested_at' => now()])->saveQuietly();
        }

        return response()->json(['message' => 'OK', 'records' => array_sum($counts)]);
    }

    /**
     * POST /api/deployments: sent by `php artisan nightwatch:deploy`.
     */
    public function deployment(Request $request, DeploymentRecorder $deployments): JsonResponse
    {
        $environment = $this->environmentFromBearer($request);

        if (! $environment) {
            return response()->json(['message' => 'Invalid token.'], 401);
        }

        $data = $request->validate([
            'deploy' => ['required', 'string', 'max:255'],
            'timestamp' => ['nullable', 'date'],
            'ref' => ['nullable', 'string', 'max:255'],
            'name' => ['nullable', 'string', 'max:255'],
            'url' => ['nullable', 'string', 'max:2048'],
        ]);

        $deployments->recordExplicit($environment, $data);

        return response()->json(['message' => 'Deployment recorded.']);
    }

    private function environmentFromBearer(Request $request): ?Environment
    {
        $token = $request->bearerToken();

        return $token ? Environment::findByToken($token) : null;
    }
}
