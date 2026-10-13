import { cn } from '@/lib/utils';

/** Badge plus a sentence like "12 exceptions reported in the last 24 hours." */
export function CardStatus({ label, message, period, className }: { label: string; message: string; period: string | null; className?: string }) {
    return (
        <div className={cn('grid justify-items-start gap-4', className)}>
            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700 uppercase">{label}</span>
            <h3 className="text-2xl/8 font-semibold text-balance">
                {message}
                {period ? ` in the last ${period}.` : ' in the selected period.'}
            </h3>
        </div>
    );
}
