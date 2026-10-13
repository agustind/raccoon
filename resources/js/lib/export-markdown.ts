// Markdown export of an execution page (request, job attempt, command,
// scheduled task run), meant to be pasted into an AI assistant for debugging.

import type { Deployment, EventSummary, ExceptionRow, Execution, LogRow, Span } from '@/types/raccoon';
import { formatDate, formatDuration } from './format';

export interface ExecutionExport {
    /** e.g. "GET /messages/guardians" */
    title: string;
    /** request, job attempt, command, scheduled task run */
    kind: string;
    /** Label/value pairs shown under Details. Empty values are skipped. */
    fields: [string, string | number | null | undefined][];
    deployment?: Deployment | null;
    summary?: EventSummary;
    executions: Execution[];
    /** The execution this page is about; its spans are exported in full. */
    currentId: string;
    exceptions: ExceptionRow[];
    logs: LogRow[];
    /** Extra JSON blocks: headers, payload, context. */
    blocks?: { title: string; content: string | null | undefined }[];
}

const SPAN_LABELS: Record<Span['span_type'], string> = {
    query: 'query',
    cache_event: 'cache',
    outgoing_request: 'http',
    mail: 'mail',
    notification: 'notification',
    queued_job: 'job dispatch',
    exception: 'exception',
};

export function executionToMarkdown(data: ExecutionExport): string {
    const lines: string[] = [];
    const push = (...more: string[]) => lines.push(...more);

    push(`# ${data.title} (${data.kind})`, '');
    push(`Exported from Raccoon: ${window.location.href}`, '');

    push('## Details', '');
    data.fields
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .forEach(([label, value]) => push(`- **${label}:** ${value}`));

    if (data.deployment) {
        const d = data.deployment;
        push(`- **Deployment:** ${[d.ref?.slice(0, 7) ?? d.deploy, d.name?.split('\n')[0]].filter(Boolean).join(' ')}`);
    }

    push('');

    if (data.summary) {
        push('## Events', '', '| Type | Count | Total time |', '| --- | ---: | ---: |');
        Object.entries(data.summary).forEach(([type, { count, duration }]) =>
            push(`| ${type.replace('_', ' ')} | ${count} | ${count ? formatDuration(duration) : '-'} |`),
        );
        push('');
    }

    const current = data.executions.find((execution) => execution.id === data.currentId) ?? data.executions[0];
    const spans = current ? current.stages.flatMap((stage) => stage.spans.map((span) => ({ ...span, stage: stage.name }))) : [];

    if (current) {
        push('## Stages', '');
        current.stages
            .filter((stage) => stage.duration > 0 || stage.spans.length > 0)
            .forEach((stage) =>
                push(`- ${stage.name}: ${formatDuration(stage.duration)}, ${stage.spans.length} ${stage.spans.length === 1 ? 'event' : 'events'}`),
            );
        push('');
    }

    const repeated = repeatedQueries(spans);

    if (repeated.length > 0) {
        push('## Repeated queries', '', 'Same SQL run more than once in this execution (possible N+1):', '');
        repeated.forEach((query) => {
            push(`- ${query.count}x, ${formatDuration(query.total)} total${query.locations.length ? `, from ${query.locations.join(', ')}` : ''}`);
            push('', '```sql', query.sql, '```', '');
        });
    }

    const slowest = [...spans]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .filter((span) => span.duration > 0);

    if (slowest.length > 0) {
        push('## Slowest events', '');
        slowest.forEach((span) =>
            push(`- ${formatDuration(span.duration)} ${SPAN_LABELS[span.span_type]}: ${oneLine(span.description)}${location(span)}`),
        );
        push('');
    }

    if (spans.length > 0) {
        push('## Timeline', '', 'Offset from the start of the execution, duration, type, details.', '');
        spans.forEach((span) => {
            const meta = [span.connection, span.connection_type, span.queue].filter(Boolean).join(', ');
            push(
                `- +${formatDuration(span.offset)} | ${formatDuration(span.duration)} | ${SPAN_LABELS[span.span_type]}${meta ? ` (${meta})` : ''} | ${span.stage}${location(span)}`,
            );

            if (span.span_type === 'query') {
                push('', '  ```sql', `  ${span.description}`, '  ```', '');
            } else {
                push(`  ${oneLine(span.description)}`);
            }
        });
        push('');
    }

    const others = data.executions.filter((execution) => execution !== current);

    if (others.length > 0) {
        push('## Other executions in this trace', '');
        others.forEach((execution) =>
            push(
                `- ${execution.name.replace('_', ' ')} ${execution.description}: ${formatDuration(execution.duration)}, status ${execution.status}, starts at +${formatDuration(execution.offset)}`,
            ),
        );
        push('');
    }

    if (data.exceptions.length > 0) {
        push('## Exceptions', '');
        data.exceptions.forEach((exception) => {
            push(
                `- **${exception.class}** (${exception.handled ? 'handled' : 'unhandled'}) at ${exception.file}:${exception.line}`,
                `  ${oneLine(exception.message)}`,
            );
        });
        push('');
    }

    if (data.logs.length > 0) {
        push('## Logs', '');
        data.logs.forEach((log) => {
            push(`- ${formatDate(log.timestamp)} UTC [${log.level}] ${oneLine(log.message)}`);

            if (log.context && log.context !== '{}' && log.context !== '[]') {
                push(`  context: ${log.context}`);
            }
        });
        push('');
    }

    (data.blocks ?? []).forEach((block) => {
        if (block.content && block.content !== '{}' && block.content !== '[]') {
            push(`## ${block.title}`, '', '```json', prettyJson(block.content), '```', '');
        }
    });

    return lines.join('\n').trim() + '\n';
}

function repeatedQueries(spans: (Span & { stage: string })[]): { sql: string; count: number; total: number; locations: string[] }[] {
    const groups = new Map<string, { sql: string; count: number; total: number; locations: Set<string> }>();

    spans
        .filter((span) => span.span_type === 'query')
        .forEach((span) => {
            const group = groups.get(span.description) ?? { sql: span.description, count: 0, total: 0, locations: new Set<string>() };
            group.count++;
            group.total += span.duration;

            if (span.file) {
                group.locations.add(`${span.file}:${span.line}`);
            }

            groups.set(span.description, group);
        });

    return [...groups.values()]
        .filter((group) => group.count > 1)
        .sort((a, b) => b.total - a.total)
        .map((group) => ({ ...group, locations: [...group.locations] }));
}

function location(span: Span): string {
    return span.file ? ` @ ${span.file}${span.line ? `:${span.line}` : ''}` : '';
}

function oneLine(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function prettyJson(content: string): string {
    try {
        return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
        return content;
    }
}
