import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { Button, CopyButton, Field, Modal, ModalFooter, Switch, TextInput } from './settings-ui';

export interface Webhook {
    id: string;
    name: string;
    url: string;
    events: string[];
    enabled: boolean;
}

/** Create or edit a webhook. `url` is the webhooks collection URL. */
export function WebhookModal({
    open,
    onOpenChange,
    url,
    webhook,
    events,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    url: string;
    webhook: Webhook | null;
    events: string[];
}) {
    const form = useForm({ name: '', url: '', events: events, enabled: true });

    useEffect(() => {
        if (open) {
            form.setData({
                name: webhook?.name ?? '',
                url: webhook?.url ?? '',
                events: webhook?.events ?? events,
                enabled: webhook?.enabled ?? true,
            });
            form.clearErrors();
        }
        // Reset when the dialog opens for another webhook.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, webhook]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => onOpenChange(false) };

        if (webhook) form.patch(`${url}/${webhook.id}`, options);
        else form.post(url, options);
    };

    return (
        <Modal open={open} onOpenChange={onOpenChange} title={webhook ? 'Edit webhook' : 'Add webhook'} className="max-w-xl">
            <form className="space-y-4" onSubmit={submit}>
                <Field label="Name" error={form.errors.name} htmlFor="webhook_name">
                    <TextInput
                        id="webhook_name"
                        value={form.data.name}
                        placeholder="Team alerts"
                        autoFocus
                        onChange={(e) => form.setData('name', e.target.value)}
                    />
                </Field>
                <Field label="URL" error={form.errors.url} htmlFor="webhook_url">
                    <TextInput
                        id="webhook_url"
                        value={form.data.url}
                        placeholder="https://..."
                        onChange={(e) => form.setData('url', e.target.value)}
                    />
                </Field>
                <Field label="Events" error={form.errors.events}>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 p-3">
                        {events.map((event) => (
                            <label key={event} className="flex cursor-pointer items-center gap-2 font-mono text-xs text-zinc-800">
                                <Checkbox
                                    className="size-4 border-zinc-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                                    checked={form.data.events.includes(event)}
                                    onCheckedChange={(checked) =>
                                        form.setData('events', checked ? [...form.data.events, event] : form.data.events.filter((e) => e !== event))
                                    }
                                />
                                {event}
                            </label>
                        ))}
                    </div>
                </Field>
                {!webhook && <p className="text-xs text-zinc-500">A signing secret is generated when you create the webhook. It is shown once.</p>}
                <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm">
                        Enabled
                        <Switch checked={form.data.enabled} onChange={(enabled) => form.setData('enabled', enabled)} label="Enabled" />
                    </label>
                    <ModalFooter>
                        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" variant="primary" loading={form.processing}>
                            {webhook ? 'Update webhook' : 'Create webhook'}
                        </Button>
                    </ModalFooter>
                </div>
            </form>
        </Modal>
    );
}

/** Shows a freshly generated signing secret, flashed once by the server. */
export function WebhookSecretModal({ secret, onClose }: { secret: string | null; onClose: () => void }) {
    return (
        <Modal
            open={secret !== null}
            onOpenChange={(open) => !open && onClose()}
            title="Signing secret"
            description="Copy it now; it won't be shown again. Verify requests by comparing X-Raccoon-Signature with sha256= followed by the hex HMAC-SHA256 of the raw body, keyed with this secret."
        >
            <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 py-2 pr-1.5 pl-3">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-800" data-testid="webhook-secret">
                    {secret}
                </code>
                <CopyButton value={secret ?? ''} />
            </div>
            <ModalFooter>
                <Button variant="primary" onClick={onClose}>
                    Done
                </Button>
            </ModalFooter>
        </Modal>
    );
}
