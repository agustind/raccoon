import { Calendar } from '@/components/rc/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { currentQuery, visitWithQuery } from '@/lib/rc';
import { cn } from '@/lib/utils';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { FormEvent, KeyboardEvent, useState } from 'react';

const PERIODS = ['1h', '24h', '7d', '14d', '30d'];

type Zone = 'utc' | 'local';

/** Splits an instant into the 'YYYY-MM-DD' day and 'HH:MM' time shown in the zone. */
function parts(date: Date, zone: Zone): { day: string; time: string } {
    if (zone === 'utc') {
        const iso = date.toISOString();

        return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
    }

    const pad = (n: number) => String(n).padStart(2, '0');

    return {
        day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    };
}

function instant(day: string, time: string, zone: Zone): Date {
    return new Date(`${day}T${time}:00${zone === 'utc' ? 'Z' : ''}`);
}

/** 1H / 24H / 7D / 14D / 30D buttons plus a custom range, bound to ?period= or ?from=&to=. */
export default function PeriodPicker({ period, periods = PERIODS }: { period: string; periods?: string[] }) {
    const query = currentQuery();
    const [zone, setZone] = useState<Zone>('utc');
    const [from, setFrom] = useState<Date | null>(query.from ? new Date(query.from) : null);
    const [to, setTo] = useState<Date | null>(query.to ? new Date(query.to) : null);

    const applyRange = (event: FormEvent) => {
        event.preventDefault();

        if (from && to) {
            visitWithQuery({ period: null, from: from.toISOString(), to: to.toISOString() }, { preserveScroll: false });
        }
    };

    // Typing in the time inputs must not trigger the menu's type-to-select.
    const keepKeys = (event: KeyboardEvent) => event.key !== 'Escape' && event.stopPropagation();

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
                    aria-label="Custom range"
                    className={cn(
                        'flex h-full items-center gap-1 rounded-md px-2 text-zinc-500 hover:text-zinc-900',
                        period === 'custom' && 'bg-blue-600 text-white',
                    )}
                >
                    <CalendarDays className="size-3.5" />
                    <ChevronDown className="size-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-3">
                    <form onSubmit={applyRange} onKeyDown={keepKeys} className="space-y-4 text-sm">
                        <div className="grid grid-cols-2 rounded-lg bg-zinc-100 p-0.5">
                            {(['utc', 'local'] as const).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setZone(key)}
                                    className={cn(
                                        'h-8 rounded-md font-mono text-xs text-zinc-500 uppercase hover:text-zinc-900',
                                        zone === key && 'bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-200',
                                    )}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>
                        <DateTimeField label="Starting date" value={from} zone={zone} defaultTime="00:00" onChange={setFrom} />
                        <DateTimeField label="Ending date" value={to} zone={zone} defaultTime="23:59" onChange={setTo} />
                        <button
                            type="submit"
                            disabled={!from || !to}
                            className="w-full rounded-md bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-40"
                        >
                            Apply
                        </button>
                    </form>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/** A date button that opens a calendar, and a time input, both in the chosen zone. */
function DateTimeField({
    label,
    value,
    zone,
    defaultTime,
    onChange,
}: {
    label: string;
    value: Date | null;
    zone: Zone;
    defaultTime: string;
    onChange: (date: Date) => void;
}) {
    const [open, setOpen] = useState(false);
    const current = value ? parts(value, zone) : null;
    const today = parts(new Date(), zone).day;
    const dayLabel = current
        ? new Date(`${current.day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        : 'Pick a day';

    return (
        <div>
            <div className="mb-1.5 text-zinc-600">{label}</div>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className={cn(
                        'flex h-9 flex-1 items-center justify-between rounded-md border border-zinc-200 px-2.5 text-left',
                        current ? 'text-zinc-900' : 'text-zinc-500',
                        open && 'border-blue-600',
                    )}
                >
                    {dayLabel}
                    <CalendarDays className="size-3.5 text-zinc-500" />
                </button>
                <input
                    type="time"
                    aria-label={`${label} time`}
                    value={current?.time ?? ''}
                    onChange={(e) => e.target.value && onChange(instant(current?.day ?? today, e.target.value, zone))}
                    className="h-9 w-28 rounded-md border border-zinc-200 px-2 text-zinc-900"
                />
            </div>
            {open && (
                <div className="mt-2 rounded-lg border border-zinc-200 p-2">
                    <Calendar
                        value={current?.day ?? null}
                        today={today}
                        onSelect={(day) => {
                            onChange(instant(day, current?.time ?? defaultTime, zone));
                            setOpen(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
