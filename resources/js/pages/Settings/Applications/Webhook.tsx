import CodeBlock from '@/components/rc/code-block';
import { Pagination } from '@/components/rc/pagination';
import SettingsApplicationTabs from '@/components/rc/settings-tabs';
import { Button, ConfirmDialog, SettingsCard, SettingsEmpty } from '@/components/rc/settings-ui';
import { Webhook as WebhookData, WebhookModal, WebhookSecretModal } from '@/components/rc/settings-webhooks';
import SettingsLayout from '@/layouts/settings-layout';
import { formatDate } from '@/lib/format';
import { can, visitWithQuery } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { PageProps, Paginator } from '@/types/raccoon';
import { Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ChevronRight, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Delivery {
    id: number;
    event: string;
    status_code: number | null;
    payload: unknown;
    response: string | null;
    created_at: string;
}

interface Props {
    organization: { id: string; name: string };
    application: { id: string; name: string };
    webhook: WebhookData;
    webhook_events: string[];
    webhook_secret: string | null;
    failed: string | null;
    filterStats: { success: number; failed: number };
    events: Paginator<Delivery>;
}

export default function Webhook({ organization, application, webhook, webhook_events, webhook_secret, failed, filterStats, events }: Props) {
    const { auth } = usePage<PageProps>().props;
    const base = `/settings/organizations/${organization.id}/applications/${application.id}`;
    const url = `${base}/webhooks/${webhook.id}`;
    const canEdit = can(auth.permissions, 'application.edit');
    const [editing, setEditing] = useState(false);
    const [confirm, setConfirm] = useState<'rotate' | 'delete' | null>(null);
    const [sending, setSending] = useState(false);
    const [secret, setSecret] = useState<string | null>(webhook_secret);
    const [expanded, setExpanded] = useState<number | null>(null);

    useEffect(() => setSecret(webhook_secret), [webhook_secret]);

    const filters = [
        { value: null, label: 'View all', count: filterStats.success + filterStats.failed },
        { value: '0', label: 'Successful', count: filterStats.success },
        { value: '1', label: 'Failed', count: filterStats.failed },
    ];

    return (
        <SettingsLayout
            title={`${webhook.name} webhook`}
            heading={application.name}
            tabs={<SettingsApplicationTabs organizationId={organization.id} applicationId={application.id} active="issues" />}
        >
            <section className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white shadow-xs">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <Link
                            href={`${base}/issues`}
                            className="flex size-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-900"
                            aria-label="Back to issue settings"
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                        <h2 className="truncate text-lg font-medium">{webhook.name}</h2>
                        <span
                            className={cn(
                                'rounded px-1.5 py-0.5 font-mono text-[11px] uppercase',
                                webhook.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
                            )}
                        >
                            {webhook.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                    {canEdit && (
                        <div className="flex items-center gap-1.5">
                            <Button
                                size="sm"
                                variant="ghost"
                                loading={sending}
                                onClick={() => {
                                    setSending(true);
                                    router.post(`${url}/test`, {}, { preserveScroll: true, onFinish: () => setSending(false) });
                                }}
                            >
                                Send test
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirm('rotate')}>
                                Rotate secret
                            </Button>
                            <Button size="sm" onClick={() => setEditing(true)}>
                                Edit
                            </Button>
                            <Button size="sm" onClick={() => setConfirm('delete')}>
                                Delete
                            </Button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-600">
                    <Link2 className="size-3 shrink-0 text-zinc-500" />
                    <span className="truncate">{webhook.url}</span>
                    <span className="ml-auto shrink-0 font-mono text-zinc-500">{webhook.events.join(', ')}</span>
                </div>
            </section>

            <SettingsCard
                title={`${events.total} ${events.total === 1 ? 'delivery' : 'deliveries'}`}
                actions={
                    <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm">
                        {filters.map((filter) => (
                            <button
                                key={filter.label}
                                type="button"
                                onClick={() => visitWithQuery({ failed: filter.value })}
                                className={cn(
                                    'rounded-md px-2.5 py-1 text-zinc-600',
                                    (failed ?? null) === filter.value && 'bg-zinc-100 text-zinc-900',
                                )}
                            >
                                {filter.label}{' '}
                                <span
                                    className={cn('font-mono text-xs', filter.value === '1' && filter.count > 0 ? 'text-rose-600' : 'text-zinc-400')}
                                >
                                    {filter.count}
                                </span>
                            </button>
                        ))}
                    </div>
                }
            >
                {events.data.length === 0 ? (
                    <SettingsEmpty message="No deliveries yet. Send a test event to check the endpoint." />
                ) : (
                    <div className="mx-1.5 mb-1.5 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
                        {events.data.map((delivery) => {
                            const ok = delivery.status_code !== null && delivery.status_code < 400;

                            return (
                                <div key={delivery.id}>
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(expanded === delivery.id ? null : delivery.id)}
                                        className={cn(
                                            'flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm hover:bg-zinc-50',
                                            !ok && 'bg-rose-50/50',
                                        )}
                                    >
                                        <ChevronRight
                                            className={cn('size-3.5 text-zinc-400 transition-transform', expanded === delivery.id && 'rotate-90')}
                                        />
                                        <span className="w-44 shrink-0 text-zinc-600">{formatDate(delivery.created_at)}</span>
                                        <span className={cn('w-12 shrink-0 font-mono text-xs', ok ? 'text-emerald-700' : 'text-rose-600')}>
                                            {delivery.status_code ?? 'ERR'}
                                        </span>
                                        <span className="font-mono text-xs text-zinc-900">{delivery.event}</span>
                                        <span className="min-w-0 flex-1 truncate text-right text-xs text-zinc-500">{delivery.response}</span>
                                    </button>
                                    {expanded === delivery.id && (
                                        <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
                                            <div>
                                                <div className="mb-1 font-mono text-xs text-zinc-500 uppercase">Payload</div>
                                                <CodeBlock code={JSON.stringify(delivery.payload)} json />
                                            </div>
                                            <div>
                                                <div className="mb-1 font-mono text-xs text-zinc-500 uppercase">Response</div>
                                                <CodeBlock code={delivery.response} json />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                {events.last_page > 1 && (
                    <div className="px-4 pb-4">
                        <Pagination paginator={events} />
                    </div>
                )}
            </SettingsCard>

            <WebhookModal open={editing} onOpenChange={setEditing} url={`${base}/webhooks`} webhook={webhook} events={webhook_events} />
            <WebhookSecretModal secret={secret} onClose={() => setSecret(null)} />
            <ConfirmDialog
                open={confirm === 'rotate'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Rotate signing secret"
                description="The current secret stops working immediately. Update your receiver with the new one."
                confirmLabel="Rotate"
                onConfirm={() => router.post(`${url}/rotate-secret`, {}, { preserveScroll: true, onFinish: () => setConfirm(null) })}
            />
            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Delete webhook"
                description="This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => router.delete(url)}
            />
        </SettingsLayout>
    );
}
