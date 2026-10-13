import { formatCompact, formatDuration, formatDurationRange } from '@/lib/format';
import type { DeploymentBucket, DurationStats, GraphPoint } from '@/types/raccoon';
import { COLORS, DurationLineChart, MetricCard, StackedBarChart } from './charts';

export type QueryStats = DurationStats & { count: number; total?: number };

const CALL_SERIES = [{ key: 'count', label: 'Calls', color: COLORS.ok }];

/** Calls card and duration card of the queries pages and query drawer. */
export function QueryCharts({
    graph,
    stats,
    deployments,
    from,
    to,
    className = 'grid grid-cols-2 gap-1.5',
}: {
    graph: GraphPoint[];
    stats: QueryStats;
    deployments?: DeploymentBucket[];
    from: string;
    to: string;
    className?: string;
}) {
    return (
        <div className={className}>
            <MetricCard label="Calls" value={formatCompact(stats.count)} from={from} to={to}>
                <StackedBarChart data={graph} series={CALL_SERIES} deployments={deployments} />
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
