import { envUrl, withPeriod } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { AppUser } from '@/types/raccoon';
import { OctagonAlert } from 'lucide-react';
import LinkCard from './LinkCard';

export interface UserCount extends AppUser {
    count: number;
}

/** A user row with a request count, or a red exception count when countType is "warning". */
export default function UserCard({
    environmentId,
    user,
    countType = 'neutral',
}: {
    environmentId: string;
    user: UserCount;
    countType?: 'neutral' | 'warning';
}) {
    const [primary, secondary] =
        user.name && user.username
            ? [user.name, user.username]
            : user.username || user.name
              ? [user.username ?? user.name, user.id]
              : [user.id, null];

    return (
        <LinkCard
            href={withPeriod(envUrl(environmentId, `users/${user.id}`))}
            stats={
                <div
                    className={cn(
                        'flex h-5 shrink-0 items-center gap-1.5 px-2 text-sm',
                        countType === 'warning' ? 'rounded-full bg-rose-500 text-white' : 'rounded-xl bg-zinc-200/75',
                    )}
                >
                    {countType === 'warning' && <OctagonAlert className="size-3" />}
                    <span className="font-mono text-[11px]">{user.count.toLocaleString()}</span>
                </div>
            }
        >
            <span className="leading-5 font-medium break-all">{primary}</span>
            {secondary && (
                <span className="truncate text-xs leading-4 text-zinc-500" title={secondary}>
                    {secondary}
                </span>
            )}
        </LinkCard>
    );
}
