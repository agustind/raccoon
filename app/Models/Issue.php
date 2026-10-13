<?php

namespace App\Models;

use App\Events\IssueAssigned;
use App\Events\IssueStatusUpdated;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Issue extends Model
{
    public const STATUSES = ['open', 'resolved', 'ignored'];

    /** 0 none, 1 low, 2 medium, 3 high (the agent's dashboard scale). */
    public const PRIORITIES = [0, 1, 2, 3];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'resolved_at' => 'datetime',
            'priority' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'ref';
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function environments(): BelongsToMany
    {
        return $this->belongsToMany(Environment::class, 'issue_environment')->withPivot(['first_seen_at', 'last_seen_at', 'occurrences']);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(IssueActivity::class)->latest();
    }

    public function subscribers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'issue_subscriptions')->withTimestamps();
    }

    public function resolveOnDeployEnvironment(): BelongsTo
    {
        return $this->belongsTo(Environment::class, 'resolve_on_deploy_environment_id');
    }

    /**
     * Activity types are the activity log events (status_updated,
     * priority_updated, assignee_updated, comment_added...). The ingest side
     * also writes `created` and `reopened`.
     *
     * @param  array<string, mixed>  $data
     */
    public function log(string $type, ?User $user, array $data = []): IssueActivity
    {
        return $this->activities()->create(['type' => $type, 'user_id' => $user?->id, 'data' => $data ?: null]);
    }

    /**
     * Move to open, resolved or ignored. Any pending resolve-on-deploy mark is
     * dropped; picking "open" on a marked open issue just removes the mark.
     */
    public function updateStatus(string $status, Environment $environment, ?User $user, ?string $comment = null): void
    {
        $from = $this->status;
        $wasMarked = $this->resolve_on_deploy_environment_id !== null;

        if ($from === $status && ! $wasMarked) {
            if ($comment) {
                $this->log('comment_added', $user, ['comment' => $comment]);
            }

            return;
        }

        $this->update([
            'status' => $status,
            'resolved_at' => $status === 'resolved' ? now() : null,
            'resolve_on_deploy_environment_id' => null,
        ]);

        if ($from === $status) {
            $this->log('marked_for_resolve_on_deploy', $user, ['marked' => false]);

            if ($comment) {
                $this->log('comment_added', $user, ['comment' => $comment]);
            }

            return;
        }

        $comment
            ? $this->log('status_updated_with_comment', $user, ['comment' => $comment, 'new_status' => $status, 'previous_status' => $from])
            : $this->log('status_updated', $user, ['new_status' => $status, 'previous_status' => $from]);

        event(new IssueStatusUpdated($this, $environment, $from, $status));
    }

    /**
     * Keep the issue open until the next deployment recorded in $target, then
     * resolve it (see resolveDeployed()).
     */
    public function markResolveOnDeploy(Environment $target, Environment $environment, ?User $user, ?string $comment = null): void
    {
        $from = $this->status;
        $latest = Deployment::where('environment_id', $target->id)->latest('deployed_at')->first();

        if ($comment) {
            $this->log('comment_added', $user, ['comment' => $comment]);
        }

        $this->update(['status' => 'open', 'resolved_at' => null, 'resolve_on_deploy_environment_id' => $target->id]);
        $this->log('marked_for_resolve_on_deploy', $user, [
            'marked' => true,
            'environment_id' => $target->id,
            'environment_name' => $target->name,
            'deploy_ref' => $latest ? self::deployRef($latest) : null,
        ]);

        if ($from !== 'open') {
            event(new IssueStatusUpdated($this, $environment, $from, 'open'));
        }
    }

    public function resolveOnDeploy(Deployment $deployment): void
    {
        $from = $this->status;

        $this->update(['status' => 'resolved', 'resolved_at' => now(), 'resolve_on_deploy_environment_id' => null]);
        $this->log('resolved_on_deploy', null, ['deploy' => $deployment->deploy, 'deploy_ref' => self::deployRef($deployment)]);

        if ($from !== 'resolved') {
            event(new IssueStatusUpdated($this, $deployment->environment, $from, 'resolved'));
        }
    }

    /**
     * Resolve the application's issues marked "resolve on next deploy" whose
     * environment recorded a deployment after the mark. Runs on ingest and when
     * issue pages load, so it does not depend on a deployment hook.
     */
    public static function resolveDeployed(string $applicationId): void
    {
        static::where('application_id', $applicationId)
            ->whereNotNull('resolve_on_deploy_environment_id')
            ->get()
            ->each(function (Issue $issue) {
                $markedAt = $issue->activities()->where('type', 'marked_for_resolve_on_deploy')->reorder('id', 'desc')->value('created_at')
                    ?? $issue->updated_at;

                $deployment = Deployment::where('environment_id', $issue->resolve_on_deploy_environment_id)
                    ->where('created_at', '>', $markedAt)
                    ->oldest('created_at')
                    ->first();

                if ($deployment) {
                    $issue->resolveOnDeploy($deployment);
                }
            });
    }

    public function setPriority(int $priority, ?User $user): void
    {
        if ($priority === $this->priority) {
            return;
        }

        $previous = $this->priority;
        $this->update(['priority' => $priority]);
        $this->log('priority_updated', $user, ['new_priority' => $priority, 'previous_priority' => $previous]);
    }

    public function assign(?User $assignee, Environment $environment, ?User $user): void
    {
        if ($assignee?->id === $this->assignee_id) {
            return;
        }

        $previous = $this->assignee_id;
        $this->update(['assignee_id' => $assignee?->id]);
        $this->setRelation('assignee', $assignee);
        $this->log('assignee_updated', $user, [
            'new_assignee' => $assignee ? ['id' => $assignee->id, 'name' => $assignee->name] : null,
            'previous_assignee_id' => $previous,
        ]);

        event(new IssueAssigned($this, $environment, $assignee));
    }

    private static function deployRef(Deployment $deployment): string
    {
        return $deployment->ref ? substr($deployment->ref, 0, 7) : $deployment->deploy;
    }
}
