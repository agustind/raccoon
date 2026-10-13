import { envUrl } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';

/** Columns every event row gets for its parent execution (the backend's ExecutionLinks). */
export interface ExecutionSource {
    trace_id: string;
    execution_source: string;
    execution_id: string;
    execution_preview: string;
    /** Path relative to the environment, null when the execution can't be found. */
    execution_url: string | null;
}

/** "REQUEST  GET /users/2" badge linking to the execution that recorded an event. */
export default function SourceLink({ row, className }: { row: ExecutionSource; className?: string }) {
    const { auth } = usePage<PageProps>().props;
    const content = (
        <>
            <span className="flex h-6 shrink-0 items-center rounded-md border border-zinc-300 bg-white px-1.5 font-mono text-xs text-zinc-500 uppercase group-hover:border-dashed group-hover:border-zinc-600">
                {row.execution_source || 'unknown'}
            </span>
            <span className="w-28 truncate text-left font-mono text-xs text-zinc-600 group-hover:text-zinc-900" title={row.execution_preview}>
                {row.execution_preview}
            </span>
        </>
    );

    if (!row.execution_url) {
        return (
            <span className={cn('flex items-center gap-2', className)} title="The execution that recorded this event was not captured.">
                {content}
            </span>
        );
    }

    return (
        <Link href={envUrl(auth.env!.id, row.execution_url)} className={cn('group relative z-10 flex items-center gap-2', className)}>
            {content}
        </Link>
    );
}
