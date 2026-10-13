<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'issue_created' => 'boolean',
            'issue_reopened' => 'boolean',
            'issue_assigned' => 'boolean',
            'threshold_exceeded' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function environment(): BelongsTo
    {
        return $this->belongsTo(Environment::class);
    }
}
