<?php

namespace App\Events;

use App\Models\Environment;
use App\Models\Issue;
use App\Models\Threshold;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A group's p95 went over its threshold and its performance issue was
 * created or reopened. Not fired again while the issue stays open.
 */
class ThresholdExceeded
{
    use Dispatchable;

    /**
     * @param  int  $p95  microseconds, over the evaluation window
     */
    public function __construct(public Issue $issue, public Environment $environment, public Threshold $threshold, public int $p95)
    {
        //
    }
}
