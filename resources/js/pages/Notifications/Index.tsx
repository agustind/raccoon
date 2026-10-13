import { AlertCount } from '@/components/rc/badges';
import DataTable, { RowButton } from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import { MessageCharts, type MessageStats } from '@/components/rc/mail-charts';
import MessageDetailsDrawer, { type SendRow } from '@/components/rc/mail-details-drawer';
import PeriodPicker from '@/components/rc/period-picker';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import UserFilter from '@/components/rc/user-filter';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { DeploymentBucket, DurationStats, GraphPoint, PageProps, PeriodProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';
import { MessageSquareDot, PanelRight } from 'lucide-react';
import { useState } from 'react';

interface NotificationGroup extends DurationStats {
    group: string;
    class: string;
    count: number;
    sent: number;
    failed: number;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    activeUserFilter: string | null;
    search: string | null;
    graph?: GraphPoint[];
    stats?: MessageStats;
    deployments?: DeploymentBucket[];
    groups?: NotificationGroup[];
}

export default function NotificationsIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const [drawer, setDrawer] = useState<string | null>(null);

    return (
        <EnvironmentLayout
            title="Notifications"
            actions={
                <>
                    <UserFilter active={props.activeUserFilter} />
                    <PeriodPicker period={props.period} />
                </>
            }
        >
            <Panel>
                <Deferred data={['graph', 'stats', 'deployments']} className="h-80">
                    {() => <MessageCharts label="Notifications" graph={props.graph!} stats={props.stats!} deployments={props.deployments} from={props.from} to={props.to} />}
                </Deferred>
            </Panel>

            <Deferred data="groups" className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={MessageSquareDot}
                            title={`${formatNumber(props.groups!.length)} ${props.groups!.length === 1 ? 'Notification' : 'Notifications'}`}
                            actions={<SearchInput value={props.search} placeholder="Search notifications" />}
                        />
                        <DataTable<NotificationGroup>
                            rows={props.groups!}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            rowHref={(row) => withPeriod(envUrl(env.id, `notifications/${row.group}`))}
                            rowActions={(row) => (
                                <RowButton title="Details" onClick={() => setDrawer(row.group)}>
                                    <PanelRight className="size-3.5" />
                                </RowButton>
                            )}
                            empty="No notifications found."
                            columns={[
                                {
                                    key: 'class',
                                    label: 'Notification',
                                    sortable: true,
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <MessageSquareDot className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{row.class || 'Unknown Class'}</span>
                                        </span>
                                    ),
                                },
                                { key: 'count', label: 'Count', width: '80px', align: 'right', sortable: true, render: (row) => formatCompact(row.count) },
                                { key: 'failed', label: 'Failed', width: '80px', align: 'right', sortable: true, render: (row) => <AlertCount value={row.failed} tone="danger" /> },
                                { key: 'avg', label: 'Avg', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.avg) },
                                { key: 'p95', label: 'P95', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.p95) },
                            ]}
                        />
                    </>
                )}
            </Deferred>

            <MessageDetailsDrawer<SendRow & { channel: string }>
                base="notifications"
                listProp="notifications"
                label="Notifications"
                icon={MessageSquareDot}
                group={drawer}
                onClose={() => setDrawer(null)}
                renderRow={(row) => <span className="min-w-0 flex-1 truncate">{row.channel}</span>}
            />
        </EnvironmentLayout>
    );
}
