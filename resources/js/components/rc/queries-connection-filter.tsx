import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { visitWithQuery } from '@/lib/rc';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Database, X } from 'lucide-react';

/** "All Connections" dropdown bound to ?connection=. */
export default function ConnectionFilter({ connections, active }: { connections: string[]; active: string | null | undefined }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className={cn(
                    'flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-xs hover:bg-zinc-50',
                    active && 'border-blue-600 bg-blue-600 text-white hover:bg-blue-600/90',
                )}
            >
                <Database className={cn('size-3.5 text-zinc-500', active && 'text-white')} />
                <span className="max-w-32 truncate">{active || 'All Connections'}</span>
                <ChevronDown className={cn('size-3.5 text-zinc-400', active && 'text-white')} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                {active && (
                    <>
                        <DropdownMenuItem onSelect={() => visitWithQuery({ connection: null })} className="text-zinc-500">
                            <X className="size-3.5" /> Clear filter
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
                {connections.length === 0 && <div className="px-2 py-1.5 text-sm text-zinc-500">No connections found</div>}
                {connections.map((connection) => (
                    <DropdownMenuItem key={connection} onSelect={() => visitWithQuery({ connection })} className="justify-between">
                        <span className="truncate">{connection}</span>
                        <Check className={cn('size-4', active === connection ? 'opacity-100' : 'opacity-0')} />
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
