import { Pill } from '@/components/rc/badges';
import ExecutionDetail, { DateRow } from '@/components/rc/commands-detail';
import CopyMarkdownButton from '@/components/rc/copy-markdown-button';
import { DeploymentRow } from '@/components/rc/execution-details';
import { KeyValue } from '@/components/rc/key-value';
import EnvironmentLayout from '@/layouts/environment-layout';
import { executionToMarkdown } from '@/lib/export-markdown';
import { formatBytes, formatDuration } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { Deployment, EventSummary, ExceptionRow, Execution, IssueLink, LogRow, PageProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';

interface Props {
    command: {
        trace_id: string;
        timestamp: string;
        group: string;
        class: string;
        name: string;
        command: string;
        exit_code: number;
        duration: number;
        deploy: string;
        server: string;
        peak_memory_usage: number;
        exception_preview: string;
        context: string;
        events: number;
        stages: Record<string, number>;
    };
    deployment: Deployment | null;
    summary: EventSummary;
    slowest: null;
    exceptions: ExceptionRow[];
    logs: LogRow[];
    issues: IssueLink[];
    totalDuration: number;
    executions: Execution[];
    trace_job_attempts_loaded: number;
    trace_job_attempts_total: number;
}

export default function CommandsExecution(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const c = props.command;

    return (
        <EnvironmentLayout
            title={c.command}
            breadcrumbs={[
                { title: 'Commands', href: withPeriod(envUrl(env.id, 'commands')) },
                { title: c.name, href: withPeriod(envUrl(env.id, `commands/${c.group}`)) },
            ]}
            actions={
                <CopyMarkdownButton
                    filename={`command-${c.trace_id}.md`}
                    build={() =>
                        executionToMarkdown({
                            title: c.command,
                            kind: 'command',
                            fields: [
                                ['Exit code', c.exit_code],
                                ['Date', `${c.timestamp} UTC`],
                                ['Duration', formatDuration(c.duration)],
                                ['Class', c.class],
                                ['Server', c.server],
                                ['Peak memory', formatBytes(c.peak_memory_usage)],
                                ['Trace ID', c.trace_id],
                            ],
                            deployment: props.deployment,
                            summary: props.summary,
                            executions: props.executions,
                            currentId: c.trace_id,
                            exceptions: props.exceptions,
                            logs: props.logs,
                            blocks: [{ title: 'Context', content: c.context }],
                        })
                    }
                />
            }
        >
            <ExecutionDetail
                info={
                    <>
                        <KeyValue label="Exit code">
                            <Pill tone={c.exit_code === 0 ? 'success' : 'danger'}>{c.exit_code}</Pill>
                        </KeyValue>
                        <DateRow value={c.timestamp} />
                        {c.class && <KeyValue label="Class">{c.class}</KeyValue>}
                        <KeyValue label="Peak memory">{formatBytes(c.peak_memory_usage)}</KeyValue>
                        <KeyValue label="Server">{c.server}</KeyValue>
                        <DeploymentRow deploy={c.deploy} deployment={props.deployment} />
                    </>
                }
                traceId={c.trace_id}
                context={c.context}
                events={c.events}
                summary={props.summary}
                exceptions={props.exceptions}
                logs={props.logs}
                issues={props.issues}
                totalDuration={props.totalDuration}
                executions={props.executions}
                jobAttemptsLoaded={props.trace_job_attempts_loaded}
                jobAttemptsTotal={props.trace_job_attempts_total}
            />
        </EnvironmentLayout>
    );
}
