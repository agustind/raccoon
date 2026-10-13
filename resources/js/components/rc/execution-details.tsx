// Detail cards shared by the execution pages: Requests/Show, Jobs/Attempt,
// Commands/Execution and ScheduledTasks/Run.
import { formatDuration } from '@/lib/format';
import { envUrl } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { Deployment, EventSummary, ExceptionRow, IssueLink, LogRow, PageProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, ChevronsUpDown } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { KeyValue } from './key-value';
import { Card } from './section';
import Timestamp from './timestamp';

export function DeploymentRow({ deploy, deployment }: { deploy: string; deployment: Deployment | null }) {
    if (!deploy) return null;

    const label = deployment?.ref ? deployment.ref.slice(0, 7) : deploy.slice(0, 12);

    return (
        <KeyValue label="Deployment">
            <span className="inline-flex items-center gap-2">
                <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs">{label}</span>
                {deployment?.name && (
                    <span className="max-w-xl truncate">
                        {deployment.url ? (
                            <a href={deployment.url} target="_blank" rel="noreferrer" className="hover:underline">
                                {deployment.name.split('\n')[0]}
                            </a>
                        ) : (
                            deployment.name.split('\n')[0]
                        )}
                    </span>
                )}
            </span>
        </KeyValue>
    );
}

const SUMMARY_LABELS: [keyof EventSummary, string][] = [
    ['queries', 'Queries'],
    ['outgoing_requests', 'Outgoing requests'],
    ['mail', 'Mail'],
    ['notifications', 'Notifications'],
    ['cache_events', 'Cache'],
    ['queued_jobs', 'Queued jobs'],
];

export function EventsSummary({ summary, events, duration }: { summary: EventSummary; events: number; duration: number }) {
    return (
        <>
            <div className="mt-6 mb-1 flex items-center justify-between">
                <h3 className="text-base font-medium">Events</h3>
                <div className="flex divide-x divide-zinc-200 rounded-md border border-zinc-200 font-mono text-xs">
                    <span className="px-2 py-1">
                        <span className="text-zinc-500">EVENTS</span> {events}
                    </span>
                    <span className="px-2 py-1">
                        <span className="text-zinc-500">DURATION</span> {formatDuration(duration)}
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-x-10">
                {SUMMARY_LABELS.map(([key, label]) => (
                    <KeyValue key={key} label={label}>
                        {summary[key].count} <span className="text-zinc-500">EVENTS</span>
                        {summary[key].count > 0 && <> / {formatDuration(summary[key].duration)}</>}
                    </KeyValue>
                ))}
            </div>
        </>
    );
}

export function ExceptionsCard({ exceptions, issues }: { exceptions: ExceptionRow[]; issues: IssueLink[] }) {
    const { auth } = usePage<PageProps>().props;

    if (exceptions.length === 0) return null;

    return (
        <Card className="mt-6">
            <div className="border-b border-zinc-200 px-5 py-3.5 text-base font-medium">Exceptions</div>
            <div className="divide-y divide-zinc-100">
                {exceptions.map((exception, index) => {
                    const issue = issues.find((i) => i.group === exception.group);

                    return (
                        <div key={index} className="flex items-start justify-between gap-4 px-5 py-3">
                            <div className="min-w-0">
                                <div className="font-mono text-sm text-rose-600">{exception.class}</div>
                                <div className="mt-0.5 text-sm text-zinc-700">{exception.message}</div>
                                <div className="mt-1 font-mono text-xs text-zinc-500">
                                    {exception.file}:{exception.line} · {exception.handled ? 'handled' : 'unhandled'}
                                </div>
                            </div>
                            <Link
                                href={issue ? envUrl(auth.env!.id, `issues/${issue.ref}`) : envUrl(auth.env!.id, `exceptions/${exception.group}`)}
                                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                            >
                                <ArrowUpRight className="size-3.5" />
                            </Link>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

const LEVEL_COLORS: Record<string, string> = {
    emergency: 'text-rose-700',
    alert: 'text-rose-700',
    critical: 'text-rose-700',
    error: 'text-rose-600',
    warning: 'text-amber-600',
    notice: 'text-blue-600',
    info: 'text-blue-600',
    debug: 'text-zinc-500',
};

export function LogsCard({ logs }: { logs: LogRow[] }) {
    if (logs.length === 0) return null;

    return (
        <Card className="mt-6">
            <div className="border-b border-zinc-200 px-5 py-3.5 text-base font-medium">Logs</div>
            <div className="divide-y divide-zinc-100 font-mono text-xs">
                {logs.map((log, index) => (
                    <div key={index} className="grid grid-cols-[200px_80px_minmax(0,1fr)] gap-4 px-5 py-2.5">
                        <Timestamp value={log.timestamp} className="text-zinc-600" />
                        <span className={cn('uppercase', LEVEL_COLORS[log.level] ?? 'text-zinc-600')}>{log.level}</span>
                        <span className="break-words text-zinc-800">
                            {log.message}
                            {log.context && log.context !== '{}' && <span className="block text-zinc-500">{log.context}</span>}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

export function Collapsible({
    title,
    children,
    className,
    defaultOpen = false,
}: {
    title: string;
    children: ReactNode;
    className?: string;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Card className={className}>
            <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                <span className="text-base font-medium">{title}</span>
                <span className="flex size-6 items-center justify-center rounded-md border border-zinc-200">
                    <ChevronsUpDown className="size-3.5 text-zinc-500" />
                </span>
            </button>
            {open && <div className="px-5 pb-5">{children}</div>}
        </Card>
    );
}
