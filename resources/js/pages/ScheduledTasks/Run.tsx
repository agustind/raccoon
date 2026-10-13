import { StatusText } from '@/components/rc/badges';
import ExecutionDetail, { DateRow, YesNo } from '@/components/rc/commands-detail';
import { DeploymentRow } from '@/components/rc/execution-details';
import { KeyValue } from '@/components/rc/key-value';
import { CronForHumans } from '@/components/rc/scheduled-tasks-cron';
import EnvironmentLayout from '@/layouts/environment-layout';
import { executionToMarkdown } from '@/lib/export-markdown';
import { formatBytes, formatDuration } from '@/lib/format';
import { envUrl, withPeriod } from '@/lib/rc';
import type { Deployment, EventSummary, ExceptionRow, Execution, IssueLink, LogRow, PageProps } from '@/types/raccoon';
import { usePage } from '@inertiajs/react';

interface Props {
    run: {
        trace_id: string;
        timestamp: string;
        group: string;
        name: string;
        cron: string;
        timezone: string;
        repeat_seconds: number;
        status: string;
        duration: number;
        deploy: string;
        server: string;
        peak_memory_usage: number;
        exception_preview: string;
        context: string;
        without_overlapping: boolean;
        on_one_server: boolean;
        run_in_background: boolean;
        even_in_maintenance_mode: boolean;
        events: number;
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

export default function ScheduledTasksRun(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const run = props.run;

    return (
        <EnvironmentLayout
            title={run.name}
            heading={
                <span className="flex items-center gap-3">
                    <span className="truncate">{run.name}</span>
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs font-normal text-zinc-700 uppercase">
                        <CronForHumans cron={run.cron} repeatSeconds={run.repeat_seconds} timezone={run.timezone} className="max-w-64" />
                    </span>
                </span>
            }
            breadcrumbs={[
                { title: 'Scheduled Tasks', href: withPeriod(envUrl(env.id, 'scheduled-tasks')) },
                { title: run.name, href: withPeriod(envUrl(env.id, `scheduled-tasks/${run.group}`)) },
            ]}
            exportMarkdown={() =>
                executionToMarkdown({
                    title: run.name,
                    kind: 'scheduled task run',
                    fields: [
                        ['Status', run.status],
                        ['Schedule', `${run.cron}${run.repeat_seconds ? ` every ${run.repeat_seconds}s` : ''} (${run.timezone})`],
                        ['Date', `${run.timestamp} UTC`],
                        ['Duration', formatDuration(run.duration)],
                        ['Server', run.server],
                        ['Peak memory', formatBytes(run.peak_memory_usage)],
                        ['Trace ID', run.trace_id],
                    ],
                    deployment: props.deployment,
                    summary: props.summary,
                    executions: props.executions,
                    currentId: run.trace_id,
                    exceptions: props.exceptions,
                    logs: props.logs,
                    blocks: [{ title: 'Context', content: run.context }],
                })
            }
        >
            <ExecutionDetail
                info={
                    <>
                        <DateRow value={run.timestamp} />
                        <KeyValue label="Status">
                            <StatusText status={run.status} />
                        </KeyValue>
                        <KeyValue label="Schedule">
                            {run.repeat_seconds > 0 ? `*/${run.repeat_seconds} ${run.cron}` : run.cron}{' '}
                            <span className="text-zinc-500">({run.timezone})</span>
                        </KeyValue>
                        <KeyValue label="Peak memory">{formatBytes(run.peak_memory_usage)}</KeyValue>
                        <KeyValue label="Server">{run.server}</KeyValue>
                        <DeploymentRow deploy={run.deploy} deployment={props.deployment} />
                        <KeyValue label="Without overlapping">
                            <YesNo value={run.without_overlapping} />
                        </KeyValue>
                        <KeyValue label="On one server">
                            <YesNo value={run.on_one_server} />
                        </KeyValue>
                        <KeyValue label="Run in background">
                            <YesNo value={run.run_in_background} />
                        </KeyValue>
                        <KeyValue label="Even in maintenance mode">
                            <YesNo value={run.even_in_maintenance_mode} />
                        </KeyValue>
                    </>
                }
                traceId={run.trace_id}
                context={run.context}
                events={run.events}
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
