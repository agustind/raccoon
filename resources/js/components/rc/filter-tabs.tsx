import { visitWithQuery } from '@/lib/rc';
import { cn } from '@/lib/utils';

export interface FilterOption {
    value: string | null;
    label: string;
    count?: number | null;
}

/** Segmented control bound to a query param: "View all | 1/2/3xx | 4xx | 5xx". */
export default function FilterTabs({ param, value, options }: { param: string; value: string | null | undefined; options: FilterOption[] }) {
    return (
        <div className="flex h-9 items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-sm">
            {options.map((option) => {
                const active = (value ?? null) === option.value;

                return (
                    <button
                        key={option.label}
                        type="button"
                        onClick={() => visitWithQuery({ [param]: option.value })}
                        className={cn('flex h-full items-center gap-1.5 rounded-md px-2.5 text-zinc-600 hover:text-zinc-900', active && 'bg-white text-zinc-900 shadow-xs')}
                    >
                        {option.label}
                        {option.count !== undefined && option.count !== null && option.count > 0 && (
                            <span className="rounded bg-zinc-200/70 px-1 font-mono text-[10px] text-zinc-600">{option.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
