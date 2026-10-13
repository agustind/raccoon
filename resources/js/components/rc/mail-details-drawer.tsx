import { formatDuration, formatNumber } from '@/lib/format';
import { currentQuery, envUrl, toQueryString, withPeriod } from '@/lib/rc';
import type { CursorPaginator, DeploymentBucket, GraphPoint, PageProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, LucideIcon } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import Drawer from './drawer';
import { MessageCharts, type MessageStats } from './mail-charts';
import type { ExecutionSource } from './source-link';
import Timestamp from './timestamp';

export interface SendRow extends ExecutionSource {
    timestamp: string;
    duration: number;
    failed: boolean;
}

interface Details<T> {
    from: string;
    to: string;
    class: string;
    group: string;
    graph: GraphPoint[];
    stats: MessageStats;
    deployments: DeploymentBucket[];
    list: CursorPaginator<T>;
}

/**
 * Details drawer of the mail and notification index pages. Fetches the group's
 * show page as JSON (same period and user filter) and lists its latest sends.
 */
export default function MessageDetailsDrawer<T extends SendRow>({
    base,
    listProp,
    label,
    icon: Icon,
    group,
    onClose,
    renderRow,
}: {
    /** Show page path inside the environment: "mail" or "notifications". */
    base: string;
    listProp: string;
    label: string;
    icon: LucideIcon;
    group: string | null;
    onClose: () => void;
    renderRow: (row: T) => ReactNode;
}) {
    const { auth } = usePage<PageProps>().props;
    const [details, setDetails] = useState<Details<T> | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!group) return;

        const controller = new AbortController();
        const { period, from, to, user } = currentQuery();
        setDetails(null);
        setFailed(false);

        fetch(envUrl(auth.env!.id, `${base}/${group}`) + toQueryString({ period, from, to, user }), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            signal: controller.signal,
        })
            .then((response) => (response.ok ? response.json() : Promise.reject(response)))
            .then((data) => setDetails({ ...data, list: data[listProp] }))
            .catch((error) => error?.name !== 'AbortError' && setFailed(true));

        return () => controller.abort();
    }, [group, base, listProp, auth.env]);

    const href = group ? withPeriod(envUrl(auth.env!.id, `${base}/${group}`)) : '';

    return (
        <Drawer
            open={group !== null}
            onClose={onClose}
            title={
                <span className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-zinc-500" />
                    <span className="truncate">{details ? details.class || 'Unknown Class' : label}</span>
                </span>
            }
        >
            {failed && <p className="mt-4 text-sm text-rose-600">Could not load the details.</p>}
            {!details && !failed && <div className="mt-4 h-96 animate-pulse rounded-lg bg-zinc-100" />}
            {details && (
                <div className="mt-2 space-y-4">
                    <MessageCharts label={label} graph={details.graph} stats={details.stats} deployments={details.deployments} from={details.from} to={details.to} className="grid gap-1.5" />

                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-medium">
                            Latest <span className="ml-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">{formatNumber(details.stats.count)}</span>
                        </h3>
                        <Link href={href} className="flex items-center gap-1 font-mono text-xs text-zinc-600 uppercase hover:text-zinc-900">
                            View all <ArrowUpRight className="size-3.5" />
                        </Link>
                    </div>

                    <div className="space-y-1.5">
                        {details.list.data.length === 0 && <p className="text-sm text-zinc-500">Nothing sent in this period.</p>}
                        {details.list.data.map((row) => {
                            const body = (
                                <>
                                    <div className="flex items-center justify-between font-mono text-xs text-zinc-500">
                                        <Timestamp value={row.timestamp} />
                                        <span className={row.failed ? 'text-rose-600' : undefined}>{row.failed ? 'Failed · ' : ''}{formatDuration(row.duration)}</span>
                                    </div>
                                    <div className="mt-1.5 flex min-w-0 items-center gap-3 font-mono text-[13px]">{renderRow(row)}</div>
                                </>
                            );

                            return row.execution_url ? (
                                <Link key={`${row.trace_id}:${row.timestamp}`} href={envUrl(auth.env!.id, row.execution_url)} className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-300">
                                    {body}
                                </Link>
                            ) : (
                                <div key={`${row.trace_id}:${row.timestamp}`} className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
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
