import { formatDuration, formatNumber } from '@/lib/format';
import { currentQuery, envUrl, toQueryString, withPeriod } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { ArrowUpRight } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import Drawer from './drawer';
import Timestamp from './timestamp';

/** A call listed in the drawer; links to its parent execution when known. */
export interface DrawerCall {
    timestamp: string;
    trace_id: string;
    duration: number;
    execution_url: string | null;
}

/**
 * Details drawer of the queries and outgoing requests index pages. Fetches the
 * group's show page as JSON (same period and user filter, 10 calls) and shows
 * its charts and latest calls.
 */
export default function GroupDrawer<T, C extends DrawerCall>({
    path,
    onClose,
    title,
    label,
    summary,
    charts,
    count,
    calls,
    renderCall,
    hasError,
}: {
    /** Show page path inside the environment, e.g. "queries/<group>"; null closes the drawer. */
    path: string | null;
    onClose: () => void;
    title: (details: T | null) => ReactNode;
    label: string;
    summary?: (details: T) => ReactNode;
    charts: (details: T) => ReactNode;
    count: (details: T) => number;
    calls: (details: T) => C[];
    renderCall: (call: C) => ReactNode;
    hasError?: (call: C) => boolean;
}) {
    const { auth } = usePage<PageProps>().props;
    const [details, setDetails] = useState<T | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!path) return;

        const controller = new AbortController();
        const { period, from, to, user } = currentQuery();
        setDetails(null);
        setFailed(false);

        fetch(envUrl(auth.env!.id, path) + toQueryString({ period, from, to, user, calls_per_page: 10 }), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            signal: controller.signal,
        })
            .then((response) => (response.ok ? response.json() : Promise.reject(response)))
            .then(setDetails)
            .catch((error) => error?.name !== 'AbortError' && setFailed(true));

        return () => controller.abort();
    }, [path, auth.env]);

    const href = path ? withPeriod(envUrl(auth.env!.id, path)) : '';

    return (
        <Drawer open={path !== null} onClose={onClose} title={title(details)}>
            {failed && <p className="mt-4 text-sm text-rose-600">Could not load the details.</p>}
            {!details && !failed && <div className="mt-4 h-96 animate-pulse rounded-lg bg-zinc-100" />}
            {details && (
                <div className="mt-2 space-y-4">
                    {summary?.(details)}
                    {charts(details)}

                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-medium">
                            {label}{' '}
                            <span className="ml-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">{formatNumber(count(details))}</span>
                        </h3>
                        <Link href={href} className="flex items-center gap-1 font-mono text-xs text-zinc-600 uppercase hover:text-zinc-900">
                            View all <ArrowUpRight className="size-3.5" />
                        </Link>
                    </div>

                    <div className="space-y-1.5">
                        {calls(details).length === 0 && <p className="text-sm text-zinc-500">No calls in this period.</p>}
                        {calls(details).map((call) => {
                            const error = hasError?.(call) ?? false;
                            const body = (
                                <>
                                    <div className="flex items-center justify-between font-mono text-xs text-zinc-500">
                                        <Timestamp value={call.timestamp} />
                                        <span className={cn(error && 'text-rose-600')}>{formatDuration(call.duration)}</span>
                                    </div>
                                    <div className="mt-1.5 flex min-w-0 items-center gap-3 font-mono text-[13px]">{renderCall(call)}</div>
                                </>
                            );
                            const className = cn('block rounded-lg border bg-white px-4 py-3', error ? 'border-rose-200' : 'border-zinc-200');

                            return call.execution_url ? (
                                <Link
                                    key={`${call.trace_id}:${call.timestamp}`}
                                    href={envUrl(auth.env!.id, call.execution_url)}
                                    className={cn(className, 'hover:border-zinc-300')}
                                >
                                    {body}
                                </Link>
                            ) : (
                                <div key={`${call.trace_id}:${call.timestamp}`} className={className}>
                                    {body}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Drawer>
    );
}
