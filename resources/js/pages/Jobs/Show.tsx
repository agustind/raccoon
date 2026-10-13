import { StatusText } from '@/components/rc/badges';
import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import FilterTabs from '@/components/rc/filter-tabs';
import { JobCharts, type JobStats } from '@/components/rc/jobs-charts';
import { attemptUrl, type JobAttemptRow } from '@/components/rc/jobs-details-drawer';
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
import { Orbit, TriangleAlert } from 'lucide-react';

interface Props extends PeriodProps {
    group: string;
    name: string;
    threshold: number | null;
    issues: IssueLink[];
    activeUserFilter: string | null;
    status: string | null;
    over: string | null;
    graph?: GraphPoint[];
    stats?: JobStats;
    deployments?: DeploymentBucket[];
    filterStats?: { count: number; processed: number; released: number; failed: number };
    attempts?: CursorPaginator<JobAttemptRow>;
}

export default function JobsShow(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;

    return (
        <EnvironmentLayout
            title={props.name}
            breadcrumbs={[{ title: 'Jobs', href: withPeriod(envUrl(env.id, 'jobs')) }]}
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
                    {() => <JobCharts graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} thresholdMs={props.threshold} />}
                </Deferred>
            </Panel>

            <Deferred data={['attempts', 'filterStats']} className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={Orbit}
                            title={`${formatNumber(props.filterStats!.count)} ${props.filterStats!.count === 1 ? 'Attempt' : 'Attempts'}`}
                            actions={
                                <>
                                    <FilterTabs
                                        param="over"
                                        value={props.over}
                                        options={[
                                            { value: null, label: 'View all' },
                                            { value: 'avg', label: '≥ AVG' },
                                            { value: 'p95', label: '≥ P95' },
                                            ...(props.threshold ? [{ value: 'threshold', label: '≥ Threshold' }] : []),
                                        ]}
                                    />
                                    <FilterTabs
                                        param="status"
                                        value={props.status}
                                        options={[
                                            { value: null, label: 'View all' },
                                            { value: 'processed', label: 'Processed', count: props.filterStats!.processed },
                                            { value: 'released', label: 'Released', count: props.filterStats!.released },
                                            { value: 'failed', label: 'Failed', count: props.filterStats!.failed },
                                        ]}
                                    />
                                </>
                            }
                        />
                        <DataTable<JobAttemptRow>
                            rows={props.attempts!.data}
                            rowKey={(row) => row.attempt_id}
                            rowHref={(row) => attemptUrl(env.id, props.group, row)}
                            empty="No attempts found."
                            columns={[
                                { key: 'date', label: 'Date', width: '200px', render: (row) => <Timestamp value={row.timestamp} /> },
                                { key: 'connection', label: 'Connection', width: '100px', render: (row) => <span className="block truncate">{row.connection}</span> },
                                { key: 'queue', label: 'Queue', width: '90px', render: (row) => <span className="block truncate" title={row.queue}>{row.queue}</span> },
                                { key: 'attempt', label: 'Attempt', width: '70px', align: 'center', render: (row) => row.attempt },
                                { key: 'status', label: 'Status', width: '100px', render: (row) => <StatusText status={row.status} /> },
                                {
                                    key: 'exception',
                                    label: '',
                                    render: (row) => row.exception_preview && <span className="block truncate text-rose-600">! {row.exception_preview}</span>,
                                },
                                {
                                    key: 'duration',
                                    label: 'Duration',
                                    width: '90px',
                                    align: 'right',
                                    render: (row) => (
                                        <span className={props.threshold && row.duration >= props.threshold * 1000 ? 'text-rose-600' : undefined}>{formatDuration(row.duration)}</span>
                                    ),
                                },
                            ]}
                        />
                        <CursorPagination paginator={props.attempts!} />
                    </>
                )}
            </Deferred>
        </EnvironmentLayout>
    );
}
