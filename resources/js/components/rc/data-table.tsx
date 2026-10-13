import { visitWithQuery } from '@/lib/rc';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowUpRight, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { ReactNode } from 'react';

export interface Column<T> {
    key: string;
    label: ReactNode;
    /** CSS grid track, e.g. '110px' or 'minmax(0,1fr)'. Defaults to 'minmax(0,1fr)'. */
    width?: string;
    align?: 'left' | 'right' | 'center';
    /** Column can be sorted server side via ?sortBy=<key>. */
    sortable?: boolean;
    render: (row: T) => ReactNode;
    className?: string;
}

interface Props<T> {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T, index: number) => string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc' | string;
    /** Clicking the row (or its arrow button) goes here. */
    rowHref?: (row: T) => string | null;
    /** Extra buttons rendered before the arrow, e.g. a drawer toggle. */
    rowActions?: (row: T) => ReactNode;
    empty?: ReactNode;
}

/**
 * Card-style table: a header card followed by one card per row.
 * Sorting updates ?sortBy= and ?sortDirection=.
 */
export default function DataTable<T>({ columns, rows, rowKey, sortBy, sortDirection, rowHref, rowActions, empty }: Props<T>) {
    const hasActions = Boolean(rowHref || rowActions);
    // Header and each row are separate grids, so the actions track needs a
    // fixed width or the columns drift out of alignment.
    const actionsWidth = rowActions && rowHref ? '64px' : '28px';
    const template = [...columns.map((c) => c.width ?? 'minmax(0,1fr)'), hasActions ? actionsWidth : null].filter(Boolean).join(' ');

    const toggleSort = (key: string) => {
        const direction = sortBy === key && sortDirection === 'asc' ? 'desc' : sortBy === key ? 'asc' : 'desc';
        visitWithQuery({ sortBy: key, sortDirection: direction });
    };

    return (
        <div className="space-y-1.5">
            <div
                className="grid items-center gap-4 rounded-lg border border-zinc-200 bg-white px-5 py-3 shadow-xs"
                style={{ gridTemplateColumns: template }}
            >
                {columns.map((column) => (
                    <div
                        key={column.key}
                        className={cn('flex items-center gap-1 font-mono text-xs tracking-wide text-zinc-500 uppercase', alignClass(column.align))}
                    >
                        {column.sortable ? (
                            <button
                                type="button"
                                onClick={() => toggleSort(column.key)}
                                className="flex items-center gap-1 uppercase hover:text-zinc-900"
                            >
                                {column.label}
                                {sortBy === column.key ? (
                                    sortDirection === 'asc' ? (
                                        <ChevronUp className="size-3 text-blue-600" />
                                    ) : (
                                        <ChevronDown className="size-3 text-blue-600" />
                                    )
                                ) : (
                                    <ChevronsUpDown className="size-3 text-zinc-300" />
                                )}
                            </button>
                        ) : (
                            column.label
                        )}
                    </div>
                ))}
                {hasActions && <div />}
            </div>

            {rows.length === 0 && (
                <div className="rounded-lg border border-zinc-200 bg-white px-5 py-10 text-center text-sm text-zinc-500">
                    {empty ?? 'No results for this period.'}
                </div>
            )}

            {rows.map((row, index) => {
                const href = rowHref?.(row) ?? null;

                return (
                    <div
                        key={rowKey(row, index)}
                        className={cn(
                            'group relative grid items-center gap-4 rounded-lg border border-zinc-200 bg-white px-5 py-3 text-sm shadow-xs',
                            href && 'hover:border-zinc-300',
                        )}
                        style={{ gridTemplateColumns: template }}
                    >
                        {href && <Link href={href} className="absolute inset-0 rounded-lg" aria-label="Open" />}
                        {columns.map((column) => (
                            <div key={column.key} className={cn('min-w-0 font-mono text-[13px]', alignClass(column.align), column.className)}>
                                {column.render(row)}
                            </div>
                        ))}
                        {hasActions && (
                            <div className="relative z-10 flex items-center justify-end gap-1">
                                {rowActions?.(row)}
                                {href && (
                                    <Link
                                        href={href}
                                        className="flex size-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                                    >
                                        <ArrowUpRight className="size-3.5" />
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function alignClass(align?: 'left' | 'right' | 'center'): string {
    return align === 'right' ? 'justify-end text-right' : align === 'center' ? 'justify-center text-center' : '';
}

/** Small square icon button for row actions. */
export function RowButton({ onClick, children, title }: { onClick: () => void; children: ReactNode; title?: string }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className="flex size-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
        >
            {children}
        </button>
    );
}
