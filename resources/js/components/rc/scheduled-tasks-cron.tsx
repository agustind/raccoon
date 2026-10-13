import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "every 10 seconds", "At 05 minutes past the hour", "At 01:00 PM, only on Monday"... */
export function describeCron(cron: string, repeatSeconds = 0): string {
    const parts = cron.trim().split(/\s+/);

    if (parts.length !== 5) return cron;

    const [minute, hour, dom, month, dow] = parts;
    const segments: string[] = [];

    if (repeatSeconds > 0) {
        segments.push(repeatSeconds === 1 ? 'Every second' : `Every ${repeatSeconds} seconds`);
        if (minute !== '*' || hour !== '*') segments.push(describeTime(minute, hour));
    } else {
        segments.push(describeTime(minute, hour));
    }

    if (dom !== '*' && dom !== '?') segments.push(describeField(dom, (v) => v, 'on day', 'of the month', 'days'));
    if (month !== '*') segments.push(describeField(month, (v) => MONTHS[Number(v)] ?? v, 'only in', '', 'months'));
    if (dow !== '*' && dow !== '?') segments.push(describeField(dow, (v) => DAYS[Number(v)] ?? v, 'only on', '', 'days of the week'));

    return segments.join(', ');
}

function describeTime(minute: string, hour: string): string {
    const isNumber = (value: string) => /^\d+$/.test(value);
    const step = (value: string) => value.match(/^\*\/(\d+)$/)?.[1];

    if (minute === '*' && hour === '*') return 'Every minute';
    if (step(minute) && hour === '*') return `Every ${step(minute)} minutes`;
    if (isNumber(minute) && /^\d+(,\d+)*$/.test(hour))
        return `At ${hour
            .split(',')
            .map((h) => clock(Number(h), Number(minute)))
            .join(' and ')}`;

    const pastHour = isNumber(minute) ? (Number(minute) === 0 ? null : `At ${minute.padStart(2, '0')} minutes past the hour`) : null;

    if (isNumber(minute) && hour === '*') return pastHour ?? 'Every hour';
    if (isNumber(minute) && step(hour)) return pastHour ? `${pastHour}, every ${step(hour)} hours` : `Every ${step(hour)} hours`;

    return `At minute ${minute} past hour ${hour}`;
}

function describeField(value: string, name: (value: string) => string, single: string, suffix: string, plural: string): string {
    const withSuffix = (text: string) => (suffix ? `${text} ${suffix}` : text);
    const stepMatch = value.match(/^(\*|\d+-\d+)\/(\d+)$/);

    if (stepMatch) return `every ${stepMatch[2]} ${plural}`;
    if (/^\d+$/.test(value)) return withSuffix(`${single} ${name(value)}`);

    const range = value.match(/^(\d+)-(\d+)$/);

    if (range) return withSuffix(`${name(range[1])} through ${name(range[2])}`);

    const list = value.split(',').map(name);

    return withSuffix(`${single} ${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
}

function clock(hour: number, minute: number): string {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;

    return `${String(h12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** Human cron description with the raw expression and timezone in a tooltip. */
export function CronForHumans({
    cron,
    repeatSeconds,
    timezone,
    className,
}: {
    cron: string;
    repeatSeconds: number;
    timezone: string;
    className?: string;
}) {
    const description = describeCron(cron, repeatSeconds);

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className={cn('block truncate', className)}>{description}</span>
                </TooltipTrigger>
                <TooltipContent className="border-zinc-800 bg-zinc-900 font-mono text-xs text-white normal-case">
                    {repeatSeconds > 0 ? `*/${repeatSeconds} ${cron}` : cron} ({timezone})<div className="mt-1 text-zinc-300">{description}</div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/**
 * Live countdown to the next run. The server sends upcoming run times
 * (computed from the cron expression in the task's timezone), so the
 * countdown moves on to the next one when a run time passes.
 */
export function CronCountdown({ nextRuns, className }: { nextRuns: string[]; className?: string }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);

        return () => clearInterval(timer);
    }, []);

    const next = nextRuns.map((run) => new Date(run).getTime()).find((time) => time > now);

    return (
        <span className={cn('whitespace-nowrap', className)}>
            {next === undefined ? (nextRuns.length ? 'Now' : 'Unknown') : formatCountdown(next - now)}
        </span>
    );
}

function formatCountdown(ms: number): string {
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    let text = '';

    if (days > 0) text += `${days}d `;
    if (hours > 0 || days > 0) text += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) text += `${minutes}m `;

    return `${text}${seconds}s`;
}
