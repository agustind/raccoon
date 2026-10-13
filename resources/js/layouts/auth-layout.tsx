import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { Head, Link, usePage } from '@inertiajs/react';
import { ReactNode } from 'react';

interface Props {
    /** Browser tab title. */
    title: string;
    /** Heading inside the card. Defaults to title. */
    header?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    /** Wider card for onboarding steps. */
    wide?: boolean;
    footer?: ReactNode;
}

/**
 * Centered card on the page background, used by sign-in, sign-up, password
 * reset, invites and onboarding.
 */
export default function AuthLayout({ title, header, description, children, wide = false, footer }: Props) {
    const { flash } = usePage<PageProps>().props;

    return (
        <div className="bg-rc-page relative flex min-h-screen flex-col items-center px-4 py-16 text-zinc-900">
            <Head title={title} />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_65%)]"
            />
            <Link href="/" className="relative mb-10 flex items-center gap-2.5 text-zinc-900">
                <Logo className="size-7" />
                <span className="text-lg font-semibold tracking-tight">Raccoon</span>
            </Link>
            <div
                className={cn(
                    'relative w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)]',
                    wide ? 'max-w-2xl' : 'max-w-[420px]',
                )}
            >
                <div className="mb-7 text-center">
                    <h1 className="text-2xl font-semibold tracking-tight">{header ?? title}</h1>
                    {description && <div className="mt-2 text-sm text-pretty text-zinc-500">{description}</div>}
                </div>
                {flash?.error && (
                    <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{flash.error}</div>
                )}
                {children}
            </div>
            {footer && <div className="relative mt-6 text-sm text-zinc-500">{footer}</div>}
        </div>
    );
}

export function Logo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
            <rect width="32" height="32" rx="8" fill="var(--color-zinc-900)" />
            <path d="M20.5 8.5a8 8 0 1 0 3 12.4A6.5 6.5 0 0 1 20.5 8.5Z" fill="var(--color-white)" />
            <circle cx="22.5" cy="10" r="1.25" fill="var(--color-blue-500)" />
        </svg>
    );
}

/** Mono uppercase link under auth forms ("Forgot password?", "Sign up"). */
export function AuthLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
    return (
        <Link href={href} className={cn('text-sm text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline', className)}>
            {children}
        </Link>
    );
}
