import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Days are 'YYYY-MM-DD' strings so the caller decides the time zone. */
export function Calendar({ value, today, onSelect }: { value: string | null; today: string; onSelect: (day: string) => void }) {
    const [month, setMonth] = useState(() => (value ?? today).slice(0, 7));
    const [year, monthIndex] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, monthIndex - 1, 1));
    const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
    const days = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
    const weeks = days.slice(35).every((day) => !day.startsWith(month)) ? days.slice(0, 35) : days;

    const shift = (delta: number) => setMonth(new Date(Date.UTC(year, monthIndex - 1 + delta, 1)).toISOString().slice(0, 7));

    return (
        <div className="select-none">
            <div className="mb-2 flex items-center justify-between">
                <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => shift(-1)}
                    className="flex size-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:text-zinc-900"
                >
                    <ChevronLeft className="size-3.5" />
                </button>
                <span className="text-sm text-zinc-900">
                    {first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                </span>
                <button
                    type="button"
                    aria-label="Next month"
                    disabled={month >= today.slice(0, 7)}
                    onClick={() => shift(1)}
                    className="flex size-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 hover:text-zinc-900 disabled:opacity-40"
                >
                    <ChevronRight className="size-3.5" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                {WEEKDAYS.map((day) => (
                    <div key={day} className="py-1 text-zinc-500">
                        {day}
                    </div>
                ))}
                {weeks.map((day) => (
                    <button
                        key={day}
                        type="button"
                        disabled={day > today}
                        onClick={() => onSelect(day)}
                        className={cn(
                            'h-8 rounded-md text-zinc-900 hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent',
                            !day.startsWith(month) && 'text-zinc-400',
                            day === today && 'bg-zinc-100',
                            day === value && 'bg-blue-600 text-white hover:bg-blue-600',
                        )}
                    >
                        {Number(day.slice(8))}
                    </button>
                ))}
            </div>
        </div>
    );
}
