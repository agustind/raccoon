import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { visitWithQuery } from '@/lib/rc';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export const LOG_LEVELS = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** "LEVEL All" multi-select bound to ?levels=error,warning. */
export default function LevelFilter({ active }: { active: string[] }) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<string[]>(active);

    const toggle = (level: string) => setSelected((current) => (current.includes(level) ? current.filter((l) => l !== level) : [...current, level]));

    const apply = (levels: string[]) => {
        setOpen(false);
        visitWithQuery({ levels: levels.length ? LOG_LEVELS.filter((l) => levels.includes(l)).join(',') : null }, { preserveScroll: false });
    };

    return (
        <DropdownMenu
            open={open}
            onOpenChange={(value) => {
                setOpen(value);
                if (value) setSelected(active);
            }}
        >
            <DropdownMenuTrigger
                className={cn(
                    'flex h-9 items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-xs hover:bg-zinc-50',
                    active.length > 0 && 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700',
                )}
            >
                <span className={cn('font-mono text-[11px] uppercase', active.length > 0 ? 'text-white/80' : 'text-zinc-500')}>Level</span>
                <span className="whitespace-nowrap">{active.length === 0 ? 'All' : active.slice(0, 2).map(capitalize).join(', ')}</span>
                {active.length > 2 && <span className="rounded bg-white/20 px-1 font-mono text-[10px]">+{active.length - 2}</span>}
                <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-2">
                <ul>
                    {LOG_LEVELS.map((level) => (
                        <li key={level}>
                            <button
                                type="button"
                                onClick={() => toggle(level)}
                                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm capitalize hover:bg-zinc-100"
                            >
                                {level}
                                <Check className={cn('size-4', selected.includes(level) ? 'opacity-100' : 'opacity-0')} />
                            </button>
                        </li>
                    ))}
                </ul>
                <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => apply([])}
                        className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50"
                    >
                        Clear
                    </button>
                    <button type="button" onClick={() => apply(selected)} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
                        Apply
                    </button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
