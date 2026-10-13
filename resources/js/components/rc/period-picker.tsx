import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { currentQuery, visitWithQuery } from '@/lib/rc';
import { cn } from '@/lib/utils';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { FormEvent, useState } from 'react';

const PERIODS = ['1h', '24h', '7d', '14d', '30d'];

/** 1H / 24H / 7D / 14D / 30D buttons plus a custom range, bound to ?period= or ?from=&to=. */
export default function PeriodPicker({ period, periods = PERIODS }: { period: string; periods?: string[] }) {
    const query = currentQuery();
    const [from, setFrom] = useState(query.from ? query.from.slice(0, 16) : '');
    const [to, setTo] = useState(query.to ? query.to.slice(0, 16) : '');

    const applyRange = (event: FormEvent) => {
        event.preventDefault();

        if (from && to) {
            visitWithQuery(
                { period: null, from: new Date(from + 'Z').toISOString(), to: new Date(to + 'Z').toISOString() },
                { preserveScroll: false },
            );
        }
    };

    return (
        <div className="flex h-9 items-center rounded-lg border border-zinc-200 bg-white p-0.5 shadow-xs">
            {periods.map((key) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => visitWithQuery({ period: key, from: null, to: null }, { preserveScroll: false })}
                    className={cn(
                        'h-full rounded-md px-2.5 font-mono text-xs text-zinc-600 uppercase hover:text-zinc-900',
                        period === key && 'bg-blue-600 text-white hover:text-white',
                    )}
                >
                    {key}
                </button>
            ))}
            <DropdownMenu>
                <DropdownMenuTrigger
                    className={cn(
                        'flex h-full items-center gap-1 rounded-md px-2 text-zinc-500 hover:text-zinc-900',
                        period === 'custom' && 'bg-blue-600 text-white',
                    )}
                >
                    <CalendarDays className="size-3.5" />
                    <ChevronDown className="size-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-3">
                    <form onSubmit={applyRange} className="space-y-3 text-sm">
                        <label className="block">
                            <span className="mb-1 block font-mono text-xs text-zinc-500 uppercase">From (UTC)</span>
                            <input
                                type="datetime-local"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className="w-full rounded-md border border-zinc-200 px-2 py-1.5"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block font-mono text-xs text-zinc-500 uppercase">To (UTC)</span>
                            <input
                                type="datetime-local"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="w-full rounded-md border border-zinc-200 px-2 py-1.5"
                            />
                        </label>
                        <button type="submit" className="w-full rounded-md bg-zinc-900 px-3 py-1.5 text-white">
                            Apply
                        </button>
                    </form>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
