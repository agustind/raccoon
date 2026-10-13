import { COMMAND_LEGEND, COMMAND_SERIES, CountDurationCharts, DurationValue, type CountStats } from '@/components/rc/commands-charts';
import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import FilterTabs from '@/components/rc/filter-tabs';
import { CursorPagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { Panel, SectionHeader } from '@/components/rc/section';
import Timestamp from '@/components/rc/timestamp';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { CursorPaginator, DeploymentBucket, GraphPoint, IssueLink, PageProps, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { SquareTerminal, TriangleAlert } from 'lucide-react';

interface CommandRow {
    timestamp: string;
    trace_id: string;
    group: string;
    command: string;
    exit_code: number;
    failed: boolean;
    duration: number;
    exception_preview: string;
}

interface Props extends PeriodProps {
    group: string;
    name: string;
    threshold: number | null;
    issues: IssueLink[];
    over: string | null;
    failed: string | null;
    graph?: GraphPoint[];
    stats?: CountStats;
    deployments?: DeploymentBucket[];
    filterStats?: { count: number; success: number; failed: number };
    commands?: CursorPaginator<CommandRow>;
}

export default function CommandsShow(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;

    return (
        <EnvironmentLayout
            title={props.name}
            breadcrumbs={[{ title: 'Commands', href: withPeriod(envUrl(env.id, 'commands')) }]}
            actions={<PeriodPicker period={props.period} />}
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
                            title="Calls"
                            series={COMMAND_SERIES}
                            legend={COMMAND_LEGEND}
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

            <Deferred data={['commands', 'filterStats']} className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={SquareTerminal}
                            title={`${formatNumber(props.filterStats!.count)} ${props.filterStats!.count === 1 ? 'Command' : 'Commands'}`}
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
                                        param="failed"
                                        value={props.failed}
                                        options={[
                                            { value: null, label: 'View all' },
                                            { value: '0', label: 'Successful', count: props.filterStats!.success },
                                            { value: '1', label: 'Failed', count: props.filterStats!.failed },
                                        ]}
                                    />
                                </>
                            }
                        />
                        <DataTable<CommandRow>
                            rows={props.commands!.data}
                            rowKey={(row) => `${row.trace_id}:${row.timestamp}`}
                            rowHref={(row) => envUrl(env.id, `commands/${props.group}/${row.trace_id}`)}
                            empty="No commands found. Try adjusting the filters or time range."
                            columns={[
                                { key: 'date', label: 'Date', width: '220px', render: (row) => <Timestamp value={row.timestamp} /> },
                                {
                                    key: 'command',
                                    label: 'Command',
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <SquareTerminal className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{row.command}</span>
                                            {row.exception_preview && <span className="truncate text-rose-600">! {row.exception_preview}</span>}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'exit_code',
                                    label: 'Exit code',
                                    width: '80px',
                                    align: 'center',
                                    render: (row) => <span className={cn(row.failed && 'text-rose-600')}>{row.exit_code}</span>,
                                },
                                { key: 'duration', label: 'Duration', width: '90px', align: 'right', render: (row) => <DurationValue value={row.duration} thresholdMs={props.threshold} /> },
                            ]}
                        />
                        <CursorPagination paginator={props.commands!} />
                    </>
                )}
            </Deferred>
        </EnvironmentLayout>
    );
}
