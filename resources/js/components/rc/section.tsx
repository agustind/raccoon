import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

/** Outer gray frame that groups cards ("Activity", "Application" on the dashboard). */
export function Panel({
    title,
    icon: Icon,
    actions,
    children,
    className,
}: {
    title?: ReactNode;
    icon?: LucideIcon;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('rounded-xl border border-zinc-200 bg-zinc-50/60 p-1.5', className)}>
            {(title || actions) && (
                <div className="flex items-center justify-between px-2.5 py-2">
                    <h2 className="flex items-center gap-2.5 text-base font-medium">
                        {Icon && (
                            <span className="flex size-6 items-center justify-center rounded-md border border-zinc-200 bg-white">
                                <Icon className="size-3.5 text-zinc-500" />
                            </span>
                        )}
                        {title}
                    </h2>
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
}

/** White card. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('rounded-lg border border-zinc-200 bg-white shadow-xs', className)}>{children}</div>;
}

/** Heading above a table: "106 Routes" with optional icon and controls. */
export function SectionHeader({ title, icon: Icon, actions }: { title: ReactNode; icon?: LucideIcon; actions?: ReactNode }) {
    return (
        <div className="mt-10 mb-4 flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg font-medium">
                {Icon && <Icon className="size-4 text-blue-600" />}
                {title}
            </h2>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}

/** Small uppercase mono label used across the dashboard. */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
    return <span className={cn('font-mono text-xs tracking-wide text-zinc-500 uppercase', className)}>{children}</span>;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon?: LucideIcon;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-white px-6 py-14 text-center">
            {Icon && (
                <span className="mb-4 flex size-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
                    <Icon className="size-5 text-blue-600" />
                </span>
            )}
            <h3 className="text-base font-medium">{title}</h3>
            {description && <p className="mt-1 max-w-md text-sm text-zinc-500">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
