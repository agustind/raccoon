import { Pill } from '@/components/rc/badges';
import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import FilterTabs from '@/components/rc/filter-tabs';
import { KeyValue } from '@/components/rc/key-value';
import SourceLink, { type ExecutionSource } from '@/components/rc/source-link';
import { CursorPagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { QueryCharts, type QueryStats } from '@/components/rc/queries-charts';
import { compactSql, SqlBlock } from '@/components/rc/queries-sql';
import { Card, Panel, SectionHeader } from '@/components/rc/section';
import Timestamp from '@/components/rc/timestamp';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { CursorPaginator, DeploymentBucket, GraphPoint, PageProps, PeriodProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';
import { Database, Folder } from 'lucide-react';

interface CallRow extends ExecutionSource {
    timestamp: string;
    file: string;
    line: number;
    connection_type: string;
    duration: number;
}

interface Props extends PeriodProps {
    query: { sql: string; connection: string };
    group: string;
    activeUserFilter: string | null;
    over: string | null;
    graph?: GraphPoint[];
    stats?: QueryStats & { total: number };
    deployments?: DeploymentBucket[];
    calls?: CursorPaginator<CallRow>;
    filterStats?: { count: number };
}

export default function QueriesShow(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const sql = compactSql(props.query.sql);
    const heading = sql.length > 200 ? `${sql.slice(0, 200)}...` : sql;

    return (
        <EnvironmentLayout
            title={sql.length > 40 ? `${sql.slice(0, 40)}...` : sql}
            heading={<span className="line-clamp-2 block leading-snug whitespace-normal">{heading}</span>}
            breadcrumbs={[{ title: 'Queries', href: withPeriod(envUrl(env.id, 'queries')) }]}
            actions={<PeriodPicker period={props.period} />}
        >
            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => <QueryCharts graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} />}
                </Deferred>
            </Panel>

            <Panel className="mt-10">
                <Deferred data="stats" className="h-64">
                    {() => (
                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="px-4 py-3">
                                <h2 className="mb-2 text-lg font-medium">Info</h2>
                                <KeyValue label="Total Time">{formatDuration(props.stats!.total)}</KeyValue>
                                <KeyValue label="Avg Time">{formatDuration(props.stats!.avg)}</KeyValue>
                                <KeyValue label="P95">{formatDuration(props.stats!.p95)}</KeyValue>
                                <KeyValue label="Calls">{formatNumber(props.stats!.count)}</KeyValue>
                            </div>
                            <Card className="min-w-0">
                                <SqlBlock sql={props.query.sql} className="h-full max-h-64 p-5" />
                            </Card>
                        </div>
                    )}
                </Deferred>
            </Panel>

            <Deferred data={['calls', 'filterStats']} className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={Database}
                            title={`${formatNumber(props.filterStats!.count)} ${props.filterStats!.count === 1 ? 'Call' : 'Calls'}`}
                            actions={
                                <FilterTabs
                                    param="over"
                                    value={props.over}
                                    options={[
                                        { value: null, label: 'View all' },
                                        { value: 'avg', label: '≥ AVG' },
                                        { value: 'p95', label: '≥ P95' },
                                    ]}
                                />
                            }
                        />
                        <DataTable<CallRow>
                            rows={props.calls!.data}
                            rowKey={(row, index) => `${row.trace_id}:${row.timestamp}:${index}`}
                            empty="No calls found."
                            columns={[
                                { key: 'date', label: 'Date', width: '200px', render: (row) => <Timestamp value={row.timestamp} /> },
                                { key: 'source', label: 'Source', width: '200px', render: (row) => <SourceLink row={row} /> },
                                {
                                    key: 'location',
                                    label: 'Location',
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <Folder className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{row.file ? `${row.file}:${row.line}` : 'Unknown'}</span>
                                        </span>
                                    ),
                                },
                                {
                                    key: 'connection',
                                    label: 'Connection',
                                    width: '140px',
                                    render: (row) => (
                                        <span className="flex items-center gap-1.5">
                                            {props.query.connection}
                                            {row.connection_type && <Pill className="text-[10px]">{row.connection_type}</Pill>}
                                        </span>
                                    ),
                                },
                                { key: 'duration', label: 'Duration', width: '90px', align: 'right', render: (row) => formatDuration(row.duration) },
                            ]}
                        />
                        <CursorPagination paginator={props.calls!} />
                    </>
                )}
            </Deferred>
        </EnvironmentLayout>
    );
}
