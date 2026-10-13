<?php

namespace App\Queries;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * The time window a dashboard page shows, and how it buckets charts.
 *
 * Charts keep roughly 60-100 buckets: 1h uses 1 minute,
 * 24h 15 minutes, 7d 2 hours, 14d 4 hours, 30d 8 hours.
 */
class Period
{
    public const PRESETS = [
        '1h' => ['label' => '1 hour', 'seconds' => 3600, 'bucket' => 60],
        '24h' => ['label' => '24 hours', 'seconds' => 86400, 'bucket' => 900],
        '7d' => ['label' => '7 days', 'seconds' => 604800, 'bucket' => 7200],
        '14d' => ['label' => '14 days', 'seconds' => 1209600, 'bucket' => 14400],
        '30d' => ['label' => '30 days', 'seconds' => 2592000, 'bucket' => 28800],
    ];

    public function __construct(
        public readonly string $key,
        public readonly CarbonImmutable $from,
        public readonly CarbonImmutable $to,
        public readonly int $bucketSeconds,
    ) {
        //
    }

    public static function fromRequest(Request $request, string $default = '24h'): self
    {
        if ($request->filled(['from', 'to'])) {
            $from = CarbonImmutable::parse($request->string('from'))->utc();
            $to = CarbonImmutable::parse($request->string('to'))->utc();

            if ($to->lte($from)) {
                [$from, $to] = [$to, $from];
            }

            return new self('custom', $from, $to, self::bucketFor($to->getTimestamp() - $from->getTimestamp()));
        }

        $key = $request->string('period', $default)->toString();
        $preset = self::PRESETS[$key] ?? self::PRESETS[$default];
        $to = CarbonImmutable::now('UTC')->startOfSecond();

        return new self(array_key_exists($key, self::PRESETS) ? $key : $default, $to->subSeconds($preset['seconds']), $to, $preset['bucket']);
    }

    /**
     * A preset period ending now: '1h', '24h', '7d', '14d' or '30d'.
     */
    public static function preset(string $key): self
    {
        $key = array_key_exists($key, self::PRESETS) ? $key : '24h';
        $preset = self::PRESETS[$key];
        $to = CarbonImmutable::now('UTC')->startOfSecond();

        return new self($key, $to->subSeconds($preset['seconds']), $to, $preset['bucket']);
    }

    public static function bucketFor(int $seconds): int
    {
        foreach ([60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400] as $bucket) {
            if ($seconds / $bucket <= 100) {
                return $bucket;
            }
        }

        return 86400;
    }

    public function label(): string
    {
        return self::PRESETS[$this->key]['label'] ?? $this->from->diffForHumans($this->to, true);
    }

    public function fromString(): string
    {
        return $this->from->format('Y-m-d H:i:s.u');
    }

    public function toString(): string
    {
        return $this->to->format('Y-m-d H:i:s.u');
    }

    /**
     * ClickHouse bindings shared by every period-scoped query.
     *
     * @return array{from: string, to: string, bucket: int}
     */
    public function bindings(): array
    {
        return ['from' => $this->fromString(), 'to' => $this->toString(), 'bucket' => $this->bucketSeconds];
    }

    /**
     * Bucket start times from `from` to `to`, aligned to the bucket size.
     *
     * @return list<string>
     */
    public function buckets(): array
    {
        $start = intdiv($this->from->getTimestamp(), $this->bucketSeconds) * $this->bucketSeconds;
        $buckets = [];

        for ($t = $start; $t <= $this->to->getTimestamp(); $t += $this->bucketSeconds) {
            $buckets[] = gmdate('Y-m-d H:i:s', $t);
        }

        return $buckets;
    }

    /**
     * @return array{period: string, from: string, to: string}
     */
    public function toProps(): array
    {
        return [
            'period' => $this->key,
            'from' => $this->from->toIso8601ZuluString('microsecond'),
            'to' => $this->to->toIso8601ZuluString('microsecond'),
        ];
    }
}
