import { formatDuration } from '@/lib/format';
import { envUrl } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { Execution, Span } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import CodeBlock from './code-block';
import { KeyValue } from './key-value';
import { Card } from './section';

const EXECUTION_COLORS: Record<Execution['variant'], string> = {
    success: 'bg-emerald-100 border-emerald-300',
    warning: 'bg-amber-100 border-amber-300',
    danger: 'bg-rose-100 border-rose-300',
    default: 'bg-zinc-100 border-zinc-300',
};

const SPAN_COLORS: Record<string, string> = {
    query: 'bg-violet-400',
    cache_event: 'bg-sky-400',
    outgoing_request: 'bg-orange-400',
    mail: 'bg-pink-400',
    notification: 'bg-teal-400',
    queued_job: 'bg-zinc-500',
    exception: 'bg-rose-500',
};

/**
 * Waterfall of every execution in a trace. Bars are positioned by offset and
 * duration (microseconds) against a shared ruler.
 */
export default function Timeline({ executions, currentId }: { executions: Execution[]; currentId?: string }) {
    const { auth } = usePage<{ auth: { env: { id: string } | null } }>().props;
    // Spans can end after their execution (e.g. failed_jobs inserts), so size
    // the ruler to the furthest bar and leave room for duration labels.
    const total = useMemo(() => {
        const ends = executions.flatMap((e) => [e.offset + e.duration, ...e.stages.flatMap((s) => s.spans.map((span) => e.offset + span.offset + span.duration))]);

        return Math.max(1, ...ends) * 1.08;
    }, [executions]);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(executions.map((e) => [e.id, executions.length > 3 && e.id !== currentId])),
    );
    const [selected, setSelected] = useState<Span | null>(null);

    const ticks = useMemo(() => {
        const step = niceStep(total / 4);

        return Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step);
    }, [total]);

    const position = (offset: number, duration: number) => ({
        left: `${(offset / total) * 100}%`,
        width: `max(2px, ${(duration / total) * 100}%)`,
    });

    if (executions.length === 0) return null;

    return (
        <Card className="overflow-hidden">
            <div className="grid grid-cols-[280px_minmax(0,1fr)]">
                <div className="border-r border-b border-zinc-200 px-4 py-3 text-base font-medium">Timeline</div>
                <div className="relative border-b border-zinc-200">
                    {ticks.map((tick) => (
                        <span key={tick} className="absolute top-3 font-mono text-xs text-zinc-500" style={{ left: `calc(${(tick / total) * 100}% + 4px)` }}>
                            {formatDuration(tick)}
                        </span>
                    ))}
                </div>

                {executions.map((execution) => {
                    const isCollapsed = collapsed[execution.id];
                    const executionOffset = execution.offset;

                    return (
                        <Fragment key={execution.id}>
                            <button
                                type="button"
                                onClick={() => setCollapsed((c) => ({ ...c, [execution.id]: !c[execution.id] }))}
                                className={cn('flex items-center gap-2 border-r border-b border-zinc-100 px-3 py-2 text-left text-sm', execution.id === currentId && 'bg-zinc-50')}
                            >
                                {isCollapsed ? <ChevronRight className="size-3.5 shrink-0 text-zinc-400" /> : <ChevronDown className="size-3.5 shrink-0 text-zinc-400" />}
                                <span className="font-mono text-xs text-zinc-500 uppercase">{execution.name.replace('_', ' ')}</span>
                                <span className="min-w-0 flex-1 truncate font-mono text-xs">{execution.description}</span>
                                {execution.link && auth.env && execution.id !== currentId && (
                                    <Link
                                        href={envUrl(auth.env.id, `jobs/attempts/${execution.link.group}/${execution.link.job_id}/${execution.link.attempt_id}`)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-zinc-400 hover:text-zinc-900"
                                    >
                                        <ArrowUpRight className="size-3.5" />
                                    </Link>
                                )}
                            </button>
                            <Row>
                                <div className={cn('absolute top-1.5 bottom-1.5 rounded border', EXECUTION_COLORS[execution.variant])} style={position(executionOffset, execution.duration)}>
                                    <span className="absolute top-1/2 left-1.5 -translate-y-1/2 font-mono text-[11px] whitespace-nowrap text-zinc-700">{formatDuration(execution.duration)}</span>
                                </div>
                            </Row>

                            {!isCollapsed &&
                                execution.stages.map((stage) => (
                                    <Fragment key={`${execution.id}-${stage.id}`}>
                                        <div className="flex items-center gap-2 border-r border-b border-zinc-100 py-1.5 pr-3 pl-9 font-mono text-xs text-zinc-600">
                                            <span className="flex-1 truncate">{stage.name}</span>
                                            <span className="text-zinc-400">{stage.duration > 0 ? formatDuration(stage.duration) : ''}</span>
                                        </div>
                                        <Row>
                                            {stage.duration > 0 && (
                                                <div className="absolute top-2 bottom-2 rounded-sm bg-zinc-200" style={position(executionOffset + stage.offset, stage.duration)} />
                                            )}
                                        </Row>

                                        {stage.spans.map((span, index) => (
                                            <Fragment key={`${execution.id}-${stage.id}-${index}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelected(selected === span ? null : span)}
                                                    className={cn(
                                                        'flex items-center gap-2 border-r border-b border-zinc-100 py-1.5 pr-3 pl-14 text-left font-mono text-xs hover:bg-zinc-50',
                                                        selected === span && 'bg-blue-50',
                                                    )}
                                                >
                                                    <span className={cn('size-2 shrink-0 rounded-sm', SPAN_COLORS[span.span_type] ?? 'bg-zinc-400')} />
                                                    <span className="min-w-0 flex-1 truncate text-zinc-700" title={span.description}>
                                                        {span.span_type === 'query' ? span.description : `${span.name} ${span.description}`}
                                                    </span>
                                                </button>
                                                <Row onClick={() => setSelected(selected === span ? null : span)}>
                                                    <div
                                                        className={cn('absolute top-2 bottom-2 rounded-sm', SPAN_COLORS[span.span_type] ?? 'bg-zinc-400')}
                                                        style={position(executionOffset + span.offset, span.duration)}
                                                    />
                                                    <span
                                                        className="absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[11px] whitespace-nowrap text-zinc-500"
                                                        style={{ left: `${((executionOffset + span.offset + span.duration) / total) * 100}%` }}
                                                    >
                                                        {span.duration > 0 ? formatDuration(span.duration) : ''}
                                                    </span>
                                                </Row>
                                            </Fragment>
                                        ))}
                                    </Fragment>
                                ))}
                        </Fragment>
                    );
                })}
            </div>

            {selected && <SpanDetails span={selected} />}
        </Card>
    );
}

function Row({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) {
    return (
        <div onClick={onClick} className={cn('relative h-8 border-b border-zinc-100', onClick && 'cursor-pointer')}>
            {children}
        </div>
    );
}

function SpanDetails({ span }: { span: Span }) {
    return (
        <div className="border-t border-zinc-200 bg-zinc-50/50 p-5">
            <div className="mb-3 font-mono text-xs text-zinc-500 uppercase">{span.span_type.replace('_', ' ')}</div>
            {span.span_type === 'query' ? <CodeBlock code={span.description} className="mb-3 bg-white" /> : <div className="mb-3 font-mono text-sm break-all">{span.description}</div>}
            <div className="grid grid-cols-2 gap-x-10">
                <KeyValue label="Duration">{formatDuration(span.duration)}</KeyValue>
                <KeyValue label="Offset">{formatDuration(span.offset)}</KeyValue>
                {span.connection && <KeyValue label={span.span_type === 'cache_event' ? 'Store' : 'Connection'}>{span.connection}</KeyValue>}
                {span.connection_type && <KeyValue label="Type">{span.connection_type}</KeyValue>}
                {span.queue && <KeyValue label="Queue">{span.queue}</KeyValue>}
                {span.file && <KeyValue label="Location">{`${span.file}${span.line ? `:${span.line}` : ''}`}</KeyValue>}
            </div>
        </div>
    );
}

function niceStep(raw: number): number {
    if (raw <= 0) return 1;

    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const normalized = raw / magnitude;
    const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2.5 : normalized < 7.5 ? 5 : 10;

    return nice * magnitude;
}
