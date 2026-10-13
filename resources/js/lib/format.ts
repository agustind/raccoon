// Formatting helpers. Durations from the backend are microseconds.

export function formatDuration(micros: number | null | undefined): string {
    if (micros === null || micros === undefined || Number.isNaN(micros)) {
        return '—';
    }

    if (micros < 1000) {
        return `${trim(micros)}μs`;
    }

    const ms = micros / 1000;

    if (ms < 1000) {
        return `${trim(ms)}ms`;
    }

    const s = ms / 1000;

    if (s < 60) {
        return `${trim(s)}s`;
    }

    const minutes = Math.floor(s / 60);
    const seconds = Math.round(s % 60);

    if (minutes < 60) {
        return seconds ? `${minutes}min ${seconds}s` : `${minutes}min`;
    }

    const hours = Math.floor(minutes / 60);

    return `${hours}h ${minutes % 60}min`;
}

export function formatDurationRange(min: number | null, max: number | null): string {
    if (min === null || max === null) {
        return '—';
    }

    return `${formatDuration(min)} - ${formatDuration(max)}`;
}

function trim(value: number): string {
    return String(Math.round(value * 100) / 100);
}

export function formatCompact(value: number | null | undefined): string {
    if (value === null || value === undefined) {
        return '—';
    }

    return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
        return '—';
    }

    return new Intl.NumberFormat('en').format(value);
}

export function formatBytes(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined) {
        return '—';
    }

    if (bytes < 1000) {
        return `${bytes} B`;
    }

    const units = ['kB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = -1;

    do {
        value /= 1000;
        unit++;
    } while (value >= 1000 && unit < units.length - 1);

    return `${Math.round(value * 100) / 100} ${units[unit]}`;
}

/** Parse "2026-10-12 20:42:23.391733" (UTC) or ISO strings into a Date. */
export function parseTimestamp(value: string): Date {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
        return new Date(value.replace(' ', 'T').replace(/(\.\d{3})\d*$/, '$1') + 'Z');
    }

    return new Date(value);
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
});

/** "Oct 12, 2026, 20:42:23" in UTC; render a muted "UTC" suffix next to it. */
export function formatDate(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }

    return dateFormatter.format(parseTimestamp(value));
}

export function timeAgo(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }

    const seconds = Math.round((Date.now() - parseTimestamp(value).getTime()) / 1000);
    const steps: [number, string][] = [
        [60, 'second'],
        [60, 'minute'],
        [24, 'hour'],
        [30, 'day'],
        [12, 'month'],
        [Infinity, 'year'],
    ];

    let amount = seconds;

    for (const [size, unit] of steps) {
        if (Math.abs(amount) < size) {
            const rounded = Math.max(1, Math.floor(amount));

            return `${rounded} ${unit}${rounded === 1 ? '' : 's'} ago`;
        }

        amount /= size;
    }

    return '—';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
    return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
