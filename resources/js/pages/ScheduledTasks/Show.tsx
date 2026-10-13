import { StatusText } from '@/components/rc/badges';
import { CountDurationCharts, DurationValue, TASK_LEGEND, TASK_SERIES, type CountStats } from '@/components/rc/commands-charts';
import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import FilterTabs from '@/components/rc/filter-tabs';
import { CursorPagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { CronCountdown, CronForHumans } from '@/components/rc/scheduled-tasks-cron';
import { Panel, SectionHeader } from '@/components/rc/section';
import Timestamp from '@/components/rc/timestamp';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { CursorPaginator, DeploymentBucket, GraphPoint, IssueLink, PageProps, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { CalendarClock, TriangleAlert } from 'lucide-react';

interface RunRow {
    timestamp: string;
    trace_id: string;
    group: string;
    status: string;
    duration: number;
    exception_preview: string;
}

interface Props extends PeriodProps {
    group: string;
    task: {
        name: string;
        cron: string;
        timezone: string;
        repeat_seconds: number;
        without_overlapping: boolean;
        on_one_server: boolean;
        run_in_background: boolean;
        even_in_maintenance_mode: boolean;
        next_runs: string[];
    };
    threshold: number | null;
    issues: IssueLink[];
    over: string | null;
    status: string | null;
    graph?: GraphPoint[];
    stats?: CountStats;
    deployments?: DeploymentBucket[];
    filterStats?: { count: number; processed: number; skipped: number; failed: number };
    runs?: CursorPaginator<RunRow>;
}

export default function ScheduledTasksShow(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const task = props.task;

    return (
        <EnvironmentLayout
            title={task.name}
            heading={
                <span className="flex items-center gap-3">
                    <span className="truncate">{task.name}</span>
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-normal text-zinc-700 uppercase">
                        <CronForHumans cron={task.cron} repeatSeconds={task.repeat_seconds} timezone={task.timezone} className="max-w-64" />
                    </span>
                </span>
            }
            breadcrumbs={[{ title: 'Scheduled Tasks', href: withPeriod(envUrl(env.id, 'scheduled-tasks')) }]}
            actions={
                <>
                    <span className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 font-mono text-xs text-zinc-600 shadow-xs">
                        NEXT RUN <CronCountdown nextRuns={task.next_runs} className="text-zinc-900" />
                    </span>
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
                    {() => (
                        <CountDurationCharts
                            title="Runs"
                            series={TASK_SERIES}
                            legend={TASK_LEGEND}
                            graph={props.graph!}
                            stats={props.stats!}
                            deployments={props.deployments}
                            from={props.from}
                            to={props.to}
                            thresholdMs={props.threshold}
                        />
                    )}
                </Deferred>
            </Panel>

            <Deferred data={['runs', 'filterStats']} className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={CalendarClock}
                            title={`${formatNumber(props.filterStats!.count)} ${props.filterStats!.count === 1 ? 'Run' : 'Runs'}`}
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
                                            { value: 'skipped', label: 'Skipped', count: props.filterStats!.skipped },
                                            { value: 'failed', label: 'Failed', count: props.filterStats!.failed },
                                        ]}
                                    />
                                </>
                            }
                        />
                        <DataTable<RunRow>
                            rows={props.runs!.data}
                            rowKey={(row) => `${row.trace_id}:${row.timestamp}`}
                            rowHref={(row) => envUrl(env.id, `scheduled-tasks/${props.group}/${row.trace_id}`)}
                            empty="No runs found. Try adjusting the filters or time range."
                            columns={[
                                { key: 'date', label: 'Date', width: '220px', render: (row) => <Timestamp value={row.timestamp} /> },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <StatusText status={row.status} />
                                            {row.exception_preview && <span className="truncate text-rose-600">! {row.exception_preview}</span>}
                                        </span>
                                    ),
                                },
                                { key: 'duration', label: 'Duration', width: '90px', align: 'right', render: (row) => <DurationValue value={row.duration} thresholdMs={props.threshold} /> },
                            ]}
                        />
                        <CursorPagination paginator={props.runs!} />
                    </>
                )}
            </Deferred>
        </EnvironmentLayout>
    );
}
