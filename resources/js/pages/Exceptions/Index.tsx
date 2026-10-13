import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import { OccurrencesChart } from '@/components/rc/exceptions-chart';
import ShortTimeAgo from '@/components/rc/exceptions-time-ago';
import FilterTabs from '@/components/rc/filter-tabs';
import { Pagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import UserFilter from '@/components/rc/user-filter';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { DeploymentBucket, GraphPoint, PageProps, Paginator, PeriodProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';

interface ExceptionGroupRow {
    group: string;
    count: number;
    impacted_users: number;
    last_seen_at: string;
    class: string;
    code: string;
    file: string;
    line: number;
    message: string;
    handled: boolean;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    activeUserFilter: string | null;
    search: string | null;
    handled: string | null;
    graph?: GraphPoint[];
    stats?: { count: number; handled: number; unhandled: number };
    deployments?: DeploymentBucket[];
    filterStats?: { handled: number; unhandled: number };
    exceptions?: Paginator<ExceptionGroupRow>;
}

export default function ExceptionsIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;

    return (
        <EnvironmentLayout
            title="Exceptions"
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
                        <OccurrencesChart graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} />
                    )}
                </Deferred>
            </Panel>

            <Deferred data={['exceptions', 'filterStats']} className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            title={`${formatNumber(props.exceptions!.total)} ${props.exceptions!.total === 1 ? 'Exception' : 'Exceptions'}`}
                            actions={
                                <>
                                    <SearchInput value={props.search} placeholder="Search exceptions" />
                                    <FilterTabs
                                        param="handled"
                                        value={props.handled}
                                        options={[
                                            { value: null, label: 'View all' },
                                            { value: '1', label: 'Handled', count: props.filterStats!.handled },
                                            { value: '0', label: 'Unhandled', count: props.filterStats!.unhandled },
                                        ]}
                                    />
                                </>
                            }
                        />
                        <DataTable<ExceptionGroupRow>
                            rows={props.exceptions!.data}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            rowHref={(row) => withPeriod(envUrl(env.id, `exceptions/${row.group}`))}
                            empty="No exceptions found."
                            columns={[
                                {
                                    key: 'last_seen_at',
                                    label: 'Last seen',
                                    width: '90px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <ShortTimeAgo value={row.last_seen_at} />,
                                },
                                {
                                    key: 'exception',
                                    label: 'Exception',
                                    render: (row) => (
                                        <span className="flex min-w-0 items-center gap-3">
                                            {!row.handled && (
                                                <span className="shrink-0 rounded bg-rose-600 px-1.5 py-0.5 text-xs text-white uppercase">
                                                    Unhandled
                                                </span>
                                            )}
                                            <span className="shrink-0 text-zinc-800">{row.class}</span>
                                            {row.code !== '0' && <span className="shrink-0 text-orange-500">[{row.code}]</span>}
                                            {row.message && <span className="truncate text-zinc-500">{row.message}</span>}
                                        </span>
                                    ),
                                },
                                {
                                    key: 'count',
                                    label: 'Count',
                                    width: '64px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <span title={formatNumber(row.count)}>{formatCompact(row.count)}</span>,
                                },
                                {
                                    key: 'impacted_users',
                                    label: 'Users',
                                    width: '64px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => (
                                        <span title={`${formatNumber(row.impacted_users)} users`}>{formatCompact(row.impacted_users)}</span>
                                    ),
                                },
                            ]}
                        />
                        <Pagination paginator={props.exceptions!} />
                    </>
                )}
            </Deferred>
        </EnvironmentLayout>
    );
}
