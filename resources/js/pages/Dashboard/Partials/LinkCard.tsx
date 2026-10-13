import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ReactNode } from 'react';

/** Raised row linking to a detail page, with stats on the right. */
export default function LinkCard({ href, children, stats, className }: { href: string; children: ReactNode; stats?: ReactNode; className?: string }) {
    return (
        <Link
            href={href}
            className={cn(
                'flex items-center justify-between gap-1 rounded-lg border border-zinc-200 bg-white p-3 shadow-md shadow-black/5 transition-all hover:scale-[101%] hover:shadow-xl',
                className,
            )}
        >
            <div className="grid min-w-0 gap-1.5">{children}</div>
            {stats}
        </Link>
    );
}
