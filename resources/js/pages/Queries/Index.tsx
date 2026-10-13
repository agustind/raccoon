import DataTable, { RowButton } from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import { Pagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { QueryCharts, type QueryStats } from '@/components/rc/queries-charts';
import ConnectionFilter from '@/components/rc/queries-connection-filter';
import { compactSql, SqlHighlight } from '@/components/rc/queries-sql';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { DeploymentBucket, DurationStats, GraphPoint, PageProps, Paginator, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { Database, PanelRight } from 'lucide-react';
import { useState } from 'react';
import QueryDetailsDrawer from './Partials/QueryDetailsDrawer';

interface QueryRow extends DurationStats {
    group: string;
    sql: string;
    connection: string;
    count: number;
    total: number;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    activeUserFilter: string | null;
    search: string | null;
    connection: string | null;
    connections: string[];
    graph?: GraphPoint[];
    stats?: QueryStats;
    deployments?: DeploymentBucket[];
    queries?: Paginator<QueryRow>;
}

export default function QueriesIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const [drawer, setDrawer] = useState<string | null>(null);
    const showUrl = (row: QueryRow) => withPeriod(envUrl(env.id, `queries/${row.group}`));

    return (
        <EnvironmentLayout
            title="Queries"
            actions={
                <>
                    {(props.connections.length > 1 || props.connection) && <ConnectionFilter connections={props.connections} active={props.connection} />}
                    <PeriodPicker period={props.period} />
                </>
            }
        >
            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => <QueryCharts graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} />}
                </Deferred>
            </Panel>

            <Deferred data="queries" className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={Database}
                            title={`${formatNumber(props.queries!.total)} ${props.queries!.total === 1 ? 'Query' : 'Queries'}`}
                            actions={<SearchInput value={props.search} placeholder="Search queries" />}
                        />
                        <DataTable<QueryRow>
                            rows={props.queries!.data}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            rowHref={showUrl}
                            rowActions={(row) => (
                                <RowButton title="Details" onClick={() => setDrawer(row.group)}>
                                    <PanelRight className="size-3.5" />
                                </RowButton>
                            )}
                            empty="No queries found."
                            columns={[
                                {
                                    key: 'sql',
                                    label: 'Query',
                                    sortable: true,
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <Database className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate" title={row.sql}>
                                                <SqlHighlight sql={compactSql(row.sql)} />
                                            </span>
                                        </span>
                                    ),
                                },
                                { key: 'connection', label: 'Connection', width: '110px', align: 'right', sortable: true, render: (row) => row.connection },
                                {
                                    key: 'count',
                                    label: 'Calls',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => (
                                        <Link href={showUrl(row)} className="relative z-10 hover:underline">
                                            {formatNumber(row.count)}
                                        </Link>
                                    ),
                                },
                                { key: 'total', label: 'Total', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.total) },
                                { key: 'avg', label: 'Avg', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.avg) },
                                { key: 'p95', label: 'P95', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.p95) },
                            ]}
                        />
                        <Pagination paginator={props.queries!} />
                    </>
                )}
            </Deferred>

            <QueryDetailsDrawer group={drawer} onClose={() => setDrawer(null)} />
        </EnvironmentLayout>
    );
}
