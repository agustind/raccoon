import { MethodBadge, StatusCode } from '@/components/rc/badges';
import { MetricCard, StackedBarChart } from '@/components/rc/charts';
import DataTable from '@/components/rc/data-table';
import FilterTabs from '@/components/rc/filter-tabs';
import { KeyValue } from '@/components/rc/key-value';
import { Pagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import { STATUS_SERIES } from '@/components/rc/request-charts';
import SearchInput from '@/components/rc/search-input';
import { Card, Panel, SectionHeader } from '@/components/rc/section';
import Timestamp from '@/components/rc/timestamp';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatDuration, formatNumber, timeAgo } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { DeploymentBucket, GraphPoint, PageProps, Paginator, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { Globe, User } from 'lucide-react';
import { ReactNode } from 'react';

interface RouteEntry {
    name: string;
    group: string;
    methods: string[];
}

interface RequestRow {
    trace_id: string;
    url: string;
    method: string;
    status_code: number;
    timestamp: string;
    duration: number;
    group: string;
}

type StatusCounts = { '2xx': number; '4xx': number; '5xx': number };

interface Props extends PeriodProps {
    user: { id: string; name: string; username: string; last_seen_at: string | null };
    status: string | null;
    over: string | null;
    search: string | null;
    graph: GraphPoint[];
    deployments: DeploymentBucket[];
    stats: StatusCounts & { count: number };
    filterStats: StatusCounts;
    leaderboards: {
        topRoutes: (RouteEntry & { count: number })[];
        slowRoutes: (RouteEntry & { duration: number })[];
        queuedJobs: { name: string; group: string; count: number }[];
    };
    requests: Paginator<RequestRow>;
}

export default function UsersShow(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const { user, leaderboards } = props;
    const title = user.name || user.username || `User ${user.id}`;
    const byUser = (path: string) => withPeriod(envUrl(env.id, path, { user: user.id }));

    return (
        <EnvironmentLayout
            title={title}
            breadcrumbs={[{ title: 'Users', href: withPeriod(envUrl(env.id, 'users')) }]}
            actions={<PeriodPicker period={props.period} />}
        >
            <Panel>
                <div className="grid grid-cols-2 gap-1.5">
                    <Card className="p-5">
                        <h2 className="mb-2 text-lg font-medium">Info</h2>
                        <KeyValue label="ID">{user.id}</KeyValue>
                        {user.name && <KeyValue label="Name">{user.name}</KeyValue>}
                        {user.username && <KeyValue label="Username">{user.username}</KeyValue>}
                        {user.last_seen_at && (
                            <KeyValue label="Last seen">
                                <span title={user.last_seen_at}>{timeAgo(user.last_seen_at)}</span>
                            </KeyValue>
                        )}
                        <div className="flex items-center justify-between gap-2 py-2">
                            <span className="font-mono text-xs tracking-wide text-zinc-600 uppercase">Filter by</span>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { label: 'Requests', path: 'requests' },
                                    { label: 'Jobs', path: 'jobs' },
                                    { label: 'Exceptions', path: 'exceptions' },
                                    { label: 'Logs', path: 'logs' },
                                ].map((item) => (
                                    <Link
                                        key={item.path}
                                        href={byUser(item.path)}
                                        className="rounded-md border border-zinc-200 px-2 py-0.5 font-mono text-xs text-zinc-700 hover:bg-zinc-50"
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </Card>
                    <MetricCard
                        label="Requests"
                        value={formatCompact(props.stats.count)}
                        legend={STATUS_SERIES.map((s) => ({ label: s.label, color: s.color, value: formatCompact(props.stats[s.key as '2xx']) }))}
                        from={props.from}
                        to={props.to}
                    >
                        <StackedBarChart data={props.graph} series={STATUS_SERIES} deployments={props.deployments} />
                    </MetricCard>
                </div>
            </Panel>

            {(leaderboards.topRoutes.length > 0 || leaderboards.queuedJobs.length > 0) && (
                <div className="mt-10 grid grid-cols-3 gap-2">
                    <Leaderboard title="Top Routes">
                        {leaderboards.topRoutes.map((route) => (
                            <LeaderboardRow key={route.group} href={byUser(`requests/routes/${route.group}`)} value={formatCompact(route.count)}>
                                <MethodBadge methods={route.methods} className="mr-2" />
                                {route.name}
                            </LeaderboardRow>
                        ))}
                    </Leaderboard>
                    <Leaderboard title="Slowest Routes" badge="P95">
                        {leaderboards.slowRoutes.map((route) => (
                            <LeaderboardRow key={route.group} href={byUser(`requests/routes/${route.group}`)} value={formatDuration(route.duration)}>
                                <MethodBadge methods={route.methods} className="mr-2" />
                                {route.name}
                            </LeaderboardRow>
                        ))}
                    </Leaderboard>
                    <Leaderboard title="Top Queued Jobs">
                        {leaderboards.queuedJobs.map((job) => (
                            <LeaderboardRow key={job.group} href={byUser(`jobs/${job.group}`)} value={formatCompact(job.count)}>
                                {job.name}
                            </LeaderboardRow>
                        ))}
                    </Leaderboard>
                </div>
            )}

            <SectionHeader
                icon={User}
                title={`${formatNumber(props.requests.total)} ${props.requests.total === 1 ? 'Request' : 'Requests'}`}
                actions={
                    <>
                        <SearchInput value={props.search} placeholder="Search requests" />
                        <FilterTabs
                            param="over"
                            value={props.over}
                            options={[
                                { value: null, label: 'View all' },
                                { value: 'avg', label: '≥ AVG' },
                                { value: 'p95', label: '≥ P95' },
                            ]}
                        />
                        <FilterTabs
                            param="status"
                            value={props.status}
                            options={[
                                { value: null, label: 'View all' },
                                { value: '2xx', label: '1/2/3xx', count: props.filterStats['2xx'] },
                                { value: '4xx', label: '4xx', count: props.filterStats['4xx'] },
                                { value: '5xx', label: '5xx', count: props.filterStats['5xx'] },
                            ]}
                        />
                    </>
                }
            />
            <DataTable<RequestRow>
                rows={props.requests.data}
                rowKey={(row) => row.trace_id}
                rowHref={(row) => envUrl(env.id, `requests/${row.trace_id}`)}
                empty="No requests found."
                columns={[
                    { key: 'date', label: 'Date', width: '220px', render: (row) => <Timestamp value={row.timestamp} /> },
                    { key: 'method', label: 'Method', width: '70px', render: (row) => <MethodBadge methods={row.method} /> },
                    {
                        key: 'url',
                        label: 'URL',
                        render: (row) => (
                            <span className="flex items-center gap-2.5">
                                <Globe className="size-4 shrink-0 text-zinc-400" />
                                <span className="truncate">{pathOf(row.url)}</span>
                            </span>
                        ),
                    },
                    { key: 'status', label: 'Status', width: '70px', align: 'center', render: (row) => <StatusCode code={row.status_code} /> },
                    { key: 'duration', label: 'Duration', width: '90px', align: 'right', render: (row) => formatDuration(row.duration) },
                ]}
            />
            <Pagination paginator={props.requests} />
        </EnvironmentLayout>
    );
}

function Leaderboard({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
    return (
        <Card className="p-5">
            <h2 className="flex items-center justify-between pb-3">
                <span className="text-lg font-medium text-zinc-600">{title}</span>
                {badge && <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs">{badge}</span>}
            </h2>
            {children}
        </Card>
    );
}

function LeaderboardRow({ href, value, children }: { href: string; value: ReactNode; children: ReactNode }) {
    return (
        <Link href={href} className="flex py-2.5 font-mono text-xs text-zinc-700 hover:text-zinc-950">
            <span className="truncate">{children}</span>
            <span className="mx-2 mb-[3px] h-1 grow self-end border-b-2 border-dotted border-zinc-200" />
            <span>{value}</span>
        </Link>
    );
}

function pathOf(url: string): string {
    try {
        const parsed = new URL(url);

        return parsed.pathname + parsed.search;
    } catch {
        return url;
    }
}
