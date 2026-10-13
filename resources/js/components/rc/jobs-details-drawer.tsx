import { StatusText } from '@/components/rc/badges';
import Drawer from '@/components/rc/drawer';
import { JobCharts, type JobStats } from '@/components/rc/jobs-charts';
import { KeyValue } from '@/components/rc/key-value';
import { Label } from '@/components/rc/section';
import Timestamp from '@/components/rc/timestamp';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { CursorPaginator, DeploymentBucket, GraphPoint } from '@/types/raccoon';
import { Link } from '@inertiajs/react';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface JobAttemptRow {
    timestamp: string;
    trace_id: string;
    job_id: string;
    attempt_id: string;
    status: string;
    attempt: number;
    duration: number;
    connection: string;
    queue: string;
    exception_preview: string;
}

interface JobDetails {
    group: string;
    name: string;
    from: string;
    to: string;
    threshold: number | null;
    graph: GraphPoint[];
    stats: JobStats;
    deployments: DeploymentBucket[];
    attempts: CursorPaginator<JobAttemptRow>;
}

export function attemptUrl(environmentId: string, group: string, attempt: { job_id: string; attempt_id: string }): string {
    return envUrl(environmentId, `jobs/attempts/${group}/${attempt.job_id}/${attempt.attempt_id}`);
}

/**
 * Index page drawer: charts and the latest attempts of one job, fetched as
 * JSON from the job's page.
 */
export default function JobDetailsDrawer({ environmentId, group, onClose }: { environmentId: string; group: string | null; onClose: () => void }) {
    const [details, setDetails] = useState<JobDetails | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!group) return;

        const controller = new AbortController();
        setDetails(null);
        setError(false);

        fetch(withPeriod(envUrl(environmentId, `jobs/${group}`, { items_per_page: 10 })), {
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            signal: controller.signal,
        })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.statusText))))
            .then(setDetails)
            .catch((e) => e.name !== 'AbortError' && setError(true));

        return () => controller.abort();
    }, [environmentId, group]);

    const href = group ? withPeriod(envUrl(environmentId, `jobs/${group}`)) : '';

    return (
        <Drawer open={group !== null} onClose={onClose} title={details?.name ?? 'Job'}>
            {error && <p className="mt-4 text-sm text-rose-600">Failed to load job details.</p>}
            {!details && !error && (
                <div className="mt-2 space-y-1.5">
                    <Skeleton className="h-72 w-full rounded-lg" />
                    <Skeleton className="h-72 w-full rounded-lg" />
                </div>
            )}
            {details && (
                <div className="mt-2">
                    <JobCharts graph={details.graph} stats={details.stats} deployments={details.deployments} from={details.from} to={details.to} compact />

                    <div className="mt-4">
                        <KeyValue label="Queued">{formatNumber(details.stats.queued ?? 0)}</KeyValue>
                        <KeyValue label="Threshold">{details.threshold ? `${details.threshold}ms` : 'None'}</KeyValue>
                    </div>

                    <div className="mt-6 mb-2 flex items-center justify-between">
                        <Label>Attempts</Label>
                        <Link href={href} className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900">
                            View all <ArrowUpRight className="size-3.5" />
                        </Link>
                    </div>
                    <div className="space-y-1.5">
                        {details.attempts.data.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">No attempts in this period.</p>}
                        {details.attempts.data.map((attempt) => (
                            <Link
                                key={attempt.attempt_id}
                                href={attemptUrl(environmentId, details.group, attempt)}
                                className={cn(
                                    'flex items-center justify-between gap-4 rounded-lg border bg-white px-3 py-2.5 font-mono text-xs hover:border-zinc-300',
                                    attempt.status === 'failed' ? 'border-rose-200' : 'border-zinc-200',
                                )}
                            >
                                <span className="flex items-center gap-3">
                                    <span className="text-zinc-600 uppercase">Attempt #{attempt.attempt}</span>
                                    <StatusText status={attempt.status} />
                                </span>
                                <span className="flex items-center gap-3 text-zinc-600">
                                    <Timestamp value={attempt.timestamp} />
                                    <span className="w-16 text-right text-zinc-900">{formatDuration(attempt.duration)}</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </Drawer>
    );
}
