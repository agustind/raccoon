import { StatusCode } from '@/components/rc/badges';
import DataTable, { type Column } from '@/components/rc/data-table';
import Deferred from '@/components/rc/deferred';
import ExceptionCard, { type ExceptionDetails, exceptionToMarkdown } from '@/components/rc/exceptions-card';
import ShortTimeAgo from '@/components/rc/exceptions-time-ago';
import ActivityLogItem, { type ActivityLog } from '@/components/rc/issues-activity-log';
import { AssigneePicker, Avatar, type Member, PRIORITIES, PriorityPicker } from '@/components/rc/issues-controls';
import {
    EnvironmentDot,
    type IssueEnvironment,
    IssueStatusIcon,
    issueUrl,
    type StatusAction,
    StatusMenuItems,
    StatusModal,
} from '@/components/rc/issues-status';
import { Pagination } from '@/components/rc/pagination';
import { Card } from '@/components/rc/section';
import SourceLink, { type ExecutionSource } from '@/components/rc/source-link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatDuration, formatNumber, timeAgo } from '@/lib/format';
import { envUrl } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { AppUser, Deployment, PageProps, Paginator } from '@/types/raccoon';
import { Link, router, usePage } from '@inertiajs/react';
import { ArrowUpRight, BellOff, BellRing, ChevronDown } from 'lucide-react';
import { ReactNode, useState } from 'react';

interface Issue {
    ref: number;
    type: 'exception' | 'alert';
    issueable_type: 'exception' | 'route' | 'job' | 'command' | 'scheduled_task';
    status: 'open' | 'resolved' | 'ignored';
    priority: number;
    title: string;
    subtitle: string | null;
    description: string;
    created_at: string;
    first_seen_at: string;
    last_seen_at: string;
    user: Member | null;
    resolve_on_deploy_environment_id: string | null;
    activityLogs: ActivityLog[];
}

type OccurrenceRow = Partial<ExecutionSource> & {
    timestamp: string;
    trace_id: string;
    group?: string;
    message?: string;
    user?: AppUser;
    method?: string;
    url?: string;
    status_code?: number;
    duration?: number;
    job_id?: string;
    attempt_id?: string;
    attempt?: number;
    status?: string;
    queue?: string;
    connection?: string;
    exit_code?: number;
    command?: string;
    name?: string;
};

interface Props {
    issue: Issue;
    environment: IssueEnvironment;
    environments: IssueEnvironment[];
    group: string;
    subscribed: boolean;
    users: Member[];
    environment_stats_period: number;
    details: Partial<ExceptionDetails> & { first_deploy: Deployment | null; last_deploy: Deployment | null };
    from: string;
    to: string;
    lookback_period: number;
    environment_stats: { environment: IssueEnvironment; group: string; count: number }[];
    occurrences?: Paginator<OccurrenceRow>;
}

/** Where "View all" and the per-environment counts link to, per issue type. */
const GROUP_PAGES: Record<Issue['issueable_type'], string> = {
    exception: 'exceptions',
    route: 'requests/routes',
    job: 'jobs',
    command: 'commands',
    scheduled_task: 'scheduled-tasks',
};

export default function IssuesShow(props: Props) {
    const { issue, environment } = props;
    const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
    const listPath = `issues/${issue.type === 'exception' ? 'exceptions' : 'performance'}`;
    const lastStatusLog = [...issue.activityLogs]
        .reverse()
        .find((log) =>
            [
                'status_updated',
                'status_updated_with_comment',
                'status_update_comment_updated',
                'status_update_comment_deleted',
                'resolved_on_deploy',
            ].includes(log.event),
        );

    return (
        <EnvironmentLayout
            title={`Issue ${issue.ref}: ${issue.title}`}
            heading={<span className="block text-3xl whitespace-normal">{issue.title}</span>}
            breadcrumbs={[
                {
                    title: issue.status[0].toUpperCase() + issue.status.slice(1),
                    href: envUrl(environment.id, listPath, { filter: issue.status === 'open' ? null : issue.status }),
                },
                { title: String(issue.ref) },
            ]}
            exportMarkdown={() => issueToMarkdown(props)}
        >
            <div className="flex gap-8">
                <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-8">
                    {issue.status !== 'open' && lastStatusLog && <StatusCard status={issue.status} log={lastStatusLog} />}

                    <Description issue={issue} environmentId={environment.id} />

                    {issue.issueable_type === 'exception' && props.details.trace && (
                        <ExceptionCard
                            exception={{
                                class: props.details.class ?? issue.title,
                                code: props.details.code ?? '0',
                                file: props.details.file ?? '',
                                line: props.details.line ?? 0,
                                message: props.details.message ?? '',
                                handled: props.details.handled ?? false,
                                trace: props.details.trace,
                                php_version: props.details.php_version ?? null,
                                laravel_version: props.details.laravel_version ?? null,
                            }}
                        />
                    )}

                    <Occurrences {...props} />

                    <section className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-1.5">
                        <div className="px-2.5 py-2 text-base font-medium">Activity</div>
                        <Card className="relative p-4">
                            <div className="absolute top-6 bottom-40 left-[27px] border-l border-dashed border-zinc-300" />
                            <div className="relative grid gap-5">
                                <ActivityLogItem
                                    log={{
                                        id: 0,
                                        event: 'issue_created',
                                        payload: {},
                                        user: null,
                                        user_id: null,
                                        timestamp: issue.created_at,
                                        created_at: issue.created_at,
                                    }}
                                    environmentId={environment.id}
                                    issueRef={issue.ref}
                                />
                                {issue.activityLogs.map((log) => (
                                    <ActivityLogItem key={log.id} log={log} environmentId={environment.id} issueRef={issue.ref} />
                                ))}
                            </div>
                            <CommentBox issue={issue} environmentId={environment.id} />
                        </Card>
                    </section>
                </div>

                <aside className="w-80 shrink-0">
                    <div className="sticky top-4">
                        <Card className="overflow-hidden">
                            <SidebarHeading title="Manage" />
                            <SidebarRows>
                                <SidebarRow label="Status">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger className="flex items-center gap-2 text-sm whitespace-nowrap capitalize">
                                            <IssueStatusIcon status={issue.status} pendingDeploy={Boolean(issue.resolve_on_deploy_environment_id)} />
                                            {issue.resolve_on_deploy_environment_id
                                                ? `Resolve on next deploy${pendingEnvironment(props) ? ` (${pendingEnvironment(props)})` : ''}`
                                                : issue.status}
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-72">
                                            <StatusMenuItems
                                                status={issue.status}
                                                pendingDeploy={Boolean(issue.resolve_on_deploy_environment_id)}
                                                onAction={setStatusAction}
                                            />
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </SidebarRow>
                                <SidebarRow label="Priority">
                                    <PriorityPicker
                                        value={issue.priority}
                                        onChange={(priority) =>
                                            router.patch(issueUrl(environment.id, issue.ref), { priority }, { preserveScroll: true })
                                        }
                                    />
                                </SidebarRow>
                                <SidebarRow label="Assignee">
                                    <AssigneePicker
                                        value={issue.user?.id ?? null}
                                        users={props.users}
                                        onChange={(user_id) =>
                                            router.patch(issueUrl(environment.id, issue.ref), { user_id }, { preserveScroll: true })
                                        }
                                    />
                                </SidebarRow>
                            </SidebarRows>

                            <SidebarHeading title="Details" />
                            <SidebarRows>
                                <SidebarRow label="First seen">
                                    <span className="text-sm" title={issue.first_seen_at}>
                                        {timeAgo(issue.first_seen_at)}
                                    </span>
                                </SidebarRow>
                                <SidebarRow label="Last seen">
                                    <span className="text-sm" title={issue.last_seen_at}>
                                        {timeAgo(issue.last_seen_at)}
                                    </span>
                                </SidebarRow>
                                {issue.issueable_type === 'exception' && (
                                    <>
                                        <SidebarRow label="First reported in">
                                            <DeploymentBadge deployment={props.details.first_deploy} />
                                        </SidebarRow>
                                        <SidebarRow label="Last reported in">
                                            <DeploymentBadge deployment={props.details.last_deploy} />
                                        </SidebarRow>
                                    </>
                                )}
                            </SidebarRows>

                            <SidebarHeading title="Occurrences" description={`Last ${props.environment_stats_period} days`} />
                            <SidebarRows>
                                {props.environment_stats.map(({ environment: env, group, count }) => (
                                    <div key={env.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                                        <span className="flex items-center gap-3">
                                            <EnvironmentDot color={env.color} />
                                            {env.name}
                                        </span>
                                        {count > 0 ? (
                                            <Link
                                                href={envUrl(env.id, `${GROUP_PAGES[issue.issueable_type]}/${group}`, {
                                                    period: `${props.environment_stats_period}d`,
                                                })}
                                                className="flex items-center gap-2 uppercase"
                                            >
                                                {formatCompact(count)}
                                                <ArrowUpRight className="size-4 text-zinc-600" />
                                            </Link>
                                        ) : (
                                            <span>0</span>
                                        )}
                                    </div>
                                ))}
                            </SidebarRows>
                        </Card>

                        <SubscribeButton subscribed={props.subscribed} url={issueUrl(environment.id, issue.ref, '/subscription')} />
                    </div>
                </aside>
            </div>

            <StatusModal
                issueRef={issue.ref}
                action={statusAction}
                onClose={() => setStatusAction(null)}
                environments={props.environments}
                currentEnvironmentId={environment.id}
            />
        </EnvironmentLayout>
    );
}

function pendingEnvironment(props: Props): string | null {
    return props.environments.find((env) => env.id === props.issue.resolve_on_deploy_environment_id)?.name ?? null;
}

function SidebarHeading({ title, description }: { title: string; description?: string }) {
    return (
        <h2 className="flex items-center justify-between bg-zinc-100 p-4 text-sm/none font-medium">
            {title}
            {description && <span className="text-zinc-500">{description}</span>}
        </h2>
    );
}

function SidebarRows({ children }: { children: ReactNode }) {
    return <div className="flex flex-col py-2">{children}</div>;
}

function SidebarRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-2 px-4 py-2">
            <span className="text-sm/none text-zinc-500">{label}</span>
            <div className="flex min-w-0 flex-1 justify-end">{children}</div>
        </div>
    );
}

function DeploymentBadge({ deployment }: { deployment: Deployment | null }) {
    if (!deployment) return <span className="text-sm text-zinc-500">Unknown</span>;

    const label = deployment.ref ? deployment.ref.slice(0, 7) : deployment.deploy;
    const badge = <span className="max-w-40 truncate rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">{label}</span>;

    return deployment.url ? (
        <a href={deployment.url} target="_blank" rel="noreferrer" title={deployment.name ?? deployment.deploy}>
            {badge}
        </a>
    ) : (
        <span title={deployment.name ?? deployment.deploy}>{badge}</span>
    );
}

function SubscribeButton({ subscribed, url }: { subscribed: boolean; url: string }) {
    return (
        <button
            type="button"
            onClick={() => (subscribed ? router.delete(url, { preserveScroll: true }) : router.post(url, {}, { preserveScroll: true }))}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white text-base text-zinc-700 shadow-xs hover:bg-zinc-50"
        >
            {subscribed ? <BellOff className="size-4 text-zinc-400" /> : <BellRing className="size-4 text-zinc-400" />}
            {subscribed ? 'Unsubscribe' : 'Subscribe'}
        </button>
    );
}

function StatusCard({ status, log }: { status: Issue['status']; log: ActivityLog }) {
    return (
        <div
            className={cn(
                'space-y-3 rounded-xl border p-4',
                status === 'resolved' ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-blue-300 bg-blue-50',
            )}
        >
            <div className="flex items-center gap-2">
                <IssueStatusIcon status={status} className="size-5" />
                <h2 className="text-lg font-semibold capitalize">{status}</h2>
            </div>
            {log.payload.comment && <p className="text-sm whitespace-pre-wrap">{log.payload.comment}</p>}
            <div className="flex items-center gap-3 text-sm">
                {log.user && <Avatar user={log.user} />}
                <p>
                    <span className="font-medium">{log.user?.name ?? 'Raccoon'} </span>
                    <span className="text-zinc-600">
                        {status} {timeAgo(log.timestamp)}
                    </span>
                </p>
            </div>
        </div>
    );
}

function Description({ issue, environmentId }: { issue: Issue; environmentId: string }) {
    const [tab, setTab] = useState<'write' | 'preview'>(issue.description.trim() ? 'preview' : 'write');
    const [text, setText] = useState(issue.description);
    const dirty = text !== issue.description;

    return (
        <Card className="overflow-hidden">
            <div className="flex items-center gap-1 border-b border-zinc-200 px-3">
                {(['write', 'preview'] as const).map((key) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        className={cn(
                            '-mb-px border-b-2 px-2 py-3 text-sm capitalize',
                            tab === key ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800',
                        )}
                    >
                        {key}
                    </button>
                ))}
                {dirty && (
                    <div className="ml-auto flex gap-2">
                        <button
                            type="button"
                            onClick={() => setText(issue.description)}
                            className="h-7 rounded-md border border-zinc-200 px-2 text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                router.patch(
                                    issueUrl(environmentId, issue.ref),
                                    { description: text },
                                    { preserveScroll: true, onSuccess: () => setTab('preview') },
                                )
                            }
                            className="h-7 rounded-md bg-zinc-900 px-2 text-xs text-white"
                        >
                            Save
                        </button>
                    </div>
                )}
            </div>
            {tab === 'write' ? (
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={text ? 6 : 2}
                    placeholder="Enter a description..."
                    className="block w-full resize-y px-[18px] py-[15px] font-mono text-[13px] outline-none placeholder:text-zinc-400"
                />
            ) : (
                <div className="px-[18px] py-[15px] text-sm whitespace-pre-wrap text-zinc-700">
                    {issue.description || <span className="text-zinc-400">No description</span>}
                </div>
            )}
        </Card>
    );
}

const COMMENT_ACTIONS: Record<StatusAction, { label: string; data: (environmentId: string) => Record<string, string> }> = {
    open: { label: 'Open', data: () => ({ status: 'open' }) },
    resolve: { label: 'Resolve now', data: () => ({ status: 'resolved' }) },
    resolve_on_deploy: { label: 'Resolve on next deploy', data: (environmentId) => ({ resolve_on_deploy_environment_id: environmentId }) },
    ignore: { label: 'Ignore', data: () => ({ status: 'ignored' }) },
};

function CommentBox({ issue, environmentId }: { issue: Issue; environmentId: string }) {
    const { auth } = usePage<PageProps>().props;
    const [comment, setComment] = useState('');
    const [action, setAction] = useState<StatusAction>(issue.status === 'open' ? 'resolve' : 'open');
    const [processing, setProcessing] = useState(false);
    const options = {
        preserveScroll: true,
        onStart: () => setProcessing(true),
        onFinish: () => setProcessing(false),
        onSuccess: () => setComment(''),
    };
    const available = (Object.keys(COMMENT_ACTIONS) as StatusAction[]).filter((key) =>
        issue.status === 'open'
            ? key !== 'open' && !(key === 'resolve_on_deploy' && issue.resolve_on_deploy_environment_id)
            : key === 'open' || (key === 'resolve' ? issue.status !== 'resolved' : key === 'ignore' && issue.status !== 'ignored'),
    );
    const current = available.includes(action) ? action : available[0];

    const changeStatus = () => {
        const data = COMMENT_ACTIONS[current].data(environmentId);

        if (comment.trim()) {
            router.post(issueUrl(environmentId, issue.ref, '/comments'), { comment, ...data }, options);
        } else {
            router.patch(issueUrl(environmentId, issue.ref), data, options);
        }
    };

    return (
        <div className="relative mt-6">
            <div className="flex items-center gap-3.5 pb-3">
                {auth.user && <Avatar user={auth.user} className="size-6" />}
                <span className="text-sm font-medium">Add a comment</span>
            </div>
            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && comment.trim()) {
                        router.post(issueUrl(environmentId, issue.ref, '/comments'), { comment }, options);
                    }
                }}
                rows={3}
                placeholder="Add a comment..."
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
            <div className={cn('mt-3 flex justify-end gap-2', processing && 'animate-pulse')}>
                {current && (
                    <div className="flex">
                        <button
                            type="button"
                            onClick={changeStatus}
                            disabled={processing}
                            className="h-8 rounded-l-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 hover:bg-zinc-50"
                        >
                            {COMMENT_ACTIONS[current].label}
                            {comment.trim() ? ' with comment' : ''}
                        </button>
                        {available.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex h-8 items-center rounded-r-md border border-l-0 border-zinc-200 bg-white px-2 text-zinc-500 hover:bg-zinc-50">
                                    <ChevronDown className="size-3.5" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {available.map((key) => (
                                        <DropdownMenuItem key={key} onSelect={() => setAction(key)}>
                                            {COMMENT_ACTIONS[key].label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                )}
                <button
                    type="button"
                    disabled={!comment.trim() || processing}
                    onClick={() => router.post(issueUrl(environmentId, issue.ref, '/comments'), { comment }, options)}
                    className="h-8 rounded-md bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                    Comment
                </button>
            </div>
        </div>
    );
}

function Occurrences(props: Props) {
    const { issue, environment, environments, occurrences } = props;
    const viewAll =
        issue.issueable_type === 'exception'
            ? envUrl(environment.id, `exceptions/${props.group}`)
            : envUrl(environment.id, `${GROUP_PAGES[issue.issueable_type]}/${props.group}`, { from: props.from, to: props.to });

    return (
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-1.5">
            <div className="flex items-center justify-between p-2 pb-3 pl-3">
                <span className="text-base font-medium">
                    {occurrences
                        ? `${occurrences.total ? formatNumber(occurrences.total) : 'No'} ${occurrences.total === 1 ? 'occurrence' : 'occurrences'}`
                        : 'Occurrences'}
                </span>
                <div className="flex items-center gap-2">
                    {occurrences && occurrences.total > 0 && (
                        <span className="px-3 text-sm whitespace-nowrap text-zinc-600">Last {props.lookback_period} days</span>
                    )}
                    {environments.length > 1 ? (
                        <Select value={environment.id} onValueChange={(id) => router.get(issueUrl(id, issue.ref), {}, { replace: true })}>
                            <SelectTrigger className="h-8 w-auto gap-2 bg-white">
                                <span className="flex items-center gap-2 text-sm">
                                    <EnvironmentDot color={environment.color} />
                                    {environment.name}
                                </span>
                            </SelectTrigger>
                            <SelectContent>
                                {environments.map((env) => (
                                    <SelectItem key={env.id} value={env.id}>
                                        <span className="flex items-center gap-2">
                                            <EnvironmentDot color={env.color} />
                                            {env.name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <span className="flex h-8 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm">
                            <EnvironmentDot color={environment.color} />
                            {environment.name}
                        </span>
                    )}
                    <Link
                        href={viewAll}
                        className={cn(
                            'flex h-8 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50',
                            !occurrences?.total && 'pointer-events-none opacity-50',
                        )}
                    >
                        View all
                    </Link>
                </div>
            </div>
            <Deferred data="occurrences" className="h-56">
                {() =>
                    occurrences!.total > 0 ? (
                        <>
                            <DataTable<OccurrenceRow>
                                rows={occurrences!.data}
                                rowKey={(row, index) => `${row.timestamp}-${index}`}
                                rowHref={
                                    issue.issueable_type === 'exception'
                                        ? undefined
                                        : (row) => executionUrl(environment.id, issue.issueable_type, row)
                                }
                                columns={occurrenceColumns(issue.issueable_type)}
                            />
                            <Pagination paginator={occurrences!} />
                        </>
                    ) : (
                        <Card className="flex min-h-56 items-center justify-center">
                            <p className="font-medium text-zinc-400">No occurrences within the last {props.lookback_period} days</p>
                        </Card>
                    )
                }
            </Deferred>
        </section>
    );
}

function executionUrl(environmentId: string, type: Issue['issueable_type'], row: OccurrenceRow): string | null {
    switch (type) {
        case 'route':
            return envUrl(environmentId, `requests/${row.trace_id}`);
        case 'job':
            return envUrl(environmentId, `jobs/attempts/${row.group}/${row.job_id}/${row.attempt_id}`);
        case 'command':
            return envUrl(environmentId, `commands/${row.group}/${row.trace_id}`);
        case 'scheduled_task':
            return envUrl(environmentId, `scheduled-tasks/${row.group}/${row.trace_id}`);
        default:
            return null;
    }
}

function occurrenceColumns(type: Issue['issueable_type']): Column<OccurrenceRow>[] {
    const when: Column<OccurrenceRow> = {
        key: 'timestamp',
        label: 'Date',
        width: '80px',
        render: (row) => <ShortTimeAgo value={row.timestamp} className="text-zinc-600" />,
    };
    const duration: Column<OccurrenceRow> = {
        key: 'duration',
        label: 'Duration',
        width: '90px',
        align: 'right',
        render: (row) => formatDuration(row.duration ?? null),
    };
    const statusText = (ok: boolean, label: string) => (
        <span className={cn('font-medium uppercase', ok ? 'text-emerald-600' : 'text-rose-600')}>{label}</span>
    );

    switch (type) {
        case 'exception':
            return [
                when,
                {
                    key: 'source',
                    label: 'Source',
                    width: '210px',
                    render: (row) => (row.execution_source !== undefined ? <SourceLink row={row as ExecutionSource} /> : null),
                },
                { key: 'message', label: 'Message', render: (row) => <span className="block truncate">{row.message}</span> },
                {
                    key: 'user',
                    label: 'User',
                    width: '120px',
                    align: 'right',
                    render: (row) =>
                        row.user?.id ? (
                            <span className="truncate">{row.user.username ?? row.user.name ?? row.user.id}</span>
                        ) : (
                            <span className="text-zinc-400">Guest</span>
                        ),
                },
            ];
        case 'route':
            return [
                when,
                { key: 'method', label: 'Method', width: '70px', render: (row) => row.method },
                { key: 'status', label: 'Status', width: '60px', render: (row) => <StatusCode code={row.status_code ?? 0} /> },
                { key: 'url', label: 'URL', render: (row) => <span className="block truncate">{row.url}</span> },
                duration,
            ];
        case 'job':
            return [
                when,
                { key: 'status', label: 'Status', width: '100px', render: (row) => statusText(row.status !== 'failed', row.status ?? '') },
                {
                    key: 'details',
                    label: 'Details',
                    render: (row) => (
                        <span className="block truncate">{`Attempt ${row.attempt} on ${row.queue} queue using ${row.connection} connection`}</span>
                    ),
                },
                duration,
            ];
        case 'command':
            return [
                when,
                {
                    key: 'status',
                    label: 'Status',
                    width: '80px',
                    render: (row) => statusText(row.exit_code === 0, row.exit_code === 0 ? 'Success' : 'Failed'),
                },
                { key: 'command', label: 'Command', render: (row) => <span className="block truncate">{row.command || row.name}</span> },
                duration,
            ];
        case 'scheduled_task':
            return [
                when,
                { key: 'status', label: 'Status', width: '100px', render: (row) => statusText(row.status !== 'failed', row.status ?? '') },
                { key: 'name', label: 'Task', render: (row) => <span className="block truncate">{row.name}</span> },
                duration,
            ];
    }
}

/** "Copy for AI": the issue, its exception and stack trace, recent occurrences and activity. */
function issueToMarkdown(props: Props): string {
    const { issue, environment, details } = props;
    const lines: string[] = [`# Issue #${issue.ref}: ${issue.title}`, '', `Exported from Raccoon: ${window.location.href}`, ''];

    lines.push(
        '## Details',
        '',
        `- **Status:** ${issue.status}`,
        `- **Priority:** ${PRIORITIES[issue.priority]?.label ?? issue.priority}`,
        `- **Assignee:** ${issue.user?.name ?? 'unassigned'}`,
        `- **Type:** ${issue.issueable_type}`,
        `- **First seen:** ${issue.first_seen_at}`,
        `- **Last seen:** ${issue.last_seen_at}`,
        ...props.environment_stats.map(
            (stat) => `- **Occurrences in ${stat.environment.name}** (last ${props.environment_stats_period} days): ${stat.count}`,
        ),
        '',
    );

    if (issue.subtitle) lines.push(issue.subtitle, '');
    if (issue.description) lines.push('## Description', '', issue.description, '');

    if (issue.issueable_type === 'exception' && details.trace) {
        const exception = exceptionToMarkdown(
            {
                class: details.class ?? issue.title,
                code: details.code ?? '0',
                file: details.file ?? '',
                line: details.line ?? 0,
                message: details.message ?? '',
                handled: details.handled ?? false,
                trace: details.trace,
                php_version: details.php_version ?? null,
                laravel_version: details.laravel_version ?? null,
            },
            details.trace,
        );

        // Nest the exception's headings under this document's.
        lines.push(exception.replace(/^(#+ )/gm, '#$1'), '');
    }

    const occurrences = props.occurrences?.data ?? [];

    if (occurrences.length > 0) {
        lines.push(
            `## Recent occurrences (${environment.name})`,
            '',
            '| Date (UTC) | Source | Message | User | Link |',
            '| --- | --- | --- | --- | --- |',
        );
        occurrences.forEach((row) => {
            const source = [row.execution_source, row.execution_preview ?? (row.method ? `${row.method} ${row.url}` : '')].filter(Boolean).join(' ');
            const link = row.execution_url ? `${window.location.origin}${envUrl(environment.id, row.execution_url)}` : '';
            const user = row.user ? (row.user.username ?? row.user.name ?? row.user.id) : '';
            lines.push(`| ${row.timestamp} | ${source} | ${(row.message ?? '').replace(/\|/g, '\\|')} | ${user || 'guest'} | ${link} |`);
        });
        lines.push('');
    }

    if (issue.activityLogs.length > 0) {
        lines.push('## Activity', '');
        issue.activityLogs.forEach((log) => {
            const comment = log.payload.comment ? `: ${log.payload.comment}` : '';
            lines.push(`- ${log.timestamp} ${log.user?.name ?? 'Raccoon'} ${log.event.replace(/_/g, ' ')}${comment}`);
        });
    }

    return lines.join('\n').trim() + '\n';
}
