import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface Member {
    id: number;
    name: string;
    avatar_url: string | null;
}

export const PRIORITIES = [
    { value: 0, label: 'No priority' },
    { value: 1, label: 'Low' },
    { value: 2, label: 'Medium' },
    { value: 3, label: 'High' },
];

/** Three signal bars; as many are filled as the priority (0-3). */
export function PrioritySymbol({ priority, className }: { priority: number; className?: string }) {
    const color = priority === 3 ? 'fill-orange-500' : 'fill-zinc-700';

    return (
        <svg viewBox="0 0 13 12" className={cn('size-3.5 shrink-0', className)} aria-label={PRIORITIES[priority]?.label}>
            <rect x="0" y="6" width="3" height="6" rx="1.5" className={priority >= 1 ? color : 'fill-zinc-300'} />
            <rect x="5" y="3" width="3" height="9" rx="1.5" className={priority >= 2 ? color : 'fill-zinc-300'} />
            <rect x="10" y="0" width="3" height="12" rx="1.5" className={priority >= 3 ? color : 'fill-zinc-300'} />
        </svg>
    );
}

export function PriorityPicker({ value, onChange, showLabel = true, className }: { value: number; onChange: (priority: number) => void; showLabel?: boolean; className?: string }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className={cn('flex items-center gap-2 text-sm', className)} title={PRIORITIES[value]?.label}>
                <PrioritySymbol priority={value} />
                {showLabel && <span>{PRIORITIES[value]?.label}</span>}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
                {PRIORITIES.map((priority) => (
                    <DropdownMenuItem key={priority.value} onSelect={() => onChange(priority.value)} className="justify-between">
                        <span className="flex items-center gap-2">
                            <PrioritySymbol priority={priority.value} />
                            {priority.label}
                        </span>
                        <Check className={cn('size-4', priority.value === value ? 'opacity-100' : 'opacity-0')} />
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function Avatar({ user, className }: { user: { name: string; avatar_url?: string | null } | null; className?: string }) {
    if (!user) {
        return <span className={cn('inline-block size-5 shrink-0 rounded-full border border-dashed border-zinc-400', className)} />;
    }

    if (user.avatar_url) {
        return <img src={user.avatar_url} alt={user.name} className={cn('size-5 shrink-0 rounded-full object-cover', className)} />;
    }

    return (
        <span className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-700 uppercase', className)}>
            {user.name.slice(0, 1)}
        </span>
    );
}

/** Assignee dropdown with search; the current user is listed first. */
export function AssigneePicker({
    value,
    users,
    onChange,
    showName = true,
    className,
}: {
    value: number | null;
    users: Member[];
    onChange: (id: number | null) => void;
    showName?: boolean;
    className?: string;
}) {
    const { auth } = usePage<PageProps>().props;
    const [query, setQuery] = useState('');
    const selected = users.find((user) => user.id === value) ?? null;
    const sorted = useMemo(
        () =>
            [...users]
                .sort((a, b) => (a.id === auth.user?.id ? -1 : b.id === auth.user?.id ? 1 : 0))
                .filter((user) => user.name.toLowerCase().includes(query.toLowerCase())),
        [users, auth.user?.id, query],
    );

    return (
        <DropdownMenu onOpenChange={() => setQuery('')}>
            <DropdownMenuTrigger className={cn('flex min-w-0 items-center gap-2 text-sm', className)} title={selected?.name ?? 'Unassigned'}>
                <Avatar user={selected} />
                {showName && <span className="truncate">{selected?.name ?? 'Unassigned'}</span>}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-1">
                <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Search users..."
                    className="mb-1 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none"
                />
                {'unassigned'.includes(query.toLowerCase()) && (
                    <DropdownMenuItem onSelect={() => onChange(null)} className="justify-between">
                        <span className="flex items-center gap-2">
                            <Avatar user={null} /> Unassigned
                        </span>
                        <Check className={cn('size-4', value === null ? 'opacity-100' : 'opacity-0')} />
                    </DropdownMenuItem>
                )}
                {sorted.map((user) => (
                    <DropdownMenuItem key={user.id} onSelect={() => onChange(user.id)} className="justify-between">
                        <span className="flex min-w-0 items-center gap-2">
                            <Avatar user={user} />
                            <span className="truncate">{user.name}</span>
                        </span>
                        <Check className={cn('size-4', user.id === value ? 'opacity-100' : 'opacity-0')} />
                    </DropdownMenuItem>
                ))}
                {sorted.length === 0 && !'unassigned'.includes(query.toLowerCase()) && <div className="px-2 py-1.5 text-sm text-zinc-500">No users found</div>}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
