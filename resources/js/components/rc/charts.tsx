import { formatCompact, formatDate, formatDuration, parseTimestamp } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DeploymentBucket, GraphPoint } from '@/types/raccoon';
import { ReactNode, useMemo } from 'react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Label } from './section';

// CSS variables so charts follow the light/dark palette (see app.css).
export const COLORS = {
    ok: 'var(--color-zinc-300)',
    warn: 'var(--color-amber-500)',
    error: 'var(--color-rose-500)',
    avg: 'var(--color-zinc-700)',
    p95: 'var(--color-amber-500)',
    threshold: 'var(--color-blue-500)',
    blue: 'var(--color-blue-500)',
    green: 'var(--color-emerald-500)',
};

const GRID = 'var(--color-zinc-100)';

export interface Series {
    key: string;
    label: string;
    color: string;
    /** Formats tooltip values. Defaults to compact numbers. */
    format?: (value: number | null) => string;
}

export interface LegendItem {
    label: string;
    color: string;
    value: ReactNode;
}

/**
 * Card with a mono label, a big value on the left, colored legend values on
 * the right, a chart, and the period's start/end underneath.
 */
export function MetricCard({
    label,
    value,
    legend = [],
    children,
    from,
    to,
    className,
}: {
    label: string;
    value: ReactNode;
    legend?: LegendItem[];
    children: ReactNode;
    from?: string;
    to?: string;
    className?: string;
}) {
    return (
        <Card className={cn('flex flex-col p-5', className)}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <Label>{label}</Label>
                    <div className="mt-1 truncate text-xl font-medium">{value}</div>
                </div>
                <div className="flex gap-6">
                    {legend.map((item) => (
                        <div key={item.label} className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                                <span className="inline-block h-2 w-1 rounded-sm" style={{ backgroundColor: item.color }} />
                                <Label>{item.label}</Label>
                            </div>
                            <div className="mt-1 text-xl font-medium">{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-4 h-44">{children}</div>
            {from && to && (
                <div className="mt-3 flex justify-between font-mono text-xs text-zinc-500">
                    <span>
                        {formatDate(from)} <span className="text-zinc-400">UTC</span>
                    </span>
                    <span>
                        {formatDate(to)} <span className="text-zinc-400">UTC</span>
                    </span>
                </div>
            )}
        </Card>
    );
}

function deploymentBuckets(deployments?: DeploymentBucket[]): Set<string> {
    return new Set((deployments ?? []).filter((d) => d.deployments.length > 0).map((d) => d.bucket));
}

function DeployMarker(props: { cx?: number; cy?: number }) {
    const { cx = 0, cy = 0 } = props;

    return <path d={`M${cx - 3.5},${cy + 8} L${cx + 3.5},${cy + 8} L${cx},${cy + 3} Z`} fill="var(--color-zinc-500)" />;
}

function ChartTooltip({ active, payload, label, series }: { active?: boolean; payload?: { dataKey: string; value: number | null }[]; label?: string; series: Series[] }) {
    if (!active || !payload?.length || !label) return null;

    return (
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg">
            <div className="mb-1.5 font-mono text-zinc-500">{formatDate(label)} UTC</div>
            {series.map((s) => {
                const entry = payload.find((p) => p.dataKey === s.key);

                return (
                    <div key={s.key} className="flex items-center justify-between gap-6">
                        <span className="flex items-center gap-1.5 text-zinc-600">
                            <span className="inline-block size-2 rounded-sm" style={{ backgroundColor: s.color }} />
                            {s.label}
                        </span>
                        <span className="font-mono text-zinc-900">{(s.format ?? formatCompact)(entry?.value ?? null)}</span>
                    </div>
                );
            })}
        </div>
    );
}

const axisProps = {
    xAxis: { dataKey: 'bucket', hide: true },
    yAxis: { hide: true, domain: [0, (max: number) => (max === 0 ? 1 : max * 1.1)] as [number, (max: number) => number] },
};

/** Stacked bars, e.g. requests split by 2xx/4xx/5xx. */
export function StackedBarChart({ data, series, deployments }: { data: GraphPoint[]; series: Series[]; deployments?: DeploymentBucket[] }) {
    const deploys = useMemo(() => deploymentBuckets(deployments), [deployments]);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 0, bottom: 10, left: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis {...axisProps.xAxis} />
                <YAxis {...axisProps.yAxis} />
                <Tooltip cursor={{ fill: GRID }} content={<ChartTooltip series={series} />} isAnimationActive={false} />
                {series.map((s, index) => (
                    <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} isAnimationActive={false} radius={index === series.length - 1 ? [1, 1, 0, 0] : 0} />
                ))}
                {[...deploys].map((bucket) => (
                    <ReferenceDot key={bucket} x={bucket} y={0} r={0} shape={<DeployMarker />} ifOverflow="visible" />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
}

/** Duration lines (avg / p95), with an optional threshold line in milliseconds. */
export function DurationLineChart({
    data,
    series = DURATION_SERIES,
    deployments,
    thresholdMs,
}: {
    data: GraphPoint[];
    series?: Series[];
    deployments?: DeploymentBucket[];
    thresholdMs?: number | null;
}) {
    const deploys = useMemo(() => deploymentBuckets(deployments), [deployments]);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 10, left: 4 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis {...axisProps.xAxis} />
                <YAxis {...axisProps.yAxis} />
                <Tooltip content={<ChartTooltip series={series} />} isAnimationActive={false} />
                {thresholdMs ? <ReferenceLine y={thresholdMs * 1000} stroke={COLORS.threshold} strokeDasharray="4 4" /> : null}
                {/* Soft fill under the slowest series, a p95 band. */}
                {series.length > 1 && (
                    <Area dataKey={series[series.length - 1].key} stroke="none" fill={series[series.length - 1].color} fillOpacity={0.06} connectNulls={false} isAnimationActive={false} type="linear" />
                )}
                {[...series].reverse().map((s) => (
                    <Line
                        key={s.key}
                        dataKey={s.key}
                        stroke={s.color}
                        strokeWidth={1.5}
                        dot={({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) => <IsolatedDot key={`dot-${s.key}-${index}`} cx={cx} cy={cy} index={index} data={data} dataKey={s.key} color={s.color} />}
                        activeDot={{ r: 3 }}
                        connectNulls={false}
                        isAnimationActive={false}
                        type="linear"
                    />
                ))}
                {[...deploys].map((bucket) => (
                    <ReferenceDot key={bucket} x={bucket} y={0} r={0} shape={<DeployMarker />} ifOverflow="visible" />
                ))}
            </ComposedChart>
        </ResponsiveContainer>
    );
}

/**
 * A point with no neighbours draws no line segment, so render it as a dot.
 * Every other point renders nothing.
 */
function IsolatedDot({ cx, cy, index, data, dataKey, color }: { cx?: number; cy?: number; index?: number; data: GraphPoint[]; dataKey: string; color: string }) {
    const present = (i: number) => data[i] !== undefined && data[i][dataKey] !== null && data[i][dataKey] !== undefined;

    if (index === undefined || cx === undefined || cy === undefined || !present(index) || present(index - 1) || present(index + 1)) {
        return <g />;
    }

    return <circle cx={cx} cy={cy} r={2.5} fill={color} />;
}

export const DURATION_SERIES: Series[] = [
    { key: 'avg', label: 'Avg', color: COLORS.avg, format: formatDuration },
    { key: 'p95', label: 'P95', color: COLORS.p95, format: formatDuration },
];

/** Tiny bar chart without chrome, for dashboard cards. */
export function SparkBars({ data, series, height = 80 }: { data: GraphPoint[]; series: Series[]; height?: number }) {
    return (
        <div style={{ height }}>
            <StackedBarChart data={data} series={series} />
        </div>
    );
}

/** Bucket label helper for custom renderers. */
export function bucketDate(bucket: string): Date {
    return parseTimestamp(bucket);
}
