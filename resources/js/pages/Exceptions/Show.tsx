import DataTable from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import Drawer from '@/components/rc/drawer';
import ExceptionCard, { type TraceFrame } from '@/components/rc/exceptions-card';
import { OccurrencesChart } from '@/components/rc/exceptions-chart';
import RelatedIssuesButton, { type RelatedIssue } from '@/components/rc/issues-related';
import { KeyValue } from '@/components/rc/key-value';
import { Pagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { Card, Panel, SectionHeader } from '@/components/rc/section';
import SourceLink, { type ExecutionSource } from '@/components/rc/source-link';
import Timestamp from '@/components/rc/timestamp';
import UserFilter from '@/components/rc/user-filter';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatNumber } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { AppUser, DeploymentBucket, GraphPoint, PageProps, Paginator, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { Server, TriangleAlert } from 'lucide-react';
import { ReactNode, useState } from 'react';

interface Occurrence extends ExecutionSource {
    timestamp: string;
    message: string;
    user: AppUser;
}

interface Props extends PeriodProps {
    exception: {
        group: string;
        class: string;
        code: string;
        file: string;
        line: number;
        message: string;
        trace: TraceFrame[];
        handled: boolean;
        servers: string[];
        impacted_users: number;
        first_seen_deploy: string;
        last_seen_deploy: string;
        first_php_version: string;
        last_php_version: string;
        first_laravel_version: string;
        last_laravel_version: string;
        first_seen_at: string;
        last_seen_at: string;
        occurrences_in_last_24_hours: number;
        occurrences_in_last_7_days: number;
        occurrences_in_last_30_days: number | null;
    };
    issues: RelatedIssue[];
    activeUserFilter: string | null;
    graph?: GraphPoint[];
    deployments?: DeploymentBucket[];
    occurrences?: Paginator<Occurrence>;
}

export default function ExceptionsShow(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const e = props.exception;
    const [serversOpen, setServersOpen] = useState(false);

    return (
        <EnvironmentLayout
            title={e.message || e.class}
            heading={<span className="line-clamp-2 whitespace-normal">{e.message || e.class}</span>}
            breadcrumbs={[{ title: 'Exceptions', href: withPeriod(envUrl(env.id, 'exceptions')) }]}
            actions={
                <>
                    <RelatedIssuesButton issues={props.issues} />
                    <UserFilter active={props.activeUserFilter} />
                    <PeriodPicker period={props.period} />
                </>
            }
        >
            <Panel className="grid grid-cols-2 gap-1.5">
                <Card className="px-6 py-4">
                    <Row label="Last seen">
                        <Timestamp value={e.last_seen_at} />
                    </Row>
                    <Row label="First seen">
                        <Timestamp value={e.first_seen_at} />
                    </Row>
                    <Row label="First reported in">{e.first_seen_deploy || '—'}</Row>
                    <Row label="PHP versions">{range(e.first_php_version, e.last_php_version)}</Row>
                    <Row label="Laravel versions">{range(e.first_laravel_version, e.last_laravel_version)}</Row>
                    <Row label="Impacted users">{formatNumber(e.impacted_users)}</Row>
                    <Row label="Occurrences">
                        <span className="flex items-center gap-4 text-zinc-500 uppercase">
                            {e.occurrences_in_last_30_days !== null && (
                                <span>
                                    30 days <Count value={e.occurrences_in_last_30_days} />
                                </span>
                            )}
                            <span>
                                7 days <Count value={e.occurrences_in_last_7_days} />
                            </span>
                            <span>
                                24 hours <Count value={e.occurrences_in_last_24_hours} />
                            </span>
                        </span>
                    </Row>
                    <Row label="Servers">
                        {e.servers.length > 1 ? (
                            <span className="flex items-center gap-2">
                                {e.servers.length}
                                <button
                                    type="button"
                                    onClick={() => setServersOpen(true)}
                                    className="rounded-md border border-zinc-200 px-1.5 py-0.5 text-xs hover:bg-zinc-50"
                                >
                                    View
                                </button>
                            </span>
                        ) : (
                            e.servers.join(', ') || '—'
                        )}
                    </Row>
                </Card>
                <Deferred data={['graph', 'deployments']} className="h-full min-h-80">
                    {() => (
                        <OccurrencesChart graph={props.graph!} deployments={props.deployments} from={props.from} to={props.to} className="h-full" />
                    )}
                </Deferred>
            </Panel>

            <div className="mt-10">
                <ExceptionCard exception={{ ...e, php_version: e.last_php_version, laravel_version: e.last_laravel_version }} />
            </div>

            <Deferred data="occurrences" className="mt-10 h-96">
                {() => (
                    <>
                        <SectionHeader
                            icon={TriangleAlert}
                            title={`${formatNumber(props.occurrences!.total)} ${props.occurrences!.total === 1 ? 'occurrence' : 'occurrences'}`}
                        />
                        <DataTable<Occurrence>
                            rows={props.occurrences!.data}
                            rowKey={(row, index) => `${row.timestamp}-${index}`}
                            empty="No occurrences found."
                            columns={[
                                { key: 'date', label: 'Date', width: '220px', render: (row) => <Timestamp value={row.timestamp} /> },
                                { key: 'source', label: 'Source', width: '210px', render: (row) => <SourceLink row={row} /> },
                                { key: 'message', label: 'Message', render: (row) => <span className="block truncate">{row.message}</span> },
                                { key: 'user', label: 'User', width: '140px', align: 'right', render: (row) => <UserCell user={row.user} /> },
                            ]}
                        />
                        <Pagination paginator={props.occurrences!} />
                    </>
                )}
            </Deferred>

            <Drawer open={serversOpen} onClose={() => setServersOpen(false)} title={`${e.servers.length} servers`}>
                <div className="divide-y divide-zinc-100 border-t border-zinc-100">
                    {e.servers.map((server) => (
                        <div key={server} className="flex items-center gap-3 px-2 py-3 font-mono text-sm">
                            <Server className="size-3 text-zinc-400" />
                            {server}
                        </div>
                    ))}
                </div>
            </Drawer>
        </EnvironmentLayout>
    );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <KeyValue label={label} className="py-2.5">
            {children}
        </KeyValue>
    );
}

function Count({ value }: { value: number }) {
    return <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-900">{value}</span>;
}

function range(first: string, last: string): string {
    if (!first && !last) return '—';

    return first === last ? first : `${first} - ${last}`;
}

function UserCell({ user }: { user: AppUser }) {
    const { auth } = usePage<PageProps>().props;

    if (!user.id) return <span className="text-zinc-400">Guest</span>;

    return (
        <Link href={withPeriod(envUrl(auth.env!.id, `users/${user.id}`))} className="relative z-10 truncate hover:underline">
            {user.username ?? user.name ?? user.id}
        </Link>
    );
}
