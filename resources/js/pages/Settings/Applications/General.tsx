import SettingsApplicationTabs from '@/components/rc/settings-tabs';
import { Button, ConfirmDialog, Field, SettingsCard, SettingsRow, SettingsRows, TextInput } from '@/components/rc/settings-ui';
import SettingsLayout from '@/layouts/settings-layout';
import { can } from '@/lib/rc';
import type { PageProps } from '@/types/raccoon';
import { useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

interface Props {
    organization: { id: string; name: string };
    application: { id: string; name: string; avatar_url: string | null };
    environments: { id: string; name: string; color: string }[];
}

export default function General({ organization, application, environments }: Props) {
    const { auth } = usePage<PageProps>().props;
    const base = `/settings/organizations/${organization.id}/applications/${application.id}`;
    const canEdit = can(auth.permissions, 'application.edit');
    const form = useForm({ name: application.name });
    const remove = useForm({ name: '' });
    const [confirming, setConfirming] = useState(false);

    const save = () => {
        if (form.data.name.trim() !== application.name) form.patch(base, { preserveScroll: true });
    };

    return (
        <SettingsLayout
            title={`${application.name} settings`}
            heading={application.name}
            tabs={<SettingsApplicationTabs organizationId={organization.id} applicationId={application.id} />}
        >
            <SettingsCard title="General" description="Common settings for your application.">
                <SettingsRows>
                    <SettingsRow title="Environments">
                        <span className="text-sm text-zinc-700">{environments.map((environment) => environment.name).join(', ') || 'None'}</span>
                    </SettingsRow>
                    <SettingsRow title="Application name" description={form.errors.name && <span className="text-rose-600">{form.errors.name}</span>}>
                        <form
                            className="w-[440px]"
                            onSubmit={(e) => {
                                e.preventDefault();
                                save();
                            }}
                        >
                            <TextInput
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                onBlur={save}
                                readOnly={!canEdit}
                                aria-label="Application name"
                            />
                        </form>
                    </SettingsRow>
                </SettingsRows>
            </SettingsCard>

            {can(auth.permissions, 'application.delete') && (
                <SettingsCard title="Danger zone">
                    <SettingsRows>
                        <SettingsRow title="Delete application" description="Delete the application, its environments and all related settings">
                            <Button onClick={() => setConfirming(true)}>Delete</Button>
                        </SettingsRow>
                    </SettingsRows>
                </SettingsCard>
            )}

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title="Delete application"
                description="This permanently deletes the application, its environments, issues, thresholds and webhooks. Agents using its tokens will be rejected."
                confirmLabel="Delete application"
                processing={remove.processing}
                disabled={remove.data.name !== application.name}
                onConfirm={() => remove.delete(base)}
            >
                <Field label={`Type "${application.name}" to confirm`} error={remove.errors.name} htmlFor="confirm-name">
                    <TextInput
                        id="confirm-name"
                        value={remove.data.name}
                        onChange={(e) => remove.setData('name', e.target.value)}
                        autoComplete="off"
                    />
                </Field>
            </ConfirmDialog>
        </SettingsLayout>
    );
}
