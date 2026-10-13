import { AlertCount } from '@/components/rc/badges';
import DataTable, { RowButton } from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import { MessageCharts, type MessageStats } from '@/components/rc/mail-charts';
import MessageDetailsDrawer, { type SendRow } from '@/components/rc/mail-details-drawer';
import Recipients, { type MailCounts } from '@/components/rc/mail-recipients';
import PeriodPicker from '@/components/rc/period-picker';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import UserFilter from '@/components/rc/user-filter';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatDuration, formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { DeploymentBucket, DurationStats, GraphPoint, PageProps, PeriodProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';
import { Mail, PanelRight } from 'lucide-react';
import { useState } from 'react';

interface MailGroup extends DurationStats {
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
    groups?: MailGroup[];
}

export default function MailIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const [drawer, setDrawer] = useState<string | null>(null);

    return (
        <EnvironmentLayout
            title="Mail"
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
                            label="Mails"
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
                            icon={Mail}
                            title={`${formatNumber(props.groups!.length)} ${props.groups!.length === 1 ? 'Mail' : 'Mails'}`}
                            actions={<SearchInput value={props.search} placeholder="Search mail" />}
                        />
                        <DataTable<MailGroup>
                            rows={props.groups!}
                            rowKey={(row) => row.group}
                            sortBy={props.sortBy}
                            sortDirection={props.sortDirection}
                            rowHref={(row) => withPeriod(envUrl(env.id, `mail/${row.group}`))}
                            rowActions={(row) => (
                                <RowButton title="Details" onClick={() => setDrawer(row.group)}>
                                    <PanelRight className="size-3.5" />
                                </RowButton>
                            )}
                            empty="No mail found."
                            columns={[
                                {
                                    key: 'class',
                                    label: 'Mail',
                                    sortable: true,
                                    render: (row) => (
                                        <span className="flex items-center gap-2.5">
                                            <Mail className="size-4 shrink-0 text-zinc-400" />
                                            <span className="truncate">{row.class || 'Unknown Class'}</span>
                                        </span>
                                    ),
                                },
                                {
                                    key: 'count',
                                    label: 'Count',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => formatCompact(row.count),
                                },
                                {
                                    key: 'failed',
                                    label: 'Failed',
                                    width: '80px',
                                    align: 'right',
                                    sortable: true,
                                    render: (row) => <AlertCount value={row.failed} tone="danger" />,
                                },
                                { key: 'avg', label: 'Avg', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.avg) },
                                { key: 'p95', label: 'P95', width: '90px', align: 'right', sortable: true, render: (row) => formatDuration(row.p95) },
                            ]}
                        />
                    </>
                )}
            </Deferred>

            <MessageDetailsDrawer<SendRow & MailCounts & { subject: string }>
                base="mail"
                listProp="mail"
                label="Mails"
                icon={Mail}
                group={drawer}
                onClose={() => setDrawer(null)}
                renderRow={(row) => (
                    <>
                        <span className="min-w-0 flex-1 truncate">{row.subject}</span>
                        <Recipients values={row} />
                    </>
                )}
            />
        </EnvironmentLayout>
    );
}
