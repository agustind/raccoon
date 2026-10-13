import { MethodBadge, StatusCode } from '@/components/rc/badges';
import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import FilterTabs from '@/components/rc/filter-tabs';
import { CursorPagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { RequestCharts, type RequestStats } from '@/components/rc/request-charts';
import { Panel, SectionHeader } from '@/components/rc/section';
import SourceLink, { type ExecutionSource } from '@/components/rc/source-link';
import Timestamp from '@/components/rc/timestamp';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { CursorPaginator, DeploymentBucket, GraphPoint, PageProps, PeriodProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';
import { Globe } from 'lucide-react';

interface RequestRow extends ExecutionSource {
    timestamp: string;
    method: string;
    url: string;
    status_code: number;
    duration: number;
}

interface Props extends PeriodProps {
    group: string;
    host: string;
    activeUserFilter: string | null;
    status: string | null;
    over: string | null;
    graph?: GraphPoint[];
    stats?: RequestStats;
    deployments?: DeploymentBucket[];
    outgoingRequests?: CursorPaginator<RequestRow>;
    filterStats?: { count: number; '2xx': number; '4xx': number; '5xx': number };
}

export default function OutgoingRequestsShow(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const host = props.host || 'Unknown Host';

    return (
        <EnvironmentLayout
            title={host}
            breadcrumbs={[{ title: 'Outgoing Requests', href: withPeriod(envUrl(env.id, 'outgoing-requests')) }]}
            actions={<PeriodPicker period={props.period} />}
        >
            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => (
                        <RequestCharts graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} />
                    )}
                </Deferred>
            </Panel>

            <Deferred data={['outgoingRequests', 'filterStats']} className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={Globe}
                            title={`${formatNumber(props.filterStats!.count)} ${props.filterStats!.count === 1 ? 'Request' : 'Requests'}`}
                            actions={
                                <>
                                    <FilterTabs
                                        param="over"
                                        value={props.over}
                                        options={[
                                            { value: null, label: 'View all' },
                                            { value: 'avg', label: '≥ AVG' },
                                            { value: 'p95', label: '≥ P95' },
                                        ]}
                                    />
                                    <FilterTabs
                                        param="status"
                                        value={props.status}
                                        options={[
                                            { value: null, label: 'View all' },
                                            { value: '2xx', label: '1/2/3xx', count: props.filterStats!['2xx'] },
                                            { value: '4xx', label: '4xx', count: props.filterStats!['4xx'] },
                                            { value: '5xx', label: '5xx', count: props.filterStats!['5xx'] },
                                        ]}
                                    />
                                </>
                            }
                        />
                        <DataTable<RequestRow>
                            rows={props.outgoingRequests!.data}
                            rowKey={(row, index) => `${row.trace_id}:${row.timestamp}:${index}`}
                            empty="No outgoing requests found."
                            columns={[
                                { key: 'date', label: 'Date', width: '200px', render: (row) => <Timestamp value={row.timestamp} /> },
                                { key: 'source', label: 'Source', width: '200px', render: (row) => <SourceLink row={row} /> },
                                { key: 'method', label: 'Method', width: '70px', render: (row) => <MethodBadge methods={row.method} /> },
                                { key: 'status', label: 'Status', width: '60px', render: (row) => <StatusCode code={row.status_code} /> },
                                {
                                    key: 'url',
                                    label: 'URL',
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <Globe className={cn('size-4 shrink-0', row.status_code >= 500 ? 'text-rose-400' : 'text-zinc-400')} />
                                            <span className="truncate" title={row.url}>
                                                {row.url}
                                            </span>
                                        </span>
                                    ),
                                },
                                { key: 'duration', label: 'Duration', width: '90px', align: 'right', render: (row) => formatDuration(row.duration) },
                            ]}
                        />
                        <CursorPagination paginator={props.outgoingRequests!} />
                    </>
                )}
            </Deferred>
        </EnvironmentLayout>
    );
}
