<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Environment extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected $hidden = ['token', 'token_hash'];

    protected function casts(): array
    {
        return [
            'token' => 'encrypted',
            'last_ingested_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // Agent auth looks environments up by token_hash, so keep it in sync
        // with the token however the token was assigned.
        static::saving(function (Environment $environment) {
            if (! $environment->token) {
                $environment->setToken(static::generateToken());
            } elseif ($environment->isDirty('token') || ! $environment->token_hash) {
                $environment->token_hash = hash('sha256', $environment->token);
            }
        });
    }

    public static function generateToken(): string
    {
        return Str::random(64);
    }

    public function setToken(string $token): void
    {
        $this->token = $token;
        $this->token_hash = hash('sha256', $token);
    }

    public static function findByToken(string $token): ?self
    {
        return static::where('token_hash', hash('sha256', $token))->first();
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    public function deployments(): HasMany
    {
        return $this->hasMany(Deployment::class);
    }
}
