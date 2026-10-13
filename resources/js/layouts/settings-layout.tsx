import { Initial } from '@/components/rc/settings-ui';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { can } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, BarChart3, Bell, ChevronsUpDown, LogOut, LucideIcon, Plus, Settings, User } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';

interface Props {
    /** Browser tab title. */
    title: string;
    /** Big heading. Defaults to title. */
    heading?: ReactNode;
    description?: ReactNode;
    /** Rendered under the heading, e.g. application tabs. */
    tabs?: ReactNode;
    children: ReactNode;
}

/**
 * Shell for settings pages: a light sidebar with personal
 * links, the current organization and its applications, and a framed
 * content panel.
 */
export default function SettingsLayout({ title, heading, description, tabs, children }: Props) {
    return (
        <div className="flex min-h-screen bg-zinc-100/70 text-zinc-900">
            <Head title={title} />
            <SettingsSidebar />
            <main className="min-w-0 flex-1 p-2 pl-0">
                <div className="bg-rc-page min-h-[calc(100vh-1rem)] rounded-xl border border-zinc-200">
                    <div className="mx-auto max-w-[960px] px-8 pt-14 pb-20">
                        <header className={cn(tabs ? 'mb-6' : 'mb-8')}>
                            <h1 className="text-2xl font-semibold tracking-tight">{heading ?? title}</h1>
                            {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
                        </header>
                        {tabs}
                        <div className="space-y-8">{children}</div>
                    </div>
                </div>
            </main>
            <FlashToast />
        </div>
    );
}

function NavLink({ href, icon: Icon, children, active }: { href: string; icon?: LucideIcon; children: ReactNode; active?: boolean }) {
    return (
        <Link
            href={href}
            className={cn(
                'flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-zinc-500 transition-colors hover:text-zinc-900',
                active && 'border border-zinc-200 bg-white text-zinc-900 shadow-xs',
            )}
        >
            {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />}
            <span className="truncate">{children}</span>
        </Link>
    );
}

function SettingsSidebar() {
    const { auth } = usePage<PageProps>().props;
    const path = usePage().url.split('?')[0];
    const organizations = auth.user?.organizations ?? [];
    const org = organizations.find((o) => o.id === auth.org?.id) ?? organizations[0];
    const orgBase = org ? `/settings/organizations/${org.id}` : null;

    return (
        <aside className="sticky top-0 flex h-screen w-[256px] shrink-0 flex-col px-2">
            <Link href="/" className="flex h-14 items-center gap-2 px-2 text-base text-zinc-900 hover:text-zinc-600">
                <ArrowLeft className="size-4" /> Back
            </Link>

            <nav className="flex-1 space-y-1 overflow-y-auto pt-2">
                <div className="flex h-9 items-center gap-3 px-3 text-sm text-zinc-900">
                    <Initial name={auth.user?.name ?? '?'} className="size-5 border-0 bg-transparent" />
                    <span className="truncate">{auth.user?.name}</span>
                </div>
                <NavLink href="/settings/profile" icon={User} active={path === '/settings/profile'}>
                    Profile
                </NavLink>
                <NavLink href="/settings/notifications" icon={Bell} active={path === '/settings/notifications'}>
                    Notifications
                </NavLink>

                {org && orgBase && (
                    <>
                        <div className="pt-6">
                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-zinc-900 hover:bg-zinc-200/50">
                                    <Initial name={org.name} className="size-5 border-0 bg-transparent" />
                                    <span className="max-w-[160px] truncate">{org.name}</span>
                                    <ChevronsUpDown className="size-3.5 text-zinc-500" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-60">
                                    <DropdownMenuLabel className="text-xs font-normal text-zinc-500">Organizations</DropdownMenuLabel>
                                    {organizations.map((o) => (
                                        <DropdownMenuItem key={o.id} onSelect={() => router.visit(`/settings/organizations/${o.id}`)}>
                                            <Initial name={o.name} className="size-5" />
                                            <span className="flex-1 truncate">{o.name}</span>
                                            <span className="text-xs text-zinc-500 capitalize">{o.role}</span>
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => router.visit('/organizations/create')}>
                                        <Plus className="size-4" /> New organization
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <NavLink href={orgBase} icon={Settings} active={path === orgBase}>
                            Settings
                        </NavLink>
                        <NavLink href={`${orgBase}/usage`} icon={BarChart3} active={path === `${orgBase}/usage`}>
                            Usage
                        </NavLink>
                        {can(auth.permissions, 'application.create') && (
                            <NavLink href={`/applications/create?organization=${org.id}`} icon={Plus}>
                                Add Application
                            </NavLink>
                        )}

                        <div className="space-y-1 pt-6">
                            {org.applications.map((application) => {
                                const href = `${orgBase}/applications/${application.id}/general`;

                                return (
                                    <Link
                                        key={application.id}
                                        href={href}
                                        className={cn(
                                            'flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-zinc-600 hover:text-zinc-900',
                                            path.startsWith(`${orgBase}/applications/${application.id}`) &&
                                                'border border-zinc-200 bg-white text-zinc-900 shadow-xs',
                                        )}
                                    >
                                        <Initial name={application.name} className="size-5 border-0 bg-transparent" />
                                        <span className="truncate">{application.name}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </>
                )}

                {organizations.length === 0 && (
                    <div className="pt-6">
                        <NavLink href="/organizations/create" icon={Plus}>
                            Create organization
                        </NavLink>
                    </div>
                )}
            </nav>

            <div className="flex items-end justify-between gap-2 px-2 py-4">
                <div className="min-w-0 text-sm">
                    <div className="text-zinc-600">Signed in as</div>
                    <div className="truncate text-zinc-900">{auth.user?.email}</div>
                </div>
                <button
                    type="button"
                    title="Sign out"
                    aria-label="Sign out"
                    className="p-1 text-zinc-500 hover:text-zinc-900"
                    onClick={() => router.post('/logout')}
                >
                    <LogOut className="size-4" />
                </button>
            </div>
        </aside>
    );
}

function FlashToast() {
    const { flash } = usePage<PageProps>().props;
    const [visible, setVisible] = useState(true);
    const message = flash?.error ?? flash?.success;

    useEffect(() => {
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 4000);

        return () => clearTimeout(timer);
    }, [flash]);

    if (!message || !visible) return null;

    return (
        <div
            role="status"
            className={cn(
                'fixed right-6 bottom-6 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg',
                flash.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-zinc-200 bg-white text-zinc-800',
            )}
        >
            {message}
        </div>
    );
}
