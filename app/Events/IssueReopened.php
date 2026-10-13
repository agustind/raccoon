<?php

namespace App\Events;

use App\Models\Environment;
use App\Models\Issue;
use Illuminate\Foundation\Events\Dispatchable;

class IssueReopened
{
    use Dispatchable;

    public function __construct(public Issue $issue, public Environment $environment)
    {
        //
    }
}
