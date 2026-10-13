import { AlertCount } from '@/components/rc/badges';
import { COLORS, MetricCard, StackedBarChart } from '@/components/rc/charts';
import DataTable from '@/components/rc/data-table';
import { Pagination } from '@/components/rc/pagination';
import PeriodPicker from '@/components/rc/period-picker';
import SearchInput from '@/components/rc/search-input';
import { Panel, SectionHeader } from '@/components/rc/section';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatNumber, parseTimestamp } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { DeploymentBucket, GraphPoint, PageProps, Paginator, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { useMemo } from 'react';

interface UserRow {
    id: string;
    name: string | null;
    username: string | null;
    request_count: number;
    request_2xx_count: number;
    request_4xx_count: number;
    request_5xx_count: number;
    request_error_count: number;
    queued_job_count: number;
    exception_count: number;
    last_seen_at: string;
}

interface Props extends PeriodProps {
    sortBy: string;
    sortDirection: string;
    search: string | null;
    totalUniqueUsers: number;
    graph: GraphPoint[];
    deployments: DeploymentBucket[];
    users: Paginator<UserRow>;
}

const REQUEST_SERIES = [
    { key: 'authenticated', label: 'Authenticated', color: COLORS.green },
    { key: 'guest', label: 'Guest', color: COLORS.warn },
];

export default function UsersIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const requests = useMemo(
        () =>
            props.graph.reduce(
                (sum, point) => ({ authenticated: sum.authenticated + Number(point.authenticated), guest: sum.guest + Number(point.guest) }),
                { authenticated: 0, guest: 0 },
            ),
        [props.graph],
    );

    return (
        <EnvironmentLayout title="Users" actions={<PeriodPicker period={props.period} />}>
            <Panel>
                <div className="grid grid-cols-2 gap-1.5">
                    <MetricCard label="Authenticated Users" value={formatCompact(props.totalUniqueUsers)} from={props.from} to={props.to}>
                        <StackedBarChart
                            data={props.graph}
                            series={[{ key: 'unique', label: 'Users', color: COLORS.green }]}
                            deployments={props.deployments}
                        />
                    </MetricCard>
                    <MetricCard
                        label="Requests"
                        value={formatCompact(requests.authenticated + requests.guest)}
                        legend={REQUEST_SERIES.map((s) => ({ label: s.label, color: s.color, value: formatCompact(requests[s.key as 'guest']) }))}
                        from={props.from}
                        to={props.to}
                    >
                        <StackedBarChart data={props.graph} series={REQUEST_SERIES} deployments={props.deployments} />
                    </MetricCard>
                </div>
            </Panel>

            <SectionHeader
                icon={Users}
                title={`${formatNumber(props.totalUniqueUsers)} ${props.totalUniqueUsers === 1 ? 'User' : 'Users'}`}
                actions={<SearchInput value={props.search} placeholder="Search users" />}
            />
            <DataTable<UserRow>
                rows={props.users.data}
                rowKey={(row) => row.id}
                sortBy={props.sortBy}
                sortDirection={props.sortDirection}
                rowHref={(row) => withPeriod(envUrl(env.id, `users/${row.id}`))}
                empty="No users found."
                columns={[
                    {
                        key: 'user',
                        label: 'User',
                        render: (row) => (
                            <span className="flex items-center gap-3">
                                <span className="shrink-0">{row.name ?? row.id}</span>
                                {row.username && <span className="truncate text-zinc-500">{row.username}</span>}
                            </span>
                        ),
                    },
                    {
                        key: '2xx',
                        label: '1/2/3XX',
                        width: '80px',
                        align: 'right',
                        sortable: true,
                        render: (row) => formatCompact(row.request_2xx_count),
                    },
                    {
                        key: '4xx',
                        label: '4XX',
                        width: '60px',
                        align: 'right',
                        sortable: true,
                        render: (row) => <AlertCount value={row.request_4xx_count} tone="warning" />,
                    },
                    {
                        key: '5xx',
                        label: '5XX',
                        width: '60px',
                        align: 'right',
                        sortable: true,
                        render: (row) => <AlertCount value={row.request_5xx_count} tone="danger" />,
                    },
                    {
                        key: 'requests',
                        label: 'Requests',
                        width: '90px',
                        align: 'right',
                        sortable: true,
                        render: (row) => formatCompact(row.request_count),
                    },
                    {
                        key: 'jobs',
                        label: 'Queued Jobs',
                        width: '100px',
                        align: 'right',
                        sortable: true,
                        render: (row) => (
                            <Link href={withPeriod(envUrl(env.id, 'jobs', { user: row.id }))} className="relative z-10 hover:underline">
                                {formatCompact(row.queued_job_count)}
                            </Link>
                        ),
                    },
                    {
                        key: 'exceptions',
                        label: 'Exceptions',
                        width: '100px',
                        align: 'right',
                        sortable: true,
                        render: (row) => (
                            <Link href={withPeriod(envUrl(env.id, 'exceptions', { user: row.id }))} className="relative z-10">
                                <AlertCount value={row.exception_count} tone="danger" />
                            </Link>
                        ),
                    },
                    {
                        key: 'last_seen',
                        label: 'Last Seen',
                        width: '90px',
                        align: 'right',
                        sortable: true,
                        render: (row) => <span title={row.last_seen_at}>{shortTimeAgo(row.last_seen_at)}</span>,
                    },
                ]}
            />
            <Pagination paginator={props.users} />
        </EnvironmentLayout>
    );
}

/** "3d ago", "14h ago": the narrow relative time used in tables. */
function shortTimeAgo(value: string): string {
    const seconds = Math.max(0, Math.round((Date.now() - parseTimestamp(value).getTime()) / 1000));
    const steps: [number, string][] = [
        [86400 * 365, 'y'],
        [86400 * 30, 'mo'],
        [86400, 'd'],
        [3600, 'h'],
        [60, 'm'],
    ];

    for (const [size, unit] of steps) {
        if (seconds >= size) return `${Math.floor(seconds / size)}${unit} ago`;
    }

    return `${seconds}s ago`;
}
