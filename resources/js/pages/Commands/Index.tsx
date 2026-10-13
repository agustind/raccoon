import { COMMAND_LEGEND, COMMAND_SERIES, CountDurationCharts, CountLink, DurationValue, type CountStats } from '@/components/rc/commands-charts';
import RunsDrawer, { type DrawerData } from '@/components/rc/commands-drawer';
import DataTable, { RowButton } from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import PeriodPicker from '@/components/rc/period-picker';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { CursorPaginator, DeploymentBucket, DurationStats, GraphPoint, PageProps, PeriodProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';
import { PanelRight, SquareTerminal } from 'lucide-react';
import { useState } from 'react';

interface CommandGroup extends DurationStats {
    group: string;
    name: string;
    count: number;
    success: number;
    failed: number;
    threshold: number | null;
}

interface DrawerRun {
    timestamp: string;
    trace_id: string;
    command: string;
    failed: boolean;
    duration: number;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    search: string | null;
    graph?: GraphPoint[];
    stats?: CountStats;
    deployments?: DeploymentBucket[];
    groups?: CommandGroup[];
}

export default function CommandsIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const [drawer, setDrawer] = useState<string | null>(null);
    const groupUrl = (group: string, query = '') => withPeriod(envUrl(env.id, `commands/${group}${query}`));

    return (
        <EnvironmentLayout title="Commands" actions={<PeriodPicker period={props.period} />}>
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
                        />
                    )}
                </Deferred>
            </Panel>

            <Deferred data="groups" className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={SquareTerminal}
                            title={`${formatNumber(props.groups!.length)} ${props.groups!.length === 1 ? 'Command' : 'Commands'}`}
                            actions={<SearchInput value={props.search} placeholder="Search commands" />}
                        />
                        <DataTable<CommandGroup>
                            rows={props.groups!}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            rowHref={(row) => groupUrl(row.group)}
                            rowActions={(row) => (
                                <RowButton title="Details" onClick={() => setDrawer(groupUrl(row.group))}>
                                    <PanelRight className="size-3.5" />
                                </RowButton>
                            )}
                            empty="No commands found. Try adjusting the time range."
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Command',
                                    sortable: true,
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <SquareTerminal className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{row.name}</span>
                                        </span>
                                    ),
                                },
                                {
                                    key: 'success',
                                    label: 'Success',
                                    width: '90px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <CountLink href={groupUrl(row.group, '?failed=0')} value={row.success} />,
                                },
                                {
                                    key: 'failed',
                                    label: 'Failed',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <CountLink href={groupUrl(row.group, '?failed=1')} value={row.failed} tone="danger" />,
                                },
                                {
                                    key: 'total',
                                    label: 'Total',
                                    width: '70px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => formatCompact(row.count),
                                },
                                {
                                    key: 'avg',
                                    label: 'Avg',
                                    width: '100px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <DurationValue value={row.avg} thresholdMs={row.threshold} />,
                                },
                                {
                                    key: 'p95',
                                    label: 'P95',
                                    width: '90px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <DurationValue value={row.p95} thresholdMs={row.threshold} />,
                                },
                            ]}
                        />
                    </>
                )}
            </Deferred>

            <RunsDrawer<DrawerData & { name: string; commands: CursorPaginator<DrawerRun> }, DrawerRun>
                url={drawer}
                onClose={() => setDrawer(null)}
                title={(data) => data.name}
                chartTitle="Calls"
                series={COMMAND_SERIES}
                legend={COMMAND_LEGEND}
                runs={(data) => data.commands}
                runHref={(data, run) => envUrl(env.id, `commands/${data.group}/${run.trace_id}`)}
                renderRun={(run) => <span className={run.failed ? 'text-rose-600' : undefined}>{run.command}</span>}
            />
        </EnvironmentLayout>
    );
}
