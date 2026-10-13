import SettingsApplicationTabs from '@/components/rc/settings-tabs';
import { ConfirmDialog, SelectInput, SettingsCard, SettingsEmpty, SettingsRow, SettingsRows } from '@/components/rc/settings-ui';
import { Webhook, WebhookModal, WebhookSecretModal } from '@/components/rc/settings-webhooks';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SettingsLayout from '@/layouts/settings-layout';
import { timeAgo } from '@/lib/format';
import { can } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, MoreHorizontal, Pencil, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface WebhookRow extends Webhook {
    last_event: { event: string; status_code: number | null; created_at: string } | null;
}

interface Props {
    organization: { id: string; name: string };
    application: { id: string; name: string; issue_auto_resolve_in_days: number | null; webhooks: WebhookRow[] };
    auto_resolve_issues_count: Record<string, number>;
    auto_resolve_options: number[];
    webhook_events: string[];
    webhook_secret: string | null;
}

export default function Issues({
    organization,
    application,
    auto_resolve_issues_count,
    auto_resolve_options,
    webhook_events,
    webhook_secret,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const base = `/settings/organizations/${organization.id}/applications/${application.id}`;
    const canEdit = can(auth.permissions, 'application.edit');
    const [editing, setEditing] = useState<Webhook | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [deleting, setDeleting] = useState<WebhookRow | null>(null);
    const [secret, setSecret] = useState<string | null>(webhook_secret);

    useEffect(() => setSecret(webhook_secret), [webhook_secret]);

    const openModal = (webhook: Webhook | null) => {
        setEditing(webhook);
        setModalOpen(true);
    };

    return (
        <SettingsLayout
            title={`${application.name} issue settings`}
            heading={application.name}
            tabs={<SettingsApplicationTabs organizationId={organization.id} applicationId={application.id} />}
        >
            <SettingsCard title="Issues" description="Common settings for your application issues.">
                <SettingsRows>
                    <SettingsRow
                        title="Auto-resolve issues"
                        description="Automatically resolve issues when there is no reoccurrence within a timeframe"
                    >
                        <SelectInput
                            className="w-[440px]"
                            aria-label="Auto-resolve issues"
                            disabled={!canEdit}
                            value={application.issue_auto_resolve_in_days ?? ''}
                            onChange={(e) =>
                                router.patch(
                                    `${base}/issues`,
                                    { issue_auto_resolve_in_days: e.target.value === '' ? null : Number(e.target.value) },
                                    { preserveScroll: true },
                                )
                            }
                        >
                            <option value="">Never</option>
                            {auto_resolve_options.map((days) => (
                                <option key={days} value={days}>
                                    After {days} days
                                    {auto_resolve_issues_count[days] ? ` (resolves ${auto_resolve_issues_count[days]} open now)` : ''}
                                </option>
                            ))}
                        </SelectInput>
                    </SettingsRow>
                </SettingsRows>
            </SettingsCard>

            <SettingsCard
                title="Webhooks"
                description="Create webhooks to receive notifications when certain events occur."
                onAdd={canEdit && application.webhooks.length > 0 ? () => openModal(null) : undefined}
                addLabel="Add webhook"
            >
                {application.webhooks.length === 0 ? (
                    <SettingsEmpty
                        label="Add webhook"
                        onClick={canEdit ? () => openModal(null) : undefined}
                        message={canEdit ? undefined : 'No webhooks'}
                    />
                ) : (
                    <SettingsRows>
                        {application.webhooks.map((webhook) => {
                            const failed = webhook.last_event && (webhook.last_event.status_code === null || webhook.last_event.status_code >= 400);

                            return (
                                <div key={webhook.id} className="flex items-center gap-4 px-4 py-3">
                                    <Link href={`${base}/webhooks/${webhook.id}`} className="min-w-0 flex-1 space-y-1.5">
                                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                                            <span className={cn('size-2 rounded-full', webhook.enabled ? 'bg-emerald-500' : 'bg-rose-500')} />
                                            {webhook.name}
                                            <span className="text-xs font-normal text-zinc-500">{webhook.events.length} events</span>
                                        </div>
                                        <div className="flex items-center gap-2 font-mono text-xs text-zinc-600">
                                            {failed && (
                                                <span
                                                    title={`Last delivery failed ${timeAgo(webhook.last_event!.created_at)} (${webhook.last_event!.status_code ?? 'no response'})`}
                                                >
                                                    <AlertTriangle className="size-3 text-amber-500" />
                                                </span>
                                            )}
                                            <span className="truncate">{webhook.url}</span>
                                        </div>
                                    </Link>
                                    {canEdit && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger
                                                className="flex size-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-900"
                                                aria-label="Webhook actions"
                                            >
                                                <MoreHorizontal className="size-4" />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        router.patch(
                                                            `${base}/webhooks/${webhook.id}`,
                                                            { enabled: !webhook.enabled },
                                                            { preserveScroll: true },
                                                        )
                                                    }
                                                >
                                                    {webhook.enabled ? (
                                                        <ToggleLeft className="size-3.5 text-zinc-500" />
                                                    ) : (
                                                        <ToggleRight className="size-3.5 text-zinc-500" />
                                                    )}
                                                    {webhook.enabled ? 'Disable' : 'Enable'}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => openModal(webhook)}>
                                                    <Pencil className="size-3.5 text-zinc-500" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setDeleting(webhook)}>
                                                    <Trash2 className="size-3.5 text-zinc-500" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            );
                        })}
                    </SettingsRows>
                )}
            </SettingsCard>

            <WebhookModal open={modalOpen} onOpenChange={setModalOpen} url={`${base}/webhooks`} webhook={editing} events={webhook_events} />
            <WebhookSecretModal secret={secret} onClose={() => setSecret(null)} />
            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Delete webhook"
                description={`Stop sending events to ${deleting?.url ?? ''}? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={() => router.delete(`${base}/webhooks/${deleting!.id}`, { preserveScroll: true, onFinish: () => setDeleting(null) })}
            />
            {!canEdit && <p className="text-sm text-zinc-500">Only admins can change these settings.</p>}
        </SettingsLayout>
    );
}
