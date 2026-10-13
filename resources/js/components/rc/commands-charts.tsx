import { formatCompact, formatDuration, formatDurationRange } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DeploymentBucket, DurationStats, GraphPoint } from '@/types/raccoon';
import { Link } from '@inertiajs/react';
import { AlertCount } from './badges';
import { COLORS, DurationLineChart, MetricCard, type Series, StackedBarChart } from './charts';

export type CountStats = DurationStats & { count: number; [key: string]: number | null };

/** Bars stack bottom to top in this order; the legend lists failures first. */
export const COMMAND_SERIES: Series[] = [
    { key: 'success', label: 'Successful', color: COLORS.ok },
    { key: 'failed', label: 'Unsuccessful', color: COLORS.error },
];

export const COMMAND_LEGEND = ['failed', 'success'];

export const TASK_SERIES: Series[] = [
    { key: 'processed', label: 'Processed', color: COLORS.ok },
    { key: 'skipped', label: 'Skipped', color: COLORS.warn },
    { key: 'failed', label: 'Failed', color: COLORS.error },
];

export const TASK_LEGEND = ['failed', 'processed', 'skipped'];

/** Count card (stacked bars) next to a duration card, for commands and scheduled tasks. */
export function CountDurationCharts({
    title,
    series,
    legend,
    graph,
    stats,
    deployments,
    from,
    to,
    thresholdMs,
    compact = false,
}: {
    title: string;
    series: Series[];
    legend: string[];
    graph: GraphPoint[];
    stats: CountStats;
    deployments?: DeploymentBucket[];
    from: string;
    to: string;
    /** Pass null to show "Threshold N/A"; leave undefined to hide it. */
    thresholdMs?: number | null;
    /** Stack the cards vertically (drawer). */
    compact?: boolean;
}) {
    const legendSeries = legend.map((key) => series.find((s) => s.key === key)!).filter(Boolean);

    return (
        <div className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-2')}>
            <MetricCard
                label={title}
                value={formatCompact(stats.count)}
                legend={legendSeries.map((s) => ({ label: s.label, color: s.color, value: formatCompact(stats[s.key] ?? 0) }))}
                from={from}
                to={to}
            >
                <StackedBarChart data={graph} series={series} deployments={deployments} />
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

/** Duration that turns red when it exceeds the threshold (milliseconds). */
export function DurationValue({ value, thresholdMs }: { value: number | null; thresholdMs?: number | null }) {
    const over = Boolean(thresholdMs && value !== null && value > thresholdMs * 1000);

    return <span className={cn(over && 'text-rose-600')}>{formatDuration(value)}</span>;
}

/** Count cell that links to the detail page filtered by status, above the row link. */
export function CountLink({ href, value, tone }: { href: string; value: number; tone?: 'warning' | 'danger' }) {
    return (
        <Link href={href} className="relative z-10 hover:underline">
            {tone ? <AlertCount value={value} tone={tone} /> : formatCompact(value)}
        </Link>
    );
}
