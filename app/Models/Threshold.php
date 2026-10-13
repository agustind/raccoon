<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Threshold extends Model
{
    protected $guarded = [];

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }
}
