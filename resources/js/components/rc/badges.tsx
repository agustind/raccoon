import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export function MethodBadge({ methods, className }: { methods: string | string[]; className?: string }) {
    const list = Array.isArray(methods) ? methods : [methods];
    const isWrite = list.some((m) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m));
    const color = list.includes('DELETE') ? 'text-rose-600' : isWrite ? 'text-emerald-600' : 'text-zinc-700';

    return <span className={cn('font-mono text-xs font-medium', color, className)}>{list.join('|') || 'ANY'}</span>;
}

/** Pill used in page headings: "GET|HEAD" on a gray background. */
export function MethodPill({ methods }: { methods: string | string[] }) {
    return (
        <span className="mr-2 inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 align-middle">
            <MethodBadge methods={methods} />
        </span>
    );
}

export function StatusCode({ code, className }: { code: number; className?: string }) {
    const color = code >= 500 ? 'text-rose-600' : code >= 400 ? 'text-amber-600' : 'text-emerald-600';

    return <span className={cn('font-mono text-xs font-medium', color, className)}>{code}</span>;
}

/** Filled status badge, e.g. the status code in detail pages. */
export function StatusPill({ code }: { code: number }) {
    const color = code >= 500 ? 'bg-rose-50 text-rose-700' : code >= 400 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';

    return <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-xs', color)}>{code}</span>;
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
    neutral: 'bg-zinc-100 text-zinc-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-rose-50 text-rose-700',
    info: 'bg-blue-50 text-blue-700',
};

export function Pill({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
    return <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs uppercase', TONES[tone], className)}>{children}</span>;
}

/** processed / failed / released / skipped / handled / unhandled... */
export function StatusText({ status }: { status: string }) {
    const tone: Record<string, Tone> = {
        processed: 'success',
        success: 'success',
        sent: 'success',
        failed: 'danger',
        unhandled: 'danger',
        released: 'warning',
        skipped: 'warning',
        handled: 'neutral',
        queued: 'info',
    };

    return <Pill tone={tone[status] ?? 'neutral'}>{status}</Pill>;
}

/** Count with a warning/error icon, used for 4xx/5xx/failed columns. */
export function AlertCount({ value, tone }: { value: number; tone: 'warning' | 'danger' }) {
    if (!value) return <span className="text-zinc-400">0</span>;

    return (
        <span className={cn('inline-flex items-center gap-1.5', tone === 'warning' ? 'text-amber-600' : 'text-rose-600')}>
            <span className={cn('inline-block size-2 rounded-full', tone === 'warning' ? 'bg-amber-500' : 'bg-rose-500')} />
            {value}
        </span>
    );
}
