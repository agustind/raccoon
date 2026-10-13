import { AlertCount, MethodBadge } from '@/components/rc/badges';
import DataTable, { RowButton } from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import Drawer from '@/components/rc/drawer';
import { KeyValue } from '@/components/rc/key-value';
import { Pagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import type { RequestStats } from '@/components/rc/request-charts';
import { RequestCharts } from '@/components/rc/request-charts';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import UserFilter from '@/components/rc/user-filter';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { DeploymentBucket, DurationStats, GraphPoint, PageProps, Paginator, PeriodProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';
import { Globe, PanelRight } from 'lucide-react';
import { useState } from 'react';

export interface RouteRow extends DurationStats {
    group: string;
    methods: string[];
    domain: string;
    path: string;
    count: number;
    '2xx': number;
    '4xx': number;
    '5xx': number;
    threshold: number | null;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    activeUserFilter: string | null;
    search: string | null;
    graph?: GraphPoint[];
    stats?: RequestStats;
    deployments?: DeploymentBucket[];
    routes?: Paginator<RouteRow>;
}

export default function RequestsIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const [drawer, setDrawer] = useState<RouteRow | null>(null);

    return (
        <EnvironmentLayout
            title="Requests"
            actions={
                <>
                    <UserFilter active={props.activeUserFilter} />
                    <PeriodPicker period={props.period} />
                </>
            }
        >
            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => (
                        <RequestCharts graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} />
                    )}
                </Deferred>
            </Panel>

            <Deferred data="routes" className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={Globe}
                            title={`${formatNumber(props.routes!.total)} Routes`}
                            actions={<SearchInput value={props.search} placeholder="Search routes" />}
                        />
                        <DataTable<RouteRow>
                            rows={props.routes!.data}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            rowHref={(row) => withPeriod(envUrl(env.id, `requests/routes/${row.group}`))}
                            rowActions={(row) => (
                                <RowButton title="Details" onClick={() => setDrawer(row)}>
                                    <PanelRight className="size-3.5" />
                                </RowButton>
                            )}
                            empty="No requests in this period."
                            columns={[
                                { key: 'method', label: 'Method', width: '110px', render: (row) => <MethodBadge methods={row.methods} /> },
                                {
                                    key: 'path',
                                    label: 'Path',
                                    sortable: true,
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <Globe className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">
                                                {row.domain && <span className="text-zinc-500">{row.domain}</span>}
                                                {row.path || '(unmatched)'}
                                            </span>
                                        </span>
                                    ),
                                },
                                {
                                    key: '2xx',
                                    label: '1/2/3XX',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => formatCompact(row['2xx']),
                                },
                                {
                                    key: '4xx',
                                    label: '4XX',
                                    width: '64px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <AlertCount value={row['4xx']} tone="warning" />,
                                },
                                {
                                    key: '5xx',
                                    label: '5XX',
                                    width: '64px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <AlertCount value={row['5xx']} tone="danger" />,
                                },
                                {
                                    key: 'count',
                                    label: 'Total',
                                    width: '70px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => formatCompact(row.count),
                                },
                                { key: 'avg', label: 'Avg', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.avg) },
                                { key: 'p95', label: 'P95', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.p95) },
                            ]}
                        />
                        <Pagination paginator={props.routes!} />
                    </>
                )}
            </Deferred>

            <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer ? `${drawer.methods.join('|')} ${drawer.path}` : ''}>
                {drawer && (
                    <div className="mt-2">
                        <KeyValue label="Requests">{formatNumber(drawer.count)}</KeyValue>
                        <KeyValue label="1/2/3XX">{formatNumber(drawer['2xx'])}</KeyValue>
                        <KeyValue label="4XX">{formatNumber(drawer['4xx'])}</KeyValue>
                        <KeyValue label="5XX">{formatNumber(drawer['5xx'])}</KeyValue>
                        <KeyValue label="Min">{formatDuration(drawer.min)}</KeyValue>
                        <KeyValue label="Avg">{formatDuration(drawer.avg)}</KeyValue>
                        <KeyValue label="P95">{formatDuration(drawer.p95)}</KeyValue>
                        <KeyValue label="Max">{formatDuration(drawer.max)}</KeyValue>
                        <KeyValue label="Threshold">{drawer.threshold ? `${drawer.threshold}ms` : 'None'}</KeyValue>
                    </div>
                )}
            </Drawer>
        </EnvironmentLayout>
    );
}
