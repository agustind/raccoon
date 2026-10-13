import { MethodPill, StatusPill } from '@/components/rc/badges';
import CodeBlock from '@/components/rc/code-block';
import CopyMarkdownButton from '@/components/rc/copy-markdown-button';
import { Collapsible, DeploymentRow, EventsSummary, ExceptionsCard, LogsCard } from '@/components/rc/execution-details';
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
import { ArrowUpRight, Globe } from 'lucide-react';

interface Props {
    request: {
        trace_id: string;
        timestamp: string;
        group: string;
        method: string;
        url: string;
        route_name: string;
        route_methods: string[];
        route_domain: string;
        route_path: string;
        route_action: string;
        status_code: number;
        duration: number;
        deploy: string;
        server: string;
        ip: string;
        request_size: number;
        response_size: number;
        peak_memory_usage: number;
        context: string;
        headers: string;
        payload: string;
        exception_preview: string;
        events: number;
        user: AppUser;
        stages: Record<string, number>;
    };
    deployment: Deployment | null;
    summary: EventSummary;
    exceptions: ExceptionRow[];
    logs: LogRow[];
    issues: IssueLink[];
    totalDuration: number;
    executions: Execution[];
    trace_job_attempts_loaded: number;
    trace_job_attempts_total: number;
}

export default function RequestsShow(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const r = props.request;

    return (
        <EnvironmentLayout
            title={`${r.method} ${r.route_path || r.url}`}
            heading={
                <>
                    <MethodPill methods={r.method} />
                    {r.route_path || r.url}
                </>
            }
            breadcrumbs={[
                { title: 'Requests', href: withPeriod(envUrl(env.id, 'requests')) },
                { title: r.route_path || 'Route', href: withPeriod(envUrl(env.id, `requests/routes/${r.group}`)) },
            ]}
            actions={
                <CopyMarkdownButton
                    filename={`request-${r.trace_id}.md`}
                    build={() =>
                        executionToMarkdown({
                            title: `${r.method} ${r.route_path || r.url}`,
                            kind: 'request',
                            fields: [
                                ['URL', `${r.method} ${r.url}`],
                                ['Date', `${r.timestamp} UTC`],
                                ['Status', r.status_code],
                                ['Duration', formatDuration(r.duration)],
                                ['Route', r.route_name],
                                ['Action', r.route_action],
                                ['Server', r.server],
                                ['Request size', formatBytes(r.request_size)],
                                ['Response size', formatBytes(r.response_size)],
                                ['Peak memory', formatBytes(r.peak_memory_usage)],
                                ['User', r.user.username ?? r.user.name ?? (r.user.id || 'guest')],
                                ['IP', r.ip],
                                ['Trace ID', r.trace_id],
                            ],
                            deployment: props.deployment,
                            summary: props.summary,
                            executions: props.executions,
                            currentId: r.trace_id,
                            exceptions: props.exceptions,
                            logs: props.logs,
                            blocks: [
                                { title: 'Headers', content: r.headers },
                                { title: 'Payload', content: r.payload },
                                { title: 'Context', content: r.context },
                            ],
                        })
                    }
                />
            }
        >
            <Card>
                <div className="flex items-center gap-2 border-b border-zinc-200 px-5 py-3.5 font-mono text-sm">
                    <Globe className="size-4 text-emerald-600" />
                    <span className="font-medium">{r.method}</span>
                    <span className="truncate">{r.url}</span>
                </div>
                <div className="px-5 py-3">
                    <KeyValue label="Date">
                        <Timestamp value={r.timestamp} />
                    </KeyValue>
                    <KeyValue label="Status code">
                        <StatusPill code={r.status_code} />
                    </KeyValue>
                    {r.route_name && <KeyValue label="Route name">{r.route_name}</KeyValue>}
                    {r.route_action && <KeyValue label="Action">{r.route_action}</KeyValue>}
                    <KeyValue label="Server">{r.server}</KeyValue>
                    <KeyValue label="Request size">{formatBytes(r.request_size)}</KeyValue>
                    <KeyValue label="Response size">{formatBytes(r.response_size)}</KeyValue>
                    <KeyValue label="Peak memory">{formatBytes(r.peak_memory_usage)}</KeyValue>
                    <DeploymentRow deploy={r.deploy} deployment={props.deployment} />

                    <h3 className="mt-6 mb-1 text-base font-medium">User</h3>
                    <KeyValue label={r.user.username ? 'Username' : 'ID'}>
                        {r.user.id ? (
                            <Link href={withPeriod(envUrl(env.id, `users/${r.user.id}`))} className="inline-flex items-center gap-1 hover:underline">
                                {r.user.username ?? r.user.name ?? r.user.id} <ArrowUpRight className="size-3.5" />
                            </Link>
                        ) : (
                            <span className="text-zinc-400">Guest</span>
                        )}
                    </KeyValue>
                    <KeyValue label="IP">{r.ip || '—'}</KeyValue>

                    <EventsSummary summary={props.summary} events={r.events} duration={props.totalDuration} />
                </div>
            </Card>

            <ExceptionsCard exceptions={props.exceptions} issues={props.issues} />

            <Collapsible title="Headers" className="mt-6">
                <CodeBlock code={r.headers} json />
            </Collapsible>

            {r.payload && (
                <Collapsible title="Payload" className="mt-3">
                    <CodeBlock code={r.payload} json />
                </Collapsible>
            )}

            {r.context && r.context !== '{}' && r.context !== '[]' && (
                <Collapsible title="Context" className="mt-3">
                    <CodeBlock code={r.context} json />
                </Collapsible>
            )}

            <div className="mt-6">
                <Timeline executions={props.executions} currentId={r.trace_id} />
                {props.trace_job_attempts_total > props.trace_job_attempts_loaded && (
                    <p className="mt-2 font-mono text-xs text-zinc-500">
                        Showing {props.trace_job_attempts_loaded} of {props.trace_job_attempts_total} job attempts in this trace.
                    </p>
                )}
            </div>

            <LogsCard logs={props.logs} />
        </EnvironmentLayout>
    );
}
