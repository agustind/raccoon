import { formatCompact, formatDuration, formatDurationRange } from '@/lib/format';
import type { DeploymentBucket, DurationStats, GraphPoint } from '@/types/raccoon';
import { COLORS, DurationLineChart, MetricCard, StackedBarChart } from './charts';

export type JobStats = DurationStats & { count: number; queued?: number; processed: number; released: number; failed: number };

/** Stack order (bottom to top). The legend lists them failed first. */
export const JOB_STATUS_SERIES = [
    { key: 'processed', label: 'Processed', color: COLORS.ok },
    { key: 'released', label: 'Released', color: COLORS.warn },
    { key: 'failed', label: 'Failed', color: COLORS.error },
];

const LEGEND_ORDER = ['failed', 'processed', 'released'] as const;

/** "Attempts" bars and "Duration" lines for the job pages. */
export function JobCharts({
    graph,
    stats,
    deployments,
    from,
    to,
    thresholdMs,
    compact = false,
}: {
    graph: GraphPoint[];
    stats: JobStats;
    deployments?: DeploymentBucket[];
    from: string;
    to: string;
    thresholdMs?: number | null;
    /** Stack the cards vertically, for the details drawer. */
    compact?: boolean;
}) {
    return (
        <div className={compact ? 'grid gap-1.5' : 'grid grid-cols-2 gap-1.5'}>
            <MetricCard
                label="Attempts"
                value={formatCompact(stats.count)}
                legend={LEGEND_ORDER.map((key) => {
                    const series = JOB_STATUS_SERIES.find((s) => s.key === key)!;

                    return { label: series.label, color: series.color, value: formatCompact(stats[key]) };
                })}
                from={from}
                to={to}
            >
                <StackedBarChart data={graph} series={JOB_STATUS_SERIES} deployments={deployments} />
            </MetricCard>
            <MetricCard
                label="Duration"
                value={formatDurationRange(stats.min, stats.max)}
                legend={[
                    ...(thresholdMs !== undefined
                        ? [{ label: 'Threshold', color: COLORS.threshold, value: thresholdMs ? formatDuration(thresholdMs * 1000) : 'N/A' }]
                        : []),
                    { label: 'Avg', color: COLORS.avg, value: formatDuration(stats.avg) },
                    { label: 'P95', color: COLORS.p95, value: formatDuration(stats.p95) },
                ]}
                from={from}
                to={to}
            >
                <DurationLineChart data={graph} deployments={deployments} thresholdMs={thresholdMs} />
            </MetricCard>
        </div>
    );
}
