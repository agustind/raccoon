<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Deployment extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['deployed_at' => 'datetime'];
    }

    public function environment(): BelongsTo
    {
        return $this->belongsTo(Environment::class);
    }
}
