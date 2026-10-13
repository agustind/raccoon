<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Application extends Model
{
    use HasUuids;

    protected $guarded = [];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function environments(): HasMany
    {
        return $this->hasMany(Environment::class);
    }

    public function issues(): HasMany
    {
        return $this->hasMany(Issue::class);
    }

    public function thresholds(): HasMany
    {
        return $this->hasMany(Threshold::class);
    }

    public function webhooks(): HasMany
    {
        return $this->hasMany(Webhook::class);
    }

    /**
     * Reserve the next per-application issue number atomically.
     */
    public function reserveIssueRef(): int
    {
        return (int) DB::selectOne(
            'UPDATE applications SET next_issue_ref = next_issue_ref + 1 WHERE id = ? RETURNING next_issue_ref - 1 AS ref',
            [$this->id],
        )->ref;
    }
}
