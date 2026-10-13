<?php

namespace App\Events;

use App\Models\Environment;
use App\Models\Issue;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * An issue moved between open, resolved and ignored, by a user or on deploy.
 */
class IssueStatusUpdated
{
    use Dispatchable;

    public function __construct(public Issue $issue, public Environment $environment, public string $from, public string $to)
    {
        //
    }
}
