import { cn } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';

const TABS = [
    { path: 'general', label: 'General' },
    { path: 'environments', label: 'Environments' },
    { path: 'thresholds', label: 'Thresholds' },
    { path: 'issues', label: 'Issues' },
];

/** General / Environments / Thresholds / Issues tabs of an application's settings. */
export default function SettingsApplicationTabs({
    organizationId,
    applicationId,
    active,
}: {
    organizationId: string;
    applicationId: string;
    active?: string;
}) {
    const path = usePage().url.split('?')[0];
    const base = `/settings/organizations/${organizationId}/applications/${applicationId}`;

    return (
        <nav className="mb-8 flex gap-1 border-b border-zinc-200">
            {TABS.map((tab) => {
                const current = active ? active === tab.path : path.startsWith(`${base}/${tab.path}`);

                return (
                    <Link
                        key={tab.path}
                        href={`${base}/${tab.path}`}
                        className={cn(
                            '-mb-px border-b-2 border-transparent px-1 pt-1 pb-4 text-base text-zinc-500 transition-colors hover:text-zinc-900 [&:not(:first-child)]:ml-4',
                            current && 'border-blue-600 text-zinc-900',
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
