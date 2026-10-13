import { formatDate, timeAgo } from '@/lib/format';

const UNITS: Record<string, string> = { second: 's', minute: 'm', hour: 'h', day: 'd', month: 'mo', year: 'y' };

/** Narrow relative time ("1h ago", "5d ago") with the full UTC date on hover. */
export default function ShortTimeAgo({ value, className }: { value: string | null | undefined; className?: string }) {
    if (!value) return <span className={className}>—</span>;

    const text = timeAgo(value).replace(/^(\d+) (second|minute|hour|day|month|year)s? ago$/, (_, amount: string, unit: string) => `${amount}${UNITS[unit]} ago`);

    return (
        <span className={className} title={`${formatDate(value)} UTC`}>
            {text}
        </span>
    );
}
