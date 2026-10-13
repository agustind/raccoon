import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/lib/format';
import type { CursorPaginator, DeploymentBucket, GraphPoint, PeriodProps } from '@/types/raccoon';
import { Link } from '@inertiajs/react';
import { ArrowUpRight } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import type { Series } from './charts';
import { type CountStats, CountDurationCharts } from './commands-charts';
import Drawer from './drawer';
import { Label } from './section';
import Timestamp from './timestamp';

export interface DrawerData extends PeriodProps {
    group: string;
    graph: GraphPoint[];
    stats: CountStats;
    deployments: DeploymentBucket[];
}

interface RunRow {
    timestamp: string;
    trace_id: string;
    duration: number;
}

/**
 * Details drawer for the commands and scheduled tasks lists. Like the other drawers,
 * it fetches the detail page as JSON: charts plus the latest runs.
 */
export default function RunsDrawer<T extends DrawerData, R extends RunRow>({
    url,
    onClose,
    title,
    chartTitle,
    series,
    legend,
    runs,
    runHref,
    renderRun,
}: {
    /** Detail page URL, or null when closed. */
    url: string | null;
    onClose: () => void;
    title: (data: T) => ReactNode;
    chartTitle: string;
    series: Series[];
    legend: string[];
    runs: (data: T) => CursorPaginator<R>;
    runHref: (data: T, run: R) => string;
    renderRun: (run: R) => ReactNode;
}) {
    const [data, setData] = useState<T | null>(null);

    useEffect(() => {
        if (!url) return;

        const controller = new AbortController();
        setData(null);

        fetch(url, { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, signal: controller.signal })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
            .then(setData)
            .catch((error) => {
                if (error.name !== 'AbortError') console.error('Failed to load details', error);
            });

        return () => controller.abort();
    }, [url]);

    return (
        <Drawer open={url !== null} onClose={onClose} title={data ? title(data) : ''}>
            {!data ? (
                <div className="mt-2 space-y-2">
                    <Skeleton className="h-64 w-full rounded-lg" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                </div>
            ) : (
                <div className="mt-2">
                    <CountDurationCharts
                        compact
                        title={chartTitle}
                        series={series}
                        legend={legend}
                        graph={data.graph}
                        stats={data.stats}
                        deployments={data.deployments}
                        from={data.from}
                        to={data.to}
                    />
                    <div className="mt-6 mb-2 flex items-center justify-between">
                        <Label>Latest runs</Label>
                        <Link href={url!} className="flex items-center gap-1 font-mono text-xs text-zinc-600 hover:text-zinc-900">
                            View all <ArrowUpRight className="size-3.5" />
                        </Link>
                    </div>
                    <div className="space-y-1.5">
                        {runs(data).data.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No runs in this period.</p>}
                        {runs(data).data.map((run) => (
                            <Link
                                key={`${run.trace_id}:${run.timestamp}`}
                                href={runHref(data, run)}
                                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs hover:border-zinc-300"
                            >
                                <Timestamp value={run.timestamp} className="text-zinc-600" />
                                <span className="truncate">{renderRun(run)}</span>
                                <span>{formatDuration(run.duration)}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </Drawer>
    );
}
