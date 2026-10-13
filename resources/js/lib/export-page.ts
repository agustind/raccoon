// Generic Markdown export of any dashboard page, built from its Inertia props.
// Pages with richer structure (execution pages, issues) pass their own exporter
// to EnvironmentLayout instead.

import { formatBytes, formatDuration } from './format';

const SKIP = new Set([
    'auth',
    'errors',
    'flash',
    'name',
    'deployments',
    'sortBy',
    'sortDirection',
    'activeUserFilter',
    'period',
    'from',
    'to',
    'now',
]);

/** Keys holding microsecond durations or byte sizes, formatted for reading. */
const DURATION_KEYS = /(^|_)(duration|avg|p95|p99|min|max|threshold_duration|total_duration|totalDuration)$/;
const BYTE_KEYS = /(_size|peak_memory_usage|memory)$/;

const MAX_ROWS = 100;

export function pageToMarkdown(title: string, props: Record<string, unknown>): string {
    const lines: string[] = [`# ${title}`, '', `Exported from Raccoon: ${window.location.href}`];

    if (typeof props.from === 'string' && typeof props.to === 'string') {
        lines.push(`Period: ${props.from} to ${props.to} (UTC)`);
    }

    if (typeof props.activeUserFilter === 'string' && props.activeUserFilter) {
        lines.push(`Filtered to user: ${props.activeUserFilter}`);
    }

    lines.push('');

    Object.entries(props).forEach(([key, value]) => {
        if (SKIP.has(key) || value === null || value === undefined) return;

        const section = render(key, value);

        if (section) {
            lines.push(`## ${humanize(key)}`, '', section, '');
        }
    });

    return lines.join('\n').trim() + '\n';
}

function render(key: string, value: unknown): string | null {
    if (Array.isArray(value)) {
        return renderArray(value);
    }

    if (isObject(value)) {
        // Laravel paginators: render the page of data and say where it is.
        if (Array.isArray(value.data)) {
            const table = renderArray(value.data);
            const total = typeof value.total === 'number' ? `${value.total} total` : null;
            const page =
                typeof value.current_page === 'number' && typeof value.last_page === 'number'
                    ? `page ${value.current_page} of ${value.last_page}`
                    : null;
            const more = value.next_page_url || value.next_cursor ? 'more rows on the next page' : null;
            const note = [total, page, more].filter(Boolean).join(', ');

            return [table, note ? `\n_${note}_` : ''].join('');
        }

        return Object.entries(value)
            .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
            .map(([k, v]) => `- **${humanize(k)}:** ${formatValue(k, v)}`)
            .join('\n');
    }

    return formatValue(key, value);
}

function renderArray(rows: unknown[]): string | null {
    if (rows.length === 0) return '_none_';

    if (!rows.every(isObject)) {
        return rows
            .slice(0, MAX_ROWS)
            .map((row) => `- ${formatValue('', row)}`)
            .join('\n');
    }

    // Chart series: keep only buckets with data, they are mostly empty.
    const objects = rows as Record<string, unknown>[];
    const isSeries = 'bucket' in objects[0];
    const filtered = isSeries
        ? objects.filter((row) => Object.entries(row).some(([k, v]) => k !== 'bucket' && typeof v === 'number' && v > 0))
        : objects;

    if (filtered.length === 0) return '_no data in this period_';

    const columns = [...new Set(filtered.flatMap((row) => Object.keys(row)))].filter(
        (column) => !['group', 'trace_id', 'execution_id'].includes(column) || !isSeries,
    );
    const shown = filtered.slice(0, MAX_ROWS);
    const header = `| ${columns.map(humanize).join(' | ')} |`;
    const divider = `| ${columns.map(() => '---').join(' | ')} |`;
    const body = shown.map((row) => `| ${columns.map((column) => cell(column, row[column])).join(' | ')} |`);
    const note = filtered.length > shown.length ? [`\n_${filtered.length - shown.length} more rows not shown_`] : [];

    return [isSeries ? '_Non-empty time buckets only._\n' : '', header, divider, ...body, ...note].join('\n');
}

function cell(key: string, value: unknown): string {
    return formatValue(key, value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function formatValue(key: string, value: unknown): string {
    if (value === null || value === undefined) return '';

    if (typeof value === 'number') {
        if (key === 'threshold' || key === 'threshold_ms') return `${value}ms`;
        if (DURATION_KEYS.test(key)) return formatDuration(value);
        if (BYTE_KEYS.test(key)) return formatBytes(value);

        return String(value);
    }

    if (typeof value === 'boolean') return value ? 'yes' : 'no';

    if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;

    if (Array.isArray(value) && value.every((item) => typeof item !== 'object')) return value.join(', ');

    if (isObject(value) && ('username' in value || 'name' in value) && 'id' in value) {
        return String(value.username ?? value.name ?? value.id ?? '');
    }

    const json = JSON.stringify(value);

    return json.length > 300 ? `${json.slice(0, 300)}…` : json;
}

function humanize(key: string): string {
    const words = key
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim();

    return words.charAt(0).toUpperCase() + words.slice(1);
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
