import { cn } from '@/lib/utils';
import type { CursorPaginator, Paginator } from '@/types/raccoon';
import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Numbered pagination for length-aware paginators. */
export function Pagination({ paginator }: { paginator: Paginator<unknown> }) {
    if (paginator.last_page <= 1) return null;

    return (
        <div className="mt-4 flex items-center justify-between font-mono text-xs text-zinc-500">
            <span>
                {paginator.from}-{paginator.to} of {paginator.total}
            </span>
            <div className="flex items-center gap-1">
                {paginator.links.map((link, index) => {
                    const label = link.label.includes('Previous') ? <ChevronLeft className="size-3.5" /> : link.label.includes('Next') ? <ChevronRight className="size-3.5" /> : link.label;

                    return link.url ? (
                        <Link
                            key={index}
                            href={link.url}
                            preserveScroll
                            preserveState
                            className={cn('flex h-7 min-w-7 items-center justify-center rounded-md border border-zinc-200 bg-white px-2 hover:bg-zinc-50', link.active && 'border-blue-600 bg-blue-600 text-white hover:bg-blue-600')}
                        >
                            {label}
                        </Link>
                    ) : (
                        <span key={index} className="flex h-7 min-w-7 items-center justify-center px-2 text-zinc-300">
                            {label}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

/** Previous/next pagination for cursor paginators (event lists). */
export function CursorPagination({ paginator }: { paginator: CursorPaginator<unknown> }) {
    if (!paginator.next_page_url && !paginator.prev_page_url) return null;

    const first = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('cursor');

    return (
        <div className="mt-4 flex justify-end gap-2 font-mono text-xs">
            {first && (
                <button type="button" onClick={() => window.history.back()} className="flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 hover:bg-zinc-50">
                    <ChevronLeft className="size-3.5" /> Newer
                </button>
            )}
            {paginator.next_page_url && (
                <Link href={paginator.next_page_url} preserveScroll preserveState className="flex h-8 items-center gap-1 rounded-md border border-zinc-200 bg-white px-3 hover:bg-zinc-50">
                    Older <ChevronRight className="size-3.5" />
                </Link>
            )}
        </div>
    );
}
