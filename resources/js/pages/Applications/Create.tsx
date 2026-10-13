import SettingsSetupSnippet from '@/components/rc/settings-setup-snippet';
import { Button, Field, SelectInput, TextInput } from '@/components/rc/settings-ui';
import AuthLayout, { AuthLink } from '@/layouts/auth-layout';
import { router, useForm } from '@inertiajs/react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
    organization: { id: string; name: string };
    organizations: { id: string; name: string }[];
    created: {
        application: { id: string; name: string };
        environment: { id: string; name: string; token: string; last_ingested_at: string | null };
    } | null;
    base_url: string;
}

export default function Create({ organization, organizations, created, base_url }: Props) {
    const form = useForm({ organization_id: organization.id, name: '', environment: 'Production' });
    const connected = Boolean(created?.environment.last_ingested_at);

    // Poll until the agent's first batch lands.
    useEffect(() => {
        if (!created || connected) return;

        const timer = setInterval(() => router.reload({ only: ['created'] }), 3000);

        return () => clearInterval(timer);
    }, [created, connected]);

    if (created) {
        return (
            <AuthLayout
                wide
                title={`Connect ${created.application.name}`}
                description={`Point the agent in ${created.application.name} at this server. The token belongs to the ${created.environment.name} environment.`}
                footer={
                    <AuthLink href={`/settings/organizations/${organization.id}/applications/${created.application.id}/environments`}>
                        Manage environments
                    </AuthLink>
                }
            >
                <SettingsSetupSnippet token={created.environment.token} baseUrl={base_url} />
                <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                    {connected ? (
                        <span className="flex items-center gap-2 text-emerald-700">
                            <CheckCircle2 className="size-4" /> Receiving events
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 text-zinc-600">
                            <LoaderCircle className="size-4 animate-spin" /> Waiting for the first events...
                        </span>
                    )}
                    <Button
                        variant={connected ? 'primary' : 'secondary'}
                        onClick={() => router.visit(`/environments/${created.environment.id}/dashboard`)}
                    >
                        Go to dashboard
                    </Button>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Add application"
            description="Each application gets environments, each with its own agent token."
            footer={<AuthLink href="/">Cancel</AuthLink>}
        >
            <form
                className="space-y-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/applications');
                }}
            >
                {organizations.length > 1 && (
                    <Field label="Organization" error={form.errors.organization_id} htmlFor="organization_id">
                        <SelectInput
                            id="organization_id"
                            value={form.data.organization_id}
                            onChange={(e) => form.setData('organization_id', e.target.value)}
                        >
                            {organizations.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </SelectInput>
                    </Field>
                )}
                <Field label="Application name" error={form.errors.name} htmlFor="name">
                    <TextInput
                        id="name"
                        required
                        autoFocus
                        placeholder="My Laravel app"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                    />
                </Field>
                <Field label="First environment" error={form.errors.environment} htmlFor="environment">
                    <TextInput
                        id="environment"
                        required
                        value={form.data.environment}
                        onChange={(e) => form.setData('environment', e.target.value)}
                    />
                </Field>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.processing}>
                    Create application
                </Button>
            </form>
        </AuthLayout>
    );
}
