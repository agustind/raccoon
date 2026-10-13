import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import { envUrl, withPeriod } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowUpRight,
    BellRing,
    Box,
    Braces,
    CalendarClock,
    ChevronsUpDown,
    Database,
    Globe,
    Inbox,
    Layers,
    LayoutGrid,
    LogOut,
    LucideIcon,
    Mail,
    Monitor,
    Moon,
    Sun,
    MoreHorizontal,
    Plus,
    ScrollText,
    Settings2,
    TriangleAlert,
    User,
} from 'lucide-react';

interface NavItem {
    title: string;
    path: string;
    icon: LucideIcon;
    keepPeriod?: boolean;
    badge?: number;
}

export const ENV_COLORS: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    yellow: 'bg-amber-400',
    purple: 'bg-violet-500',
    orange: 'bg-orange-500',
    gray: 'bg-zinc-400',
    pink: 'bg-pink-500',
};

export function Avatar({ name, className }: { name: string; className?: string }) {
    return (
        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-700', className)}>
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

export default function Sidebar() {
    const { auth, url } = usePage<PageProps>().props as PageProps & { url?: string };
    const env = auth.env;
    const app = auth.app;
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : (url ?? '');

    const activity: NavItem[] = [
        { title: 'Requests', path: 'requests', icon: Globe, keepPeriod: true },
        { title: 'Jobs', path: 'jobs', icon: Layers, keepPeriod: true },
        { title: 'Commands', path: 'commands', icon: Braces, keepPeriod: true },
        { title: 'Scheduled Tasks', path: 'scheduled-tasks', icon: CalendarClock, keepPeriod: true },
        { title: 'Exceptions', path: 'exceptions', icon: TriangleAlert, keepPeriod: true },
        { title: 'Queries', path: 'queries', icon: Database, keepPeriod: true },
        { title: 'Notifications', path: 'notifications', icon: BellRing, keepPeriod: true },
        { title: 'Mail', path: 'mail', icon: Mail, keepPeriod: true },
        { title: 'Cache', path: 'cache', icon: Box, keepPeriod: true },
        { title: 'Outgoing Requests', path: 'outgoing-requests', icon: ArrowUpRight, keepPeriod: true },
    ];

    // Application settings for the current app, else the organization's first
    // app, else the organization itself.
    const settingsApp = app ?? auth.user?.organizations.find((o) => o.id === auth.org?.id)?.applications[0] ?? null;
    const settingsUrl = auth.org ? (settingsApp ? `/settings/organizations/${auth.org.id}/applications/${settingsApp.id}/general` : `/settings/organizations/${auth.org.id}`) : null;

    const monitoring: NavItem[] = [
        { title: 'Users', path: 'users', icon: User, keepPeriod: true },
        { title: 'Logs', path: 'logs', icon: ScrollText, keepPeriod: true },
    ];

    const renderItem = (item: NavItem) => {
        if (!env) return null;

        const href = envUrl(env.id, item.path);
        const active = currentPath === href || currentPath.startsWith(`${href}/`);

        return (
            <Link
                key={item.path}
                href={item.keepPeriod ? withPeriod(href) : href}
                className={cn(
                    'flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900',
                    active && 'border border-zinc-200 bg-white text-zinc-900 shadow-xs hover:bg-white',
                )}
            >
                <item.icon className={cn('size-4 shrink-0 text-zinc-400', active && 'text-blue-600')} strokeWidth={1.75} />
                <span className="flex-1 truncate">{item.title}</span>
                {item.badge !== undefined && item.badge > 0 && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600">{item.badge}</span>
                )}
            </Link>
        );
    };

    return (
        <aside className="sticky top-0 flex h-screen w-[228px] shrink-0 flex-col border-r border-zinc-200 bg-white">
            <EnvironmentSwitcher />

            <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
                {env && (
                    <>
                        {renderItem({ title: 'Dashboard', path: 'dashboard', icon: LayoutGrid, keepPeriod: true })}
                        {renderItem({ title: 'Issues', path: 'issues', icon: Inbox, badge: env.issues.open })}

                        <div className="px-3 pt-4 pb-1 text-xs font-medium text-zinc-500">Activity</div>
                        {activity.map(renderItem)}

                        <div className="px-3 pt-4 pb-1 text-xs font-medium text-zinc-500">Monitoring</div>
                        {monitoring.map(renderItem)}
                    </>
                )}

                <div className="pt-6">
                    {settingsUrl && (
                        <Link
                            href={settingsUrl}
                            className={cn(
                                'flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                                currentPath.startsWith('/settings') && 'border border-zinc-200 bg-white text-zinc-900',
                            )}
                        >
                            <Settings2 className="size-4 text-zinc-400" strokeWidth={1.75} />
                            Settings
                        </Link>
                    )}
                </div>
            </nav>

            <UserMenu />
        </aside>
    );
}

function EnvironmentSwitcher() {
    const { auth } = usePage<PageProps>().props;
    const organizations = auth.user?.organizations ?? [];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex h-14 w-full items-center gap-2.5 border-b border-zinc-200 px-2 text-left hover:bg-zinc-50">
                <Avatar name={auth.app?.name ?? auth.org?.name ?? 'N'} className="size-8" />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900">{auth.app?.name ?? auth.org?.name ?? 'Raccoon'}</span>
                    <span className="block truncate text-xs text-zinc-500">{auth.env?.name ?? 'Select an environment'}</span>
                </span>
                <ChevronsUpDown className="size-4 text-zinc-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" align="start">
                {organizations.map((org) => (
                    <DropdownMenuGroup key={org.id}>
                        <DropdownMenuLabel className="text-xs text-zinc-500">{org.name}</DropdownMenuLabel>
                        {org.applications.map((application) =>
                            application.environments.map((environment) => (
                                <DropdownMenuItem key={environment.id} onSelect={() => router.visit(withPeriod(envUrl(environment.id, 'dashboard')))}>
                                    <span className={cn('size-2 rounded-full', ENV_COLORS[environment.color] ?? 'bg-zinc-400')} />
                                    <span className="flex-1 truncate">{application.name}</span>
                                    <span className="text-xs text-zinc-500">{environment.name}</span>
                                </DropdownMenuItem>
                            )),
                        )}
                        <DropdownMenuItem onSelect={() => router.visit(`/applications/create?organization=${org.id}`)}>
                            <Plus className="size-4" /> New application
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </DropdownMenuGroup>
                ))}
                <DropdownMenuItem onSelect={() => router.visit('/organizations/create')}>
                    <Plus className="size-4" /> New organization
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

const APPEARANCES: { value: Appearance; label: string; icon: LucideIcon }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];

function UserMenu() {
    const { auth } = usePage<PageProps>().props;
    const { appearance, updateAppearance } = useAppearance();

    if (!auth.user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex h-14 w-full items-center gap-2.5 border-t border-zinc-200 px-3 text-left hover:bg-zinc-50">
                <Avatar name={auth.user.name} />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-900">{auth.user.name}</span>
                <MoreHorizontal className="size-4 text-zinc-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" side="top">
                <DropdownMenuLabel className="text-xs font-normal text-zinc-500">{auth.user.email}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => router.visit('/settings/profile')}>
                    <User className="size-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.visit('/settings/notifications')}>
                    <BellRing className="size-4" /> Notifications
                </DropdownMenuItem>
                {auth.org && (
                    <DropdownMenuItem onSelect={() => router.visit(`/settings/organizations/${auth.org!.id}`)}>
                        <Settings2 className="size-4" /> Organization
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <div className="flex items-center gap-1 px-2 py-1.5">
                    {APPEARANCES.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            title={option.label}
                            onClick={() => updateAppearance(option.value)}
                            className={cn(
                                'flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
                                appearance === option.value && 'bg-zinc-100 text-zinc-900',
                            )}
                        >
                            <option.icon className="size-3.5" />
                            {option.label}
                        </button>
                    ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.post('/logout')}>
                    <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
