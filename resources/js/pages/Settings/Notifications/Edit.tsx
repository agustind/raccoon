import { EnvironmentDot, Initial, SettingsCard } from '@/components/rc/settings-ui';
import { Checkbox } from '@/components/ui/checkbox';
import SettingsLayout from '@/layouts/settings-layout';
import { cn } from '@/lib/utils';
import type { ApplicationSummary, EnvironmentSummary, PageProps } from '@/types/raccoon';
import { router, usePage } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

type EventKey = 'issue_created' | 'issue_reopened' | 'issue_assigned' | 'threshold_exceeded';
type Preferences = Record<EventKey, boolean>;

interface Props {
    environmentNotificationPreferences: Record<string, Preferences>;
    notificationEvents: { key: EventKey; label: string }[];
}

export default function Edit({ environmentNotificationPreferences, notificationEvents }: Props) {
    const { auth } = usePage<PageProps>().props;
    const organizations = auth.user?.organizations ?? [];

    // Environments without a saved row get every notification.
    const enabled = (environment: EnvironmentSummary, key: EventKey) => environmentNotificationPreferences[environment.id]?.[key] ?? true;
    const count = (application: ApplicationSummary) =>
        application.environments.reduce((sum, environment) => sum + notificationEvents.filter((event) => enabled(environment, event.key)).length, 0);

    return (
        <SettingsLayout
            title="Notifications"
            description="Customize your settings to receive only the alerts that matter to you. These changes won't affect your team members."
        >
            {organizations.map((organization) => (
                <SettingsCard
                    key={organization.id}
                    title={
                        <span className="flex items-center gap-2.5">
                            <Initial name={organization.name} /> {organization.name}
                        </span>
                    }
                >
                    <div className="mx-1.5 mb-1.5 space-y-1.5">
                        {organization.applications.map((application) => (
                            <ApplicationAccordion key={application.id} application={application} count={count(application)}>
                                {application.environments.map((environment) => (
                                    <div key={environment.id} className="flex flex-wrap items-center justify-between gap-4 py-3 pr-4 pl-5">
                                        <span className="flex items-center gap-3 text-sm">
                                            <EnvironmentDot color={environment.color} />
                                            {environment.name}
                                        </span>
                                        <div className="flex flex-wrap justify-end gap-6">
                                            {notificationEvents.map((event) => {
                                                const id = `${event.key}-${environment.id}`;

                                                return (
                                                    <label
                                                        key={event.key}
                                                        htmlFor={id}
                                                        className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700"
                                                    >
                                                        {event.label}
                                                        <Checkbox
                                                            id={id}
                                                            className="size-4 border-zinc-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                                                            checked={enabled(environment, event.key)}
                                                            onCheckedChange={(checked) =>
                                                                router.put(
                                                                    `/settings/notifications/environments/${environment.id}`,
                                                                    { [event.key]: checked === true },
                                                                    {
                                                                        preserveScroll: true,
                                                                        preserveState: true,
                                                                        only: ['environmentNotificationPreferences'],
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </ApplicationAccordion>
                        ))}
                        {organization.applications.length === 0 && (
                            <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
                                This organization has no applications.
                            </p>
                        )}
                    </div>
                </SettingsCard>
            ))}
        </SettingsLayout>
    );
}

function ApplicationAccordion({ application, count, children }: { application: ApplicationSummary; count: number; children: React.ReactNode }) {
    const hasEnvironments = application.environments.length > 0;
    const [open, setOpen] = useState(false);

    return (
        <div className={cn('rounded-lg border border-zinc-200 bg-white shadow-xs', !hasEnvironments && 'border-dashed shadow-none')}>
            <button
                type="button"
                disabled={!hasEnvironments}
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between p-3 text-sm"
            >
                <span className="flex items-center gap-2">
                    <Initial name={application.name} />
                    <span className={open ? 'text-zinc-900' : 'text-zinc-600'}>{application.name}</span>
                </span>
                <span className="flex items-center gap-3 text-zinc-600">
                    {hasEnvironments ? `${count || 'Not'} enabled` : 'No environments available'}
                    {hasEnvironments && <ChevronDown className={cn('size-4 text-zinc-400 transition-transform', open && 'rotate-180')} />}
                </span>
            </button>
            {open && <div className="divide-y divide-zinc-200 border-t border-zinc-200">{children}</div>}
        </div>
    );
}
