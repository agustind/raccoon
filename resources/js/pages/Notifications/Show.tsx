import { Pill } from '@/components/rc/badges';
import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import FilterTabs from '@/components/rc/filter-tabs';
import { MessageCharts, type MessageStats } from '@/components/rc/mail-charts';
import type { SendRow } from '@/components/rc/mail-details-drawer';
import { CursorPagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { Panel, SectionHeader } from '@/components/rc/section';
import SourceLink from '@/components/rc/source-link';
import Timestamp from '@/components/rc/timestamp';
import UserFilter from '@/components/rc/user-filter';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { CursorPaginator, DeploymentBucket, GraphPoint, PageProps, PeriodProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';
import { MessageSquareDot } from 'lucide-react';

interface NotificationRow extends SendRow {
    class: string;
    channel: string;
}

interface Props extends PeriodProps {
    group: string;
    class: string;
    activeUserFilter: string | null;
    over: string | null;
    graph?: GraphPoint[];
    stats?: MessageStats;
    deployments?: DeploymentBucket[];
    filterStats?: { count: number };
    notifications?: CursorPaginator<NotificationRow>;
}

export default function NotificationsShow(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const title = props.class || 'Unknown Class';

    return (
        <EnvironmentLayout
            title={title}
            breadcrumbs={[{ title: 'Notifications', href: withPeriod(envUrl(env.id, 'notifications')) }]}
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
                        <MessageCharts
                            label="Notifications"
                            graph={props.graph!}
                            stats={props.stats!}
                            deployments={props.deployments}
                            from={props.from}
                            to={props.to}
                        />
                    )}
                </Deferred>
            </Panel>

            <Deferred data={['notifications', 'filterStats']} className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={MessageSquareDot}
                            title={`${formatNumber(props.filterStats!.count)} ${props.filterStats!.count === 1 ? 'Notification' : 'Notifications'}`}
                            actions={
                                <FilterTabs
                                    param="over"
                                    value={props.over}
                                    options={[
                                        { value: null, label: 'View all' },
                                        { value: 'avg', label: '≥ AVG' },
                                        { value: 'p95', label: '≥ P95' },
                                    ]}
                                />
                            }
                        />
                        <DataTable<NotificationRow>
                            rows={props.notifications!.data}
                            rowKey={(row) => `${row.trace_id}:${row.timestamp}`}
                            empty="No notifications found."
                            columns={[
                                { key: 'date', label: 'Date', width: '220px', render: (row) => <Timestamp value={row.timestamp} /> },
                                { key: 'source', label: 'Source', width: '200px', render: (row) => <SourceLink row={row} /> },
                                {
                                    key: 'channel',
                                    label: 'Channel',
                                    render: (row) => (
                                        <span className="flex items-center gap-2">
                                            {row.failed && <Pill tone="danger">Failed</Pill>}
                                            <span className="truncate">{row.channel}</span>
                                        </span>
                                    ),
                                },
                                { key: 'duration', label: 'Duration', width: '90px', align: 'right', render: (row) => formatDuration(row.duration) },
                            ]}
                        />
                        <CursorPagination paginator={props.notifications!} />
                    </>
                )}
            </Deferred>
        </EnvironmentLayout>
    );
}
