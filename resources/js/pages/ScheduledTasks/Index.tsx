import { StatusText } from '@/components/rc/badges';
import { CountDurationCharts, CountLink, DurationValue, TASK_LEGEND, TASK_SERIES, type CountStats } from '@/components/rc/commands-charts';
import RunsDrawer, { type DrawerData } from '@/components/rc/commands-drawer';
import DataTable, { RowButton } from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import PeriodPicker from '@/components/rc/period-picker';
import { CronCountdown, CronForHumans } from '@/components/rc/scheduled-tasks-cron';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { CursorPaginator, DeploymentBucket, DurationStats, GraphPoint, PageProps, PeriodProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';
import { CalendarClock, PanelRight } from 'lucide-react';
import { useState } from 'react';

interface TaskRow extends DurationStats {
    group: string;
    name: string;
    cron: string;
    timezone: string;
    repeat_seconds: number;
    last_status: string;
    last_run_at: string;
    count: number;
    processed: number;
    skipped: number;
    failed: number;
    threshold: number | null;
    next_runs: string[];
}

interface DrawerRun {
    timestamp: string;
    trace_id: string;
    status: string;
    duration: number;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    search: string | null;
    graph?: GraphPoint[];
    stats?: CountStats;
    deployments?: DeploymentBucket[];
    tasks?: TaskRow[];
}

const LAST_STATUS_DOT: Record<string, string> = {
    processed: 'bg-emerald-500',
    skipped: 'bg-amber-500',
    failed: 'bg-rose-500',
};

export default function ScheduledTasksIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const [drawer, setDrawer] = useState<string | null>(null);
    const taskUrl = (group: string, query = '') => withPeriod(envUrl(env.id, `scheduled-tasks/${group}${query}`));

    return (
        <EnvironmentLayout title="Scheduled Tasks" actions={<PeriodPicker period={props.period} />}>
            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => (
                        <CountDurationCharts
                            title="Scheduled Tasks"
                            series={TASK_SERIES}
                            legend={TASK_LEGEND}
                            graph={props.graph!}
                            stats={props.stats!}
                            deployments={props.deployments}
                            from={props.from}
                            to={props.to}
                        />
                    )}
                </Deferred>
            </Panel>

            <Deferred data="tasks" className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={CalendarClock}
                            title={`${formatNumber(props.tasks!.length)} ${props.tasks!.length === 1 ? 'Task' : 'Tasks'}`}
                            actions={<SearchInput value={props.search} placeholder="Search tasks" />}
                        />
                        <DataTable<TaskRow>
                            rows={props.tasks!}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            rowHref={(row) => taskUrl(row.group)}
                            rowActions={(row) => (
                                <RowButton title="Details" onClick={() => setDrawer(taskUrl(row.group))}>
                                    <PanelRight className="size-3.5" />
                                </RowButton>
                            )}
                            empty="No scheduled tasks found. Try adjusting the time range."
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Task',
                                    sortable: true,
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <CalendarClock className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{row.name}</span>
                                            <span
                                                title={`Last run: ${row.last_status}`}
                                                className={cn('inline-block size-1.5 shrink-0 rounded-full', LAST_STATUS_DOT[row.last_status] ?? 'bg-zinc-300')}
                                            />
                                        </span>
                                    ),
                                },
                                {
                                    key: 'schedule',
                                    label: 'Schedule',
                                    width: '200px',
                                    render: (row) => (
                                        <span className="relative z-10">
                                            <CronForHumans cron={row.cron} repeatSeconds={row.repeat_seconds} timezone={row.timezone} className="max-w-48" />
                                        </span>
                                    ),
                                },
                                { key: 'next', label: 'Next run', width: '100px', render: (row) => <CronCountdown nextRuns={row.next_runs} /> },
                                { key: 'processed', label: 'Processed', width: '90px', align: 'right', sortable: true, render: (row) => <CountLink href={taskUrl(row.group, '?status=processed')} value={row.processed} /> },
                                { key: 'skipped', label: 'Skipped', width: '80px', align: 'right', sortable: true, render: (row) => <CountLink href={taskUrl(row.group, '?status=skipped')} value={row.skipped} tone="warning" /> },
                                { key: 'failed', label: 'Failed', width: '70px', align: 'right', sortable: true, render: (row) => <CountLink href={taskUrl(row.group, '?status=failed')} value={row.failed} tone="danger" /> },
                                { key: 'total', label: 'Total', width: '64px', align: 'right', sortable: true, render: (row) => formatCompact(row.count) },
                                { key: 'avg', label: 'Avg', width: '90px', align: 'right', sortable: true, render: (row) => <DurationValue value={row.avg} thresholdMs={row.threshold} /> },
                                { key: 'p95', label: 'P95', width: '90px', align: 'right', sortable: true, render: (row) => <DurationValue value={row.p95} thresholdMs={row.threshold} /> },
                            ]}
                        />
                    </>
                )}
            </Deferred>

            <RunsDrawer<DrawerData & { task: { name: string }; runs: CursorPaginator<DrawerRun> }, DrawerRun>
                url={drawer}
                onClose={() => setDrawer(null)}
                title={(data) => data.task.name}
                chartTitle="Runs"
                series={TASK_SERIES}
                legend={TASK_LEGEND}
                runs={(data) => data.runs}
                runHref={(data, run) => envUrl(env.id, `scheduled-tasks/${data.group}/${run.trace_id}`)}
                renderRun={(run) => <StatusText status={run.status} />}
            />
        </EnvironmentLayout>
    );
}
