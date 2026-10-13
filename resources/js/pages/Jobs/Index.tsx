import { AlertCount } from '@/components/rc/badges';
import DataTable, { RowButton } from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import { JobCharts, type JobStats } from '@/components/rc/jobs-charts';
import JobDetailsDrawer from '@/components/rc/jobs-details-drawer';
import { Pagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import UserFilter from '@/components/rc/user-filter';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { DeploymentBucket, DurationStats, GraphPoint, PageProps, Paginator, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { Orbit, PanelRight } from 'lucide-react';
import { ReactNode, useState } from 'react';

interface JobRow extends DurationStats {
    group: string;
    name: string;
    queued: number;
    count: number;
    processed: number;
    released: number;
    failed: number;
    threshold: number | null;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    activeUserFilter: string | null;
    search: string | null;
    graph?: GraphPoint[];
    stats?: JobStats;
    deployments?: DeploymentBucket[];
    jobs?: Paginator<JobRow>;
}

export default function JobsIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const [drawer, setDrawer] = useState<string | null>(null);
    const jobUrl = (row: JobRow, status?: string) => withPeriod(envUrl(env.id, `jobs/${row.group}`, status ? { status } : undefined));

    return (
        <EnvironmentLayout
            title="Jobs"
            actions={
                <>
                    <UserFilter active={props.activeUserFilter} />
                    <PeriodPicker period={props.period} />
                </>
            }
        >
            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => <JobCharts graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} />}
                </Deferred>
            </Panel>

            <Deferred data="jobs" className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={Orbit}
                            title={`${formatNumber(props.jobs!.total)} ${props.jobs!.total === 1 ? 'Job' : 'Jobs'}`}
                            actions={<SearchInput value={props.search} placeholder="Search jobs" />}
                        />
                        <DataTable<JobRow>
                            rows={props.jobs!.data}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            rowHref={(row) => jobUrl(row)}
                            rowActions={(row) => (
                                <RowButton title="Details" onClick={() => setDrawer(row.group)}>
                                    <PanelRight className="size-3.5" />
                                </RowButton>
                            )}
                            empty="No jobs found."
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Jobs',
                                    sortable: true,
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <Orbit className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{row.name}</span>
                                        </span>
                                    ),
                                },
                                { key: 'queued', label: 'Queued', width: '90px', align: 'right', sortable: true, render: (row) => formatCompact(row.queued) },
                                {
                                    key: 'processed',
                                    label: 'Processed',
                                    width: '100px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <CellLink href={jobUrl(row, 'processed')}>{formatCompact(row.processed)}</CellLink>,
                                },
                                {
                                    key: 'released',
                                    label: 'Released',
                                    width: '90px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => (
                                        <CellLink href={jobUrl(row, 'released')}>
                                            <AlertCount value={row.released} tone="warning" />
                                        </CellLink>
                                    ),
                                },
                                {
                                    key: 'failed',
                                    label: 'Failed',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => (
                                        <CellLink href={jobUrl(row, 'failed')}>
                                            <AlertCount value={row.failed} tone="danger" />
                                        </CellLink>
                                    ),
                                },
                                { key: 'total', label: 'Total', width: '70px', align: 'right', sortable: true, render: (row) => formatCompact(row.count) },
                                { key: 'avg', label: 'Avg', width: '90px', align: 'right', sortable: true, render: (row) => <Duration value={row.avg} thresholdMs={row.threshold} /> },
                                { key: 'p95', label: 'P95', width: '90px', align: 'right', sortable: true, render: (row) => <Duration value={row.p95} thresholdMs={row.threshold} /> },
                            ]}
                        />
                        <Pagination paginator={props.jobs!} />
                    </>
                )}
            </Deferred>

            <JobDetailsDrawer environmentId={env.id} group={drawer} onClose={() => setDrawer(null)} />
        </EnvironmentLayout>
    );
}

/** Link inside a row; sits above the row's full-size link. */
function CellLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link href={href} className="relative z-10 hover:underline">
            {children}
        </Link>
    );
}

function Duration({ value, thresholdMs }: { value: number | null; thresholdMs: number | null }) {
    const exceeded = thresholdMs !== null && value !== null && value >= thresholdMs * 1000;

    return <span className={exceeded ? 'text-rose-600' : undefined}>{formatDuration(value)}</span>;
}
