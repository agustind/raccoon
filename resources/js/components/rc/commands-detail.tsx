import { cn } from '@/lib/utils';
import type { EventSummary, ExceptionRow, Execution, IssueLink, LogRow } from '@/types/raccoon';
import { ReactNode } from 'react';
import CodeBlock from './code-block';
import { Collapsible, EventsSummary, ExceptionsCard, LogsCard } from './execution-details';
import { KeyValue } from './key-value';
import { Card } from './section';
import Timeline from './timeline';
import Timestamp from './timestamp';

// Detail page body shared by Commands/Execution and ScheduledTasks/Run.

interface Props {
    /** KeyValue rows for the Info section. */
    info: ReactNode;
    traceId: string;
    context: string;
    events: number;
    summary: EventSummary;
    exceptions: ExceptionRow[];
    logs: LogRow[];
    issues: IssueLink[];
    totalDuration: number;
    executions: Execution[];
    jobAttemptsLoaded: number;
    jobAttemptsTotal: number;
}

export default function ExecutionDetail(props: Props) {
    const hasContext = Boolean(props.context && props.context !== '{}' && props.context !== '[]');

    return (
        <>
            <Card className="px-5 py-5">
                <h3 className="mb-1 text-base font-medium">Info</h3>
                {props.info}
                <EventsSummary summary={props.summary} events={props.events} duration={props.totalDuration} />
            </Card>

            <ExceptionsCard exceptions={props.exceptions} issues={props.issues} />

            {hasContext && (
                <Collapsible title="Context" className="mt-6">
                    <CodeBlock code={props.context} json />
                </Collapsible>
            )}

            <div className="mt-6">
                <Timeline executions={props.executions} currentId={props.traceId} />
                {props.jobAttemptsTotal > props.jobAttemptsLoaded && (
                    <p className="mt-2 font-mono text-xs text-zinc-500">
                        Showing {props.jobAttemptsLoaded} of {props.jobAttemptsTotal} job attempts in this trace.
                    </p>
                )}
            </div>

            <LogsCard logs={props.logs} />
        </>
    );
}

/** Yes/No value for schedule flags. */
export function YesNo({ value }: { value: boolean }) {
    return <span className={cn(!value && 'text-zinc-500')}>{value ? 'Yes' : 'No'}</span>;
}

/** Info timestamp row. */
export function DateRow({ value }: { value: string }) {
    return (
        <KeyValue label="Date">
            <Timestamp value={value} />
        </KeyValue>
    );
}
