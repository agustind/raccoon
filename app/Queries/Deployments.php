<?php

namespace App\Queries;

use App\Models\Deployment;
use App\Models\Environment;

class Deployments
{
    /**
     * Deployments grouped into the period's chart buckets, the shape every
     * chart uses to draw deploy markers.
     *
     * @return list<array{bucket: string, deployments: list<array<string, mixed>>}>
     */
    public static function forPeriod(Environment $environment, Period $period): array
    {
        $byBucket = [];

        Deployment::where('environment_id', $environment->id)
            ->whereBetween('deployed_at', [$period->from, $period->to])
            ->orderBy('deployed_at')
            ->get()
            ->each(function (Deployment $deployment) use (&$byBucket, $period) {
                $ts = $deployment->deployed_at->getTimestamp();
                $bucket = gmdate('Y-m-d H:i:s', intdiv($ts, $period->bucketSeconds) * $period->bucketSeconds);
                $byBucket[$bucket][] = self::present($deployment);
            });

        return array_map(
            fn (string $bucket) => ['bucket' => $bucket, 'deployments' => $byBucket[$bucket] ?? []],
            $period->buckets(),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public static function present(?Deployment $deployment): ?array
    {
        if (! $deployment) {
            return null;
        }

        return [
            'deploy' => $deployment->deploy,
            'ref' => $deployment->ref,
            'name' => $deployment->name,
            'url' => $deployment->url,
            'timestamp' => $deployment->deployed_at->format('Y-m-d H:i:s.u'),
        ];
    }
}
