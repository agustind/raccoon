import { formatCompact, formatDuration, formatDurationRange } from '@/lib/format';
import type { DeploymentBucket, DurationStats, GraphPoint } from '@/types/raccoon';
import { COLORS, DurationLineChart, MetricCard, StackedBarChart } from './charts';

export type RequestStats = DurationStats & { count: number; '2xx': number; '4xx': number; '5xx': number };


export const STATUS_SERIES = [
    { key: '2xx', label: '1/2/3XX', color: COLORS.ok },
    { key: '4xx', label: '4XX', color: COLORS.warn },
    { key: '5xx', label: '5XX', color: COLORS.error },
];

export function RequestCharts({ graph, stats, deployments, from, to, thresholdMs }: { graph: GraphPoint[]; stats: RequestStats; deployments?: DeploymentBucket[]; from: string; to: string; thresholdMs?: number | null }) {
    return (
        <div className="grid grid-cols-2 gap-1.5">
            <MetricCard
                label="Requests"
                value={formatCompact(stats.count)}
                legend={STATUS_SERIES.map((s) => ({ label: s.label, color: s.color, value: formatCompact(stats[s.key as '2xx']) }))}
                from={from}
                to={to}
            >
                <StackedBarChart data={graph} series={STATUS_SERIES} deployments={deployments} />
            </MetricCard>
            <MetricCard
                label="Duration"
                value={formatDurationRange(stats.min, stats.max)}
                legend={[
                    ...(thresholdMs !== undefined ? [{ label: 'Threshold', color: COLORS.threshold, value: thresholdMs ? formatDuration(thresholdMs * 1000) : 'N/A' }] : []),
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

