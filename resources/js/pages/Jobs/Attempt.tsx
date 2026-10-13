import { StatusText } from '@/components/rc/badges';
import CodeBlock from '@/components/rc/code-block';
import CopyMarkdownButton from '@/components/rc/copy-markdown-button';
import { Collapsible, DeploymentRow, EventsSummary, ExceptionsCard, LogsCard } from '@/components/rc/execution-details';
import { AttemptSwitcher, type AttemptLink } from '@/components/rc/jobs-attempt-details';
import { attemptUrl } from '@/components/rc/jobs-details-drawer';
import { KeyValue } from '@/components/rc/key-value';
import { Card } from '@/components/rc/section';
import Timeline from '@/components/rc/timeline';
import Timestamp from '@/components/rc/timestamp';
import EnvironmentLayout from '@/layouts/environment-layout';
import { executionToMarkdown } from '@/lib/export-markdown';
import { formatBytes, formatDuration } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { AppUser, Deployment, EventSummary, ExceptionRow, Execution, IssueLink, LogRow, PageProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { ArrowUpRight } from 'lucide-react';

interface Props {
    attempt: {
        trace_id: string;
        timestamp: string;
        group: string;
        name: string;
        connection: string;
        queue: string;
        job_id: string;
        attempt: number;
        attempt_id: string;
        queued_at: string | null;
        status: string;
        server: string;
        deploy: string;
        duration: number;
        events: number;
        peak_memory_usage: number;
        user: AppUser;
        context: string;
        exception_preview: string;
    };
    deployment: Deployment | null;
    summary: EventSummary;
    attempts: AttemptLink[];
    attempts_count: number;
    exceptions: ExceptionRow[];
    logs: LogRow[];
    issues: IssueLink[];
    totalDuration: number;
    executions: Execution[];
    trace_job_attempts_loaded: number;
    trace_job_attempts_total: number;
}

export default function JobsAttempt(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const a = props.attempt;
    const hasContext = a.context && a.context !== '{}' && a.context !== '[]';
    const jobIssues = props.issues.filter((issue) => issue.group === a.group);

    return (
        <EnvironmentLayout
            title={a.name}
            breadcrumbs={[
                { title: 'Jobs', href: withPeriod(envUrl(env.id, 'jobs')) },
                { title: a.name, href: withPeriod(envUrl(env.id, `jobs/${a.group}`)) },
            ]}
            actions={
                <>
                    <CopyMarkdownButton
                        filename={`job-attempt-${a.attempt_id}.md`}
                        build={() =>
                            executionToMarkdown({
                                title: a.name,
                                kind: 'job attempt',
                                fields: [
                                    ['Status', a.status],
                                    ['Attempt', a.attempt],
                                    ['Date', `${a.timestamp} UTC`],
                                    ['Queued at', a.queued_at ? `${a.queued_at} UTC` : null],
                                    ['Duration', formatDuration(a.duration)],
                                    ['Connection', a.connection],
                                    ['Queue', a.queue],
                                    ['Server', a.server],
                                    ['Peak memory', formatBytes(a.peak_memory_usage)],
                                    ['Job ID', a.job_id],
                                    ['Attempt ID', a.attempt_id],
                                    ['Trace ID', a.trace_id],
                                ],
                                deployment: props.deployment,
                                summary: props.summary,
                                executions: props.executions,
                                currentId: a.attempt_id,
                                exceptions: props.exceptions,
                                logs: props.logs,
                                blocks: [{ title: 'Context', content: a.context }],
                            })
                        }
                    />
                    {props.attempts.length > 1 && (
                        <AttemptSwitcher
                            attempts={props.attempts}
                            current={a}
                            total={props.attempts_count}
                            href={(attempt) => attemptUrl(env.id, a.group, { job_id: a.job_id, attempt_id: attempt.attempt_id })}
                        />
                    )}
                </>
            }
        >
            {jobIssues.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {jobIssues.map((issue) => (
                        <Link
                            key={issue.ref}
                            href={envUrl(env.id, `issues/${issue.ref}`)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800"
                        >
                            #{issue.ref} {issue.title}
                        </Link>
                    ))}
                </div>
            )}

            <Card className="px-5 py-4">
                <h3 className="mb-1 text-base font-medium">Info</h3>
                <KeyValue label="Status">
                    <StatusText status={a.status} />
                </KeyValue>
                <KeyValue label="Queued">{a.queued_at ? <Timestamp value={a.queued_at} /> : 'Unknown'}</KeyValue>
                <KeyValue label="Date">
                    <Timestamp value={a.timestamp} />
                </KeyValue>
                <KeyValue label="Connection">{a.connection}</KeyValue>
                <KeyValue label="Queue">{a.queue}</KeyValue>
                <KeyValue label="Peak memory">{formatBytes(a.peak_memory_usage)}</KeyValue>
                <KeyValue label="Server">{a.server}</KeyValue>
                <DeploymentRow deploy={a.deploy} deployment={props.deployment} />

                {(a.user.id || a.user.name) && (
                    <>
                        <h3 className="mt-6 mb-1 text-base font-medium">User</h3>
                        {a.user.name && <KeyValue label="Name">{a.user.name}</KeyValue>}
                        {a.user.id && (
                            <KeyValue label="Username">
                                <Link
                                    href={withPeriod(envUrl(env.id, `users/${a.user.id}`))}
                                    className="inline-flex items-center gap-1 hover:underline"
                                >
                                    {a.user.username ?? a.user.id} <ArrowUpRight className="size-3.5" />
                                </Link>
                            </KeyValue>
                        )}
                    </>
                )}

                <EventsSummary summary={props.summary} events={a.events} duration={a.duration} />
            </Card>

            <ExceptionsCard exceptions={props.exceptions} issues={props.issues} />

            {hasContext && (
                <Collapsible title="Context" className="mt-6">
                    <CodeBlock code={a.context} json />
                </Collapsible>
            )}

            <LogsCard logs={props.logs} />

            <div className="mt-6">
                <Timeline executions={props.executions} currentId={a.attempt_id} />
                {props.trace_job_attempts_total > props.trace_job_attempts_loaded && (
                    <p className="mt-2 font-mono text-xs text-zinc-500">
                        Showing {props.trace_job_attempts_loaded} of {props.trace_job_attempts_total} job attempts in this trace.
                    </p>
                )}
            </div>
        </EnvironmentLayout>
    );
}
