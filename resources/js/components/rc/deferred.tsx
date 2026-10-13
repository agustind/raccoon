import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Deferred as InertiaDeferred } from '@inertiajs/react';
import { ReactNode } from 'react';

/** Inertia <Deferred> with a skeleton fallback sized like the content. */
export default function Deferred({ data, children, className }: { data: string | string[]; children: () => ReactNode; className?: string }) {
    return (
        <InertiaDeferred data={data} fallback={<Skeleton className={cn('h-64 w-full rounded-lg', className)} />}>
            {children}
        </InertiaDeferred>
    );
}
