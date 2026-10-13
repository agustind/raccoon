<?php

namespace App\Support;

class Permissions
{
    private const MEMBER = [
        'organization.show', 'application.show', 'environment.show', 'threshold.show',
        'issue.edit',
    ];

    private const ADMIN = [
        'organization.edit', 'organization_invite.create', 'organization_invite.edit', 'organization_invite.delete',
        'membership.edit', 'membership.delete',
        'application.create', 'application.edit', 'application.delete',
        'environment.create', 'environment.edit', 'environment.delete',
        'threshold.create', 'threshold.edit', 'threshold.delete',
    ];

    private const OWNER = ['organization.delete'];

    /**
     * @return list<string>
     */
    public static function forRole(?string $role): array
    {
        return match ($role) {
            'owner' => [...self::MEMBER, ...self::ADMIN, ...self::OWNER],
            'admin' => [...self::MEMBER, ...self::ADMIN],
            'member' => self::MEMBER,
            default => [],
        };
    }

    public static function allows(?string $role, string $permission): bool
    {
        return in_array($permission, self::forRole($role), true);
    }
}
