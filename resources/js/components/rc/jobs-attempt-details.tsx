// Attempt switcher for Jobs/Attempt.
import { StatusText } from '@/components/rc/badges';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';

export interface AttemptLink {
    attempt: number;
    attempt_id: string;
    status: string;
}

/** "Attempt 2 of 3" dropdown listing every attempt of the same job. */
export function AttemptSwitcher({
    attempts,
    current,
    total,
    href,
}: {
    attempts: AttemptLink[];
    current: AttemptLink;
    total: number;
    href: (attempt: AttemptLink) => string;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-xs hover:bg-zinc-50">
                Attempt {formatNumber(current.attempt)} <span className="text-zinc-500">of</span> {formatNumber(total)}
                <ChevronDown className="size-3.5 text-zinc-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto p-1">
                {attempts.map((attempt) => (
                    <DropdownMenuItem
                        key={attempt.attempt_id}
                        onSelect={() => router.visit(href(attempt))}
                        className={cn('flex items-center justify-between', attempt.attempt_id === current.attempt_id && 'bg-zinc-100')}
                    >
                        <span className="flex items-center gap-2">
                            <span
                                className={cn(
                                    'size-2 rounded-full border border-zinc-400',
                                    attempt.attempt_id === current.attempt_id && 'border-zinc-900 bg-zinc-900',
                                )}
                            />
                            Attempt {formatNumber(attempt.attempt)}
                        </span>
                        <StatusText status={attempt.status} />
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
