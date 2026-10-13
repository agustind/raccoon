<?php

namespace App\Events;

use App\Models\Environment;
use App\Models\Issue;
use App\Models\User;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Someone changed an issue's assignee. $assignee is null when it was unassigned.
 */
class IssueAssigned
{
    use Dispatchable;

    public function __construct(public Issue $issue, public Environment $environment, public ?User $assignee)
    {
        //
    }
}
