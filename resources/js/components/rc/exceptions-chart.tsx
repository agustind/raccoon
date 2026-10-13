import { COLORS, MetricCard, StackedBarChart } from '@/components/rc/charts';
import { formatCompact } from '@/lib/format';
import type { DeploymentBucket, GraphPoint } from '@/types/raccoon';

export const EXCEPTION_SERIES = [
    { key: 'handled', label: 'Handled', color: COLORS.ok },
    { key: 'unhandled', label: 'Unhandled', color: COLORS.error },
];

/** Occurrences card with handled/unhandled stacked bars. Totals come from stats or are summed from the graph. */
export function OccurrencesChart({
    graph,
    stats,
    deployments,
    from,
    to,
    className,
}: {
    graph: GraphPoint[];
    stats?: { count: number; handled: number; unhandled: number };
    deployments?: DeploymentBucket[];
    from: string;
    to: string;
    className?: string;
}) {
    const totals = stats ?? {
        count: graph.reduce((sum, point) => sum + Number(point.count ?? 0), 0),
        handled: graph.reduce((sum, point) => sum + Number(point.handled ?? 0), 0),
        unhandled: graph.reduce((sum, point) => sum + Number(point.unhandled ?? 0), 0),
    };

    return (
        <MetricCard
            label="Occurrences"
            value={formatCompact(totals.count)}
            legend={EXCEPTION_SERIES.map((s) => ({ label: s.label, color: s.color, value: stats ? formatCompact(totals[s.key as 'handled']) : '' }))}
            from={from}
            to={to}
            className={className}
        >
            <StackedBarChart data={graph} series={EXCEPTION_SERIES} deployments={deployments} />
        </MetricCard>
    );
}
