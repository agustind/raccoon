import { COLORS, DURATION_SERIES, DurationLineChart, StackedBarChart } from '@/components/rc/charts';
import type { LegendItem, Series } from '@/components/rc/charts';
import Deferred from '@/components/rc/deferred';
import { MethodBadge } from '@/components/rc/badges';
import PeriodPicker from '@/components/rc/period-picker';
import { RequestCharts } from '@/components/rc/request-charts';
import type { RequestStats } from '@/components/rc/request-charts';
import { Card, Label, Panel } from '@/components/rc/section';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatDuration, formatDurationRange, pluralize } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { DeploymentBucket, GraphPoint, PageProps, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { AppWindow, ArrowUpRight, Plus, SlidersHorizontal, SquareActivity, Users } from 'lucide-react';
import { ReactNode } from 'react';
import CardStack from './Partials/CardStack';
import { CardStatus } from './Partials/CardStatus';
import EmptyState from './Partials/EmptyState';
import LinkCard from './Partials/LinkCard';
import NoActions from './Partials/NoActions';
import UserCard, { type UserCount } from './Partials/UserCard';

interface SlowRoute {
    group: string;
    methods: string[];
    path: string;
    max_duration: number;
    count: number;
    threshold: number;
}

interface Props extends PeriodProps {
    activeUserFilter: string | null;
    deployments: DeploymentBucket[];
    requestsGraph?: GraphPoint[];
    requestStats?: Omit<RequestStats, 'min' | 'max'>;
    exceptionsGraph?: GraphPoint[];
    exceptionStats?: { total: number; impacted_users: number };
    slowRoutes?: { routes: SlowRoute[]; has_thresholds: boolean };
    jobsGraph?: GraphPoint[];
    jobStats?: { processed: number; released: number; failed: number; avg: number | null; p95: number | null };
    activeUsers?: UserCount[];
    impactedUsers?: { total: number; users: UserCount[] };
    userGraph?: GraphPoint[];
    totalUniqueUsers?: number;
}

const PERIOD_LABELS: Record<string, string> = { '1h': 'hour', '24h': '24 hours', '7d': '7 days', '14d': '14 days', '30d': '30 days' };

const EXCEPTION_SERIES: Series[] = [
    { key: 'handled', label: 'Handled', color: COLORS.ok },
    { key: 'unhandled', label: 'Unhandled', color: COLORS.error },
];

const JOB_SERIES: Series[] = [
    { key: 'processed', label: 'Processed', color: COLORS.ok },
    { key: 'released', label: 'Released', color: COLORS.warn },
    { key: 'failed', label: 'Failed', color: COLORS.error },
];

const UNIQUE_USER_SERIES: Series[] = [{ key: 'unique', label: 'Users', color: COLORS.blue }];

const USER_REQUEST_SERIES: Series[] = [
    { key: 'guest', label: 'Guest', color: COLORS.ok },
    { key: 'authenticated', label: 'Authenticated', color: COLORS.blue },
];

/** The stats props carry no min/max; the duration range comes from the graph. */
function durationRange(graph: GraphPoint[]): { min: number | null; max: number | null } {
    const mins = graph.map((point) => point.min).filter((value): value is number => typeof value === 'number');
    const maxes = graph.map((point) => point.max).filter((value): value is number => typeof value === 'number');

    return { min: mins.length ? Math.min(...mins) : null, max: maxes.length ? Math.max(...maxes) : null };
}

function sum(graph: GraphPoint[], key: string): number {
    return graph.reduce((total, point) => total + (Number(point[key]) || 0), 0);
}

export default function Dashboard(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const period = PERIOD_LABELS[props.period] ?? null;
    const exceptionsUrl = withPeriod(envUrl(env.id, 'exceptions'));
    const usersUrl = withPeriod(envUrl(env.id, 'users'));

    return (
        <EnvironmentLayout title="Dashboard" actions={<PeriodPicker period={props.period} />}>
            <div className="grid gap-10">
                <Panel icon={SquareActivity} title="Activity" actions={<HeaderLink href={withPeriod(envUrl(env.id, 'requests'))}>Requests</HeaderLink>}>
                    <Deferred data={['requestsGraph', 'requestStats']} className="h-80">
                        {() => (
                            <RequestCharts
                                graph={props.requestsGraph!}
                                stats={{ ...props.requestStats!, ...durationRange(props.requestsGraph!) }}
                                deployments={props.deployments}
                                from={props.from}
                                to={props.to}
                            />
                        )}
                    </Deferred>
                </Panel>

                <Panel icon={AppWindow} title="Application" actions={<HeaderLink href={withPeriod(envUrl(env.id, 'jobs'))}>Jobs</HeaderLink>}>
                    <div className="grid grid-cols-1 items-stretch gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                        <Deferred data={['exceptionsGraph', 'exceptionStats']} className="h-[430px]">
                            {() => {
                                const stats = props.exceptionStats!;
                                const graph = props.exceptionsGraph!;

                                return (
                                    <StatusCard>
                                        <div className="grid gap-2">
                                            <CardStatus
                                                label="Exceptions"
                                                message={`${stats.total > 0 ? stats.total.toLocaleString() : 'No'} ${stats.total === 1 ? 'exception' : 'exceptions'} reported`}
                                                period={period}
                                            />
                                            {stats.total > 0 && <p className="font-light text-zinc-500">Errors have impacted {stats.impacted_users.toLocaleString()} users.</p>}
                                        </div>
                                        {stats.total > 0 ? (
                                            <div className="grow">
                                                <div className="h-32">
                                                    <StackedBarChart data={graph} series={EXCEPTION_SERIES} />
                                                </div>
                                                <BottomLegend items={EXCEPTION_SERIES.map((s) => ({ label: s.label, color: s.color, value: formatCompact(sum(graph, s.key)) }))} />
                                            </div>
                                        ) : (
                                            <EmptyState />
                                        )}
                                        <div className="flex justify-end">{stats.total > 0 ? <ViewLink href={exceptionsUrl} /> : <NoActions />}</div>
                                    </StatusCard>
                                );
                            }}
                        </Deferred>

                        <Deferred data="slowRoutes" className="h-[430px]">
                            {() => <SlowRoutesCard slowRoutes={props.slowRoutes!} period={period} />}
                        </Deferred>

                        <div className="grid gap-1.5 md:col-span-2 md:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
                            <Deferred data={['jobsGraph', 'jobStats']} className="h-[430px]">
                                {() => {
                                    const stats = props.jobStats!;
                                    const graph = props.jobsGraph!;
                                    const range = durationRange(graph);

                                    return (
                                        <>
                                            <SmallChartCard
                                                label="Jobs"
                                                value={formatCompact(stats.processed + stats.released + stats.failed)}
                                                legend={[
                                                    { label: 'Failed', color: COLORS.error, value: formatCompact(stats.failed) },
                                                    { label: 'Processed', color: COLORS.ok, value: formatCompact(stats.processed) },
                                                    { label: 'Released', color: COLORS.warn, value: formatCompact(stats.released) },
                                                ]}
                                            >
                                                <StackedBarChart data={graph} series={JOB_SERIES} deployments={props.deployments} />
                                            </SmallChartCard>
                                            <SmallChartCard
                                                label="Job Duration"
                                                value={formatDurationRange(range.min, range.max)}
                                                legend={[
                                                    { label: 'Avg', color: COLORS.avg, value: formatDuration(stats.avg) },
                                                    { label: 'P95', color: COLORS.p95, value: formatDuration(stats.p95) },
                                                ]}
                                            >
                                                <DurationLineChart data={graph} series={DURATION_SERIES} deployments={props.deployments} />
                                            </SmallChartCard>
                                        </>
                                    );
                                }}
                            </Deferred>
                        </div>
                    </div>
                </Panel>

                <Panel icon={Users} title="Users" actions={<HeaderLink href={usersUrl}>Users</HeaderLink>}>
                    <div className="grid grid-cols-1 items-stretch gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                        <Deferred data="impactedUsers" className="h-[430px]">
                            {() => {
                                const impacted = props.impactedUsers!;

                                return (
                                    <StatusCard>
                                        <CardStatus
                                            label="Exceptions"
                                            message={`${impacted.total > 0 ? impacted.total.toLocaleString() : 'No'} ${impacted.total === 1 ? 'user' : 'users'} impacted by exceptions`}
                                            period={period}
                                        />
                                        {impacted.total > 0 ? (
                                            <UserList users={impacted.users} more={impacted.total} environmentId={env.id} countType="warning" />
                                        ) : (
                                            <EmptyState />
                                        )}
                                        <div className="flex justify-end">{impacted.total > 0 ? <ViewLink href={usersUrl} /> : <NoActions />}</div>
                                    </StatusCard>
                                );
                            }}
                        </Deferred>

                        <Deferred data="activeUsers" className="h-[430px]">
                            {() => {
                                const users = props.activeUsers!;

                                return (
                                    <StatusCard>
                                        <CardStatus label="Requests" message={users.length > 0 ? 'Most active users' : 'No active users'} period={period} />
                                        {users.length > 0 ? <UserList users={users.slice(0, 3)} more={users.length} environmentId={env.id} /> : <EmptyState />}
                                        <div className="flex justify-end">{users.length > 0 ? <ViewLink href={usersUrl} /> : <NoActions />}</div>
                                    </StatusCard>
                                );
                            }}
                        </Deferred>

                        <div className="grid gap-1.5 md:col-span-2 md:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
                            <Deferred data={['userGraph', 'totalUniqueUsers']} className="h-[430px]">
                                {() => {
                                    const graph = props.userGraph!;
                                    const guest = sum(graph, 'guest');
                                    const authenticated = sum(graph, 'authenticated');

                                    return (
                                        <>
                                            <SmallChartCard
                                                label="Authenticated Users"
                                                value={formatCompact(props.totalUniqueUsers!)}
                                                legend={[{ label: 'Users', color: COLORS.blue, value: formatCompact(props.totalUniqueUsers!) }]}
                                            >
                                                <StackedBarChart data={graph} series={UNIQUE_USER_SERIES} deployments={props.deployments} />
                                            </SmallChartCard>
                                            <SmallChartCard
                                                label="Requests"
                                                value={formatCompact(guest + authenticated)}
                                                legend={[
                                                    { label: 'Authenticated', color: COLORS.blue, value: formatCompact(authenticated) },
                                                    { label: 'Guest', color: COLORS.ok, value: formatCompact(guest) },
                                                ]}
                                            >
                                                <StackedBarChart data={graph} series={USER_REQUEST_SERIES} deployments={props.deployments} />
                                            </SmallChartCard>
                                        </>
                                    );
                                }}
                            </Deferred>
                        </div>
                    </div>
                </Panel>
            </div>
        </EnvironmentLayout>
    );
}

function SlowRoutesCard({ slowRoutes, period }: { slowRoutes: { routes: SlowRoute[]; has_thresholds: boolean }; period: string | null }) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;

    if (!slowRoutes.has_thresholds) {
        return (
            <Card className="flex h-full flex-col items-center justify-center border-dashed p-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-100/50">
                    <SlidersHorizontal className="size-7 stroke-1 text-blue-600" />
                </span>
                <h3 className="mt-4 text-2xl font-semibold">Setup thresholds</h3>
                <p className="mt-2 max-w-64 text-balance text-zinc-400">Configure your performance thresholds to start monitoring.</p>
                {auth.org && auth.app && (
                    <Link
                        href={`/settings/organizations/${auth.org.id}/applications/${auth.app.id}/thresholds`}
                        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white shadow-xs hover:bg-blue-700"
                    >
                        <Plus className="size-4" />
                        Add Threshold
                    </Link>
                )}
            </Card>
        );
    }

    const routes = slowRoutes.routes;

    return (
        <StatusCard>
            <CardStatus label="Routes" message={routes.length > 0 ? `${pluralize(routes.length, 'route')} exceeded thresholds` : 'No routes exceeded thresholds'} period={period} />
            {routes.length > 0 ? (
                <div className="relative grow">
                    <div className="relative z-1 space-y-2">
                        {routes.slice(0, 3).map((route) => (
                            <LinkCard
                                key={route.group}
                                href={withPeriod(envUrl(env.id, `requests/routes/${route.group}`))}
                                className="font-mono"
                                stats={
                                    <div className="flex gap-2 text-sm whitespace-nowrap">
                                        <span className="font-medium">MAX</span>
                                        <span className="font-mono text-amber-600">{formatDuration(route.max_duration)}</span>
                                    </div>
                                }
                            >
                                <MethodBadge methods={route.methods} />
                                <span className="truncate text-xs text-zinc-500">{route.path}</span>
                            </LinkCard>
                        ))}
                    </div>
                    {routes.length > 3 && <CardStack count={routes.length > 4 ? 2 : 1} />}
                </div>
            ) : (
                <EmptyState />
            )}
            <div className="flex justify-end">{routes.length > 0 ? <ViewLink href={withPeriod(envUrl(env.id, 'requests'))} /> : <NoActions />}</div>
        </StatusCard>
    );
}

function UserList({ users, more, environmentId, countType }: { users: UserCount[]; more: number; environmentId: string; countType?: 'neutral' | 'warning' }) {
    return (
        <div className="relative grow">
            <div className="relative z-1 space-y-2">
                {users.map((user) => (
                    <UserCard key={user.id} environmentId={environmentId} user={user} countType={countType} />
                ))}
            </div>
            {more > 3 && <CardStack count={more > 4 ? 2 : 1} />}
        </div>
    );
}

/** Tall card with a status sentence on top and an action at the bottom. */
function StatusCard({ children }: { children: ReactNode }) {
    return <Card className="flex h-full min-h-[430px] flex-col justify-between gap-6 p-6">{children}</Card>;
}

/** Half-height chart card for the dashboard's right column. */
function SmallChartCard({ label, value, legend, children }: { label: string; value: ReactNode; legend: LegendItem[]; children: ReactNode }) {
    return (
        <Card className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <Label>{label}</Label>
                    <div className="mt-1 truncate text-base font-medium">{value}</div>
                </div>
                <div className="flex gap-4">
                    {legend.map((item) => (
                        <div key={item.label} className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                                <span className="inline-block h-2 w-1 rounded-sm" style={{ backgroundColor: item.color }} />
                                <Label>{item.label}</Label>
                            </div>
                            <div className="mt-1 text-base font-medium">{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-4 h-24">{children}</div>
        </Card>
    );
}

function BottomLegend({ items }: { items: LegendItem[] }) {
    return (
        <div className="mt-3 flex justify-center gap-4 text-xs text-zinc-600">
            {items.map((item) => (
                <span key={item.label} className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-1 rounded-sm" style={{ backgroundColor: item.color }} />
                    {item.value} {item.label}
                </span>
            ))}
        </div>
    );
}

const secondaryButton = 'inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 shadow-xs hover:bg-zinc-50';

function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link href={href} className={secondaryButton}>
            {children}
            <ArrowUpRight className="size-3.5 text-zinc-500" />
        </Link>
    );
}

function ViewLink({ href, className }: { href: string; className?: string }) {
    return (
        <Link href={href} className={cn(secondaryButton, className)}>
            View
        </Link>
    );
}
