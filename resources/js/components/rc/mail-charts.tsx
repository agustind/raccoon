import { formatCompact, formatDuration, formatDurationRange } from '@/lib/format';
import type { DeploymentBucket, DurationStats, GraphPoint } from '@/types/raccoon';
import { COLORS, DurationLineChart, MetricCard, StackedBarChart } from './charts';

/** Stats of mail and notification pages: sends split by outcome plus durations. */
export type MessageStats = DurationStats & { count: number; sent: number; failed: number };

const OUTCOME_SERIES = [
    { key: 'sent', label: 'Sent', color: COLORS.ok },
    { key: 'failed', label: 'Failed', color: COLORS.error },
];

/** Count card (sent vs failed) and duration card for mail and notifications. */
export function MessageCharts({
    label,
    graph,
    stats,
    deployments,
    from,
    to,
    className = 'grid grid-cols-2 gap-1.5',
}: {
    label: string;
    graph: GraphPoint[];
    stats: MessageStats;
    deployments?: DeploymentBucket[];
    from: string;
    to: string;
    className?: string;
}) {
    return (
        <div className={className}>
            <MetricCard
                label={label}
                value={formatCompact(stats.count)}
                legend={OUTCOME_SERIES.map((s) => ({ label: s.label, color: s.color, value: formatCompact(stats[s.key as 'sent' | 'failed']) }))}
                from={from}
                to={to}
            >
                <StackedBarChart data={graph} series={OUTCOME_SERIES} deployments={deployments} />
            </MetricCard>
            <MetricCard
                label="Duration"
                value={formatDurationRange(stats.min, stats.max)}
                legend={[
                    { label: 'Avg', color: COLORS.avg, value: formatDuration(stats.avg) },
                    { label: 'P95', color: COLORS.p95, value: formatDuration(stats.p95) },
                ]}
                from={from}
                to={to}
            >
                <DurationLineChart data={graph} deployments={deployments} />
            </MetricCard>
        </div>
    );
}
