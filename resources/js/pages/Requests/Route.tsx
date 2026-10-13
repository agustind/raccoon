import { MethodPill, StatusCode } from '@/components/rc/badges';
import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import FilterTabs from '@/components/rc/filter-tabs';
import { CursorPagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { Panel, SectionHeader } from '@/components/rc/section';
import Timestamp from '@/components/rc/timestamp';
import UserFilter from '@/components/rc/user-filter';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { CursorPaginator, DeploymentBucket, GraphPoint, IssueLink, PageProps, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { Globe, TriangleAlert } from 'lucide-react';
import { RequestCharts, type RequestStats } from '@/components/rc/request-charts';

interface RequestRow {
    timestamp: string;
    trace_id: string;
    method: string;
    url: string;
    status_code: number;
    duration: number;
    exception_preview: string;
    group: string;
}

interface Props extends PeriodProps {
    group: string;
    route: { methods: string[]; domain: string; path: string };
    threshold: number | null;
    issues: IssueLink[];
    activeUserFilter: string | null;
    status: string | null;
    duration: string | null;
    graph?: GraphPoint[];
    stats?: RequestStats;
    deployments?: DeploymentBucket[];
    filterStats?: { count: number; '2xx': number; '4xx': number; '5xx': number };
    requests?: CursorPaginator<RequestRow>;
}

export default function RequestsRoute(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;

    return (
        <EnvironmentLayout
            title={props.route.path}
            heading={
                <>
                    <MethodPill methods={props.route.methods} />
                    {props.route.domain}
                    {props.route.path}
                </>
            }
            breadcrumbs={[{ title: 'Requests', href: withPeriod(envUrl(env.id, 'requests')) }]}
            actions={
                <>
                    <UserFilter active={props.activeUserFilter} />
                    <PeriodPicker period={props.period} />
                </>
            }
        >
            {props.issues.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {props.issues.map((issue) => (
                        <Link key={issue.ref} href={envUrl(env.id, `issues/${issue.ref}`)} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
                            <TriangleAlert className="size-4" /> #{issue.ref} {issue.title}
                        </Link>
                    ))}
                </div>
            )}

            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => <RequestCharts graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} thresholdMs={props.threshold} />}
                </Deferred>
            </Panel>

            <Deferred data={['requests', 'filterStats']} className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={Globe}
                            title={`${formatNumber(props.filterStats!.count)} Requests`}
                            actions={
                                <>
                                    <FilterTabs
                                        param="duration"
                                        value={props.duration}
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
                            rows={props.requests!.data}
                            rowKey={(row) => row.trace_id}
                            rowHref={(row) => envUrl(env.id, `requests/${row.trace_id}`)}
                            columns={[
                                { key: 'date', label: 'Date', width: '220px', render: (row) => <Timestamp value={row.timestamp} /> },
                                { key: 'method', label: 'Method', width: '70px', render: (row) => row.method },
                                {
                                    key: 'details',
                                    label: 'Details',
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <Globe className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{pathOf(row.url)}</span>
                                            {row.exception_preview && <span className="truncate text-rose-600">{row.exception_preview}</span>}
                                        </span>
                                    ),
                                },
                                { key: 'status', label: 'Status', width: '70px', align: 'right', render: (row) => <StatusCode code={row.status_code} /> },
                                { key: 'duration', label: 'Duration', width: '90px', align: 'right', render: (row) => formatDuration(row.duration) },
                            ]}
                        />
                        <CursorPagination paginator={props.requests!} />
                    </>
                )}
            </Deferred>
        </EnvironmentLayout>
    );
}

function pathOf(url: string): string {
    try {
        const parsed = new URL(url);

        return parsed.pathname + parsed.search;
    } catch {
        return url;
    }
}
