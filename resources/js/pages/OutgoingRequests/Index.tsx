import { AlertCount } from '@/components/rc/badges';
import DataTable, { RowButton } from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import { Pagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { RequestCharts, type RequestStats } from '@/components/rc/request-charts';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { DeploymentBucket, DurationStats, GraphPoint, PageProps, Paginator, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { Globe, PanelRight } from 'lucide-react';
import { ReactNode, useState } from 'react';
import DetailsDrawer from './Partials/DetailsDrawer';

interface HostRow extends DurationStats {
    group: string;
    host: string;
    count: number;
    '2xx': number;
    '4xx': number;
    '5xx': number;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    activeUserFilter: string | null;
    search: string | null;
    graph?: GraphPoint[];
    stats?: RequestStats;
    deployments?: DeploymentBucket[];
    groups?: Paginator<HostRow>;
}

export default function OutgoingRequestsIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const [drawer, setDrawer] = useState<string | null>(null);
    const showUrl = (row: HostRow, status?: string) => withPeriod(envUrl(env.id, `outgoing-requests/${row.group}`, status ? { status } : undefined));
    const statusLink = (row: HostRow, status: string, children: ReactNode) => (
        <Link href={showUrl(row, status)} className="relative z-10 hover:underline">
            {children}
        </Link>
    );

    return (
        <EnvironmentLayout title="Outgoing Requests" actions={<PeriodPicker period={props.period} />}>
            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => <RequestCharts graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} />}
                </Deferred>
            </Panel>

            <Deferred data="groups" className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={Globe}
                            title={`${formatNumber(props.groups!.total)} ${props.groups!.total === 1 ? 'Domain' : 'Domains'}`}
                            actions={<SearchInput value={props.search} placeholder="Search domains" />}
                        />
                        <DataTable<HostRow>
                            rows={props.groups!.data}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            rowHref={(row) => showUrl(row)}
                            rowActions={(row) => (
                                <RowButton title="Details" onClick={() => setDrawer(row.group)}>
                                    <PanelRight className="size-3.5" />
                                </RowButton>
                            )}
                            empty="No outgoing requests found."
                            columns={[
                                {
                                    key: 'host',
                                    label: 'Host',
                                    sortable: true,
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <Globe className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{row.host || 'Unknown Host'}</span>
                                        </span>
                                    ),
                                },
                                { key: '2xx', label: '1/2/3XX', width: '80px', align: 'right', sortable: true, render: (row) => statusLink(row, '2xx', formatCompact(row['2xx'])) },
                                { key: '4xx', label: '4XX', width: '64px', align: 'right', sortable: true, render: (row) => statusLink(row, '4xx', <AlertCount value={row['4xx']} tone="warning" />) },
                                { key: '5xx', label: '5XX', width: '64px', align: 'right', sortable: true, render: (row) => statusLink(row, '5xx', <AlertCount value={row['5xx']} tone="danger" />) },
                                { key: 'count', label: 'Total', width: '70px', align: 'right', sortable: true, render: (row) => formatCompact(row.count) },
                                { key: 'avg', label: 'Avg', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.avg) },
                                { key: 'p95', label: 'P95', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.p95) },
                            ]}
                        />
                        <Pagination paginator={props.groups!} />
                    </>
                )}
            </Deferred>

            <DetailsDrawer group={drawer} onClose={() => setDrawer(null)} />
        </EnvironmentLayout>
    );
}
