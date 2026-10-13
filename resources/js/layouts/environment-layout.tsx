import Sidebar from '@/components/rc/sidebar';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';

export interface Crumb {
    title: string;
    href?: string;
}

interface Props {
    title: string;
    /** Big heading. Defaults to title. */
    heading?: ReactNode;
    breadcrumbs?: Crumb[];
    /** Right side of the header: user filter, period picker... */
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}

/**
 * Shell for every dashboard page: sidebar, page header and a
 * gray page background with cards on top.
 */
export default function EnvironmentLayout({ title, heading, breadcrumbs, actions, children, className }: Props) {
    const { auth } = usePage<PageProps>().props;
    const pageTitle = [title, auth.app && auth.env ? `${auth.app.name} (${auth.env.name})` : null].filter(Boolean).join(' - ');

    return (
        <div className="flex min-h-screen bg-rc-page text-zinc-900">
            <Head title={pageTitle} />
            <Sidebar />
            <main className="min-w-0 flex-1">
                <FlashMessage />
                <div className={cn('mx-auto max-w-[1400px] px-10 pt-8 pb-16', className)}>
                    <header className="mb-8 flex items-start justify-between gap-6">
                        <div className="min-w-0">
                            {breadcrumbs && breadcrumbs.length > 0 && (
                                <nav className="mb-2 flex items-center gap-1.5 text-sm text-zinc-500">
                                    {breadcrumbs.map((crumb, index) => (
                                        <span key={index} className="flex items-center gap-1.5">
                                            {index > 0 && <ChevronRight className="size-3.5" />}
                                            {crumb.href ? (
                                                <Link href={crumb.href} className="hover:text-zinc-900">
                                                    {crumb.title}
                                                </Link>
                                            ) : (
                                                <span className="truncate">{crumb.title}</span>
                                            )}
                                        </span>
                                    ))}
                                </nav>
                            )}
                            <h1 className="truncate text-2xl font-semibold tracking-tight">{heading ?? title}</h1>
                        </div>
                        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                    </header>
                    {children}
                </div>
            </main>
        </div>
    );
}

function FlashMessage() {
    const { flash } = usePage<PageProps>().props;
    const [visible, setVisible] = useState(true);
    const message = flash?.success ?? flash?.error;

    useEffect(() => {
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 4000);

        return () => clearTimeout(timer);
    }, [message]);

    if (!message || !visible) return null;

    return (
        <div
            className={cn(
                'fixed right-6 bottom-6 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg',
                flash.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-zinc-200 bg-white text-zinc-800',
            )}
        >
            {message}
        </div>
    );
}
