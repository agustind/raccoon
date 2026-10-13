<?php

namespace App\Ingest;

use App\Models\Deployment;
use App\Models\Environment;
use App\Models\Issue;
use Illuminate\Support\Facades\Cache;

class DeploymentRecorder
{
    /**
     * Create a deployment the first time a deploy value shows up in events.
     *
     * @param  array<string, string>  $deploys  deploy => earliest timestamp in the batch
     */
    public function recordSeen(Environment $environment, array $deploys): void
    {
        foreach ($deploys as $deploy => $timestamp) {
            Cache::remember("deployment-seen:{$environment->id}:".md5($deploy), now()->addDay(), function () use ($environment, $deploy, $timestamp) {
                $deployment = Deployment::firstOrCreate(
                    ['environment_id' => $environment->id, 'deploy' => $deploy],
                    ['deployed_at' => $timestamp],
                );

                if ($deployment->wasRecentlyCreated) {
                    Issue::resolveDeployed($environment->application_id);
                }

                return true;
            });
        }
    }

    /**
     * @param  array{deploy: string, timestamp?: string|null, ref?: string|null, name?: string|null, url?: string|null}  $data
     */
    public function recordExplicit(Environment $environment, array $data): Deployment
    {
        $deployment = Deployment::updateOrCreate(
            ['environment_id' => $environment->id, 'deploy' => $data['deploy']],
            [
                'deployed_at' => $data['timestamp'] ?? now(),
                'ref' => $data['ref'] ?? null,
                'name' => $data['name'] ?? null,
                'url' => $data['url'] ?? null,
            ],
        );

        // Issues marked "resolve on next deploy" resolve as soon as the deploy lands.
        if ($deployment->wasRecentlyCreated) {
            Issue::resolveDeployed($environment->application_id);
        }

        return $deployment;
    }
}
