<?php

namespace App\Ingest;

/**
 * Short-lived bearer token the agent uses for /api/ingest.
 *
 * Format: base64url("{environment_id}.{expires_at}") . "." . hmac. Verifying it
 * needs no database lookup, so ingest requests stay cheap.
 */
class IngestToken
{
    public const TTL = 3600;

    public const REFRESH_IN = 3000;

    public static function issue(string $environmentId, ?int $now = null): array
    {
        $expiresAt = ($now ?? time()) + self::TTL;
        $payload = self::base64url("{$environmentId}.{$expiresAt}");

        return [
            'token' => $payload.'.'.self::sign($payload),
            'expires_in' => self::TTL,
            'refresh_in' => self::REFRESH_IN,
        ];
    }

    /**
     * @return string|null The environment id, or null when the token is invalid or expired.
     */
    public static function verify(string $token, ?int $now = null): ?string
    {
        $parts = explode('.', $token);

        if (count($parts) !== 2 || ! hash_equals(self::sign($parts[0]), $parts[1])) {
            return null;
        }

        $decoded = base64_decode(strtr($parts[0], '-_', '+/'), true);

        if ($decoded === false || ! str_contains($decoded, '.')) {
            return null;
        }

        [$environmentId, $expiresAt] = explode('.', $decoded, 2);

        return (int) $expiresAt >= ($now ?? time()) ? $environmentId : null;
    }

    private static function sign(string $payload): string
    {
        return self::base64url(hash_hmac('sha256', $payload, config('app.key'), true));
    }

    private static function base64url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
