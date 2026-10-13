import { AlertCount } from '@/components/rc/badges';
import { COLORS, MetricCard, StackedBarChart } from '@/components/rc/charts';
import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import PeriodPicker from '@/components/rc/period-picker';
import { Panel, SectionHeader } from '@/components/rc/section';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatNumber } from '@/lib/format';
import type { DeploymentBucket, GraphPoint, PeriodProps } from '@/types/raccoon';
import { DatabaseZap } from 'lucide-react';

interface CacheCounts {
    count: number;
    hit_ratio: number;
    hits: number;
    misses: number;
    writes: number;
    deletes: number;
    write_failures: number;
    delete_failures: number;
    total_failures: number;
}

interface KeyRow extends CacheCounts {
    group: string;
    store: string;
    key: string;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    activeUserFilter: string | null;
    graph?: GraphPoint[];
    stats?: CacheCounts;
    deployments?: DeploymentBucket[];
    keys?: KeyRow[];
}

const EVENT_SERIES = [
    { key: 'deletes', label: 'Deletes', color: COLORS.error },
    { key: 'hits', label: 'Hits', color: COLORS.ok },
    { key: 'misses', label: 'Misses', color: COLORS.warn },
    { key: 'writes', label: 'Writes', color: COLORS.blue },
];

const FAILURE_SERIES = [
    { key: 'delete_failures', label: 'Delete', color: COLORS.error },
    { key: 'write_failures', label: 'Write', color: COLORS.warn },
];

export default function CacheIndex(props: Props) {
    const keys = props.keys;

    return (
        <EnvironmentLayout title="Cache" actions={<PeriodPicker period={props.period} />}>
            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => (
                        <div className="grid grid-cols-2 gap-1.5">
                            <MetricCard
                                label="Events"
                                value={formatCompact(props.stats!.count)}
                                legend={EVENT_SERIES.map((s) => ({
                                    label: s.label,
                                    color: s.color,
                                    value: formatCompact(props.stats![s.key as keyof CacheCounts]),
                                }))}
                                from={props.from}
                                to={props.to}
                            >
                                <StackedBarChart data={props.graph!} series={EVENT_SERIES} deployments={props.deployments} />
                            </MetricCard>
                            <MetricCard
                                label="Failures"
                                value={formatCompact(props.stats!.total_failures)}
                                legend={FAILURE_SERIES.map((s) => ({
                                    label: s.label,
                                    color: s.color,
                                    value: formatCompact(props.stats![s.key as keyof CacheCounts]),
                                }))}
                                from={props.from}
                                to={props.to}
                            >
                                <StackedBarChart data={props.graph!} series={FAILURE_SERIES} deployments={props.deployments} />
                            </MetricCard>
                        </div>
                    )}
                </Deferred>
            </Panel>

            <Deferred data="keys" className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={DatabaseZap}
                            title={`${keys!.length === 100 ? 'Top ' : ''}${formatNumber(keys!.length)} ${keys!.length === 1 ? 'key' : 'keys'}`}
                        />
                        <DataTable<KeyRow>
                            rows={keys!}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            empty="No cache keys found. Try adjusting any filters or time range."
                            columns={[
                                {
                                    key: 'key',
                                    label: 'Key',
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <DatabaseZap className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate" title={`${row.store}: ${row.key}`}>
                                                {row.key}
                                            </span>
                                        </span>
                                    ),
                                },
                                {
                                    key: 'hit_ratio',
                                    label: 'Hit %',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => `${row.hit_ratio}%`,
                                },
                                {
                                    key: 'hits',
                                    label: 'Hits',
                                    width: '70px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => formatCompact(row.hits),
                                },
                                {
                                    key: 'misses',
                                    label: 'Misses',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => formatCompact(row.misses),
                                },
                                {
                                    key: 'writes',
                                    label: 'Writes',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => formatCompact(row.writes),
                                },
                                {
                                    key: 'deletes',
                                    label: 'Deletes',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => formatCompact(row.deletes),
                                },
                                {
                                    key: 'total_failures',
                                    label: 'Failures',
                                    width: '90px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => (
                                        <span title={`Write: ${formatNumber(row.write_failures)}, Delete: ${formatNumber(row.delete_failures)}`}>
                                            <AlertCount value={row.total_failures} tone="danger" />
                                        </span>
                                    ),
                                },
                                {
                                    key: 'count',
                                    label: 'Total',
                                    width: '70px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => formatCompact(row.count),
                                },
                            ]}
                        />
                    </>
                )}
            </Deferred>
        </EnvironmentLayout>
    );
}
