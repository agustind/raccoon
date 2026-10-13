import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

/** "LABEL ........ value" row used in detail cards. */
export function KeyValue({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={cn('flex items-baseline gap-2 py-2 font-mono text-[13px]', className)}>
            <span className="shrink-0 text-xs tracking-wide text-zinc-600 uppercase">{label}</span>
            <span className="min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-zinc-300" />
            <span className="min-w-0 truncate text-right text-zinc-900">{children}</span>
        </div>
    );
}

export function KeyValueList({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('divide-y divide-transparent', className)}>{children}</div>;
}
