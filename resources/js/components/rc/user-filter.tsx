import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { visitWithQuery } from '@/lib/rc';
import { ChevronDown, User, X } from 'lucide-react';
import { FormEvent, useState } from 'react';

/** "All Users" dropdown bound to ?user=<application user id>. */
export default function UserFilter({ active }: { active: string | null | undefined }) {
    const [value, setValue] = useState(active ?? '');

    const apply = (event: FormEvent) => {
        event.preventDefault();
        visitWithQuery({ user: value || null }, { preserveScroll: false });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-xs hover:bg-zinc-50">
                <User className="size-4 text-zinc-500" />
                <span className="max-w-40 truncate">{active ? `User ${active}` : 'All Users'}</span>
                <ChevronDown className="size-3.5 text-zinc-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
                <form onSubmit={apply} className="space-y-2">
                    <input
                        autoFocus
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Filter by user ID"
                        className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm"
                    />
                </form>
                {active && (
                    <DropdownMenuItem onSelect={() => visitWithQuery({ user: null }, { preserveScroll: false })}>
                        <X className="size-4" /> Clear filter
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
