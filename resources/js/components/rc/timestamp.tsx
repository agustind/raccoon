import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** "Oct 12, 2026, 20:42:23 UTC" with a muted UTC suffix. */
export default function Timestamp({ value, className }: { value: string | null | undefined; className?: string }) {
    return (
        <span className={cn('whitespace-nowrap', className)}>
            {formatDate(value)} <span className="text-zinc-400">UTC</span>
        </span>
    );
}
