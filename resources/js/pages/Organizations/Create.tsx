import { Button, Field, TextInput } from '@/components/rc/settings-ui';
import AuthLayout, { AuthLink } from '@/layouts/auth-layout';
import type { PageProps } from '@/types/raccoon';
import { router, useForm, usePage } from '@inertiajs/react';

export default function Create() {
    const { auth } = usePage<PageProps>().props;
    const form = useForm({ name: '' });
    const hasOrganizations = (auth.user?.organizations.length ?? 0) > 0;

    return (
        <AuthLayout
            title="Create organization"
            description="Organizations group your applications and the people who can see them."
            footer={
                hasOrganizations ? (
                    <AuthLink href="/">Back to dashboard</AuthLink>
                ) : (
                    <button type="button" className="hover:text-zinc-900 hover:underline" onClick={() => router.post('/logout')}>
                        Sign out
                    </button>
                )
            }
        >
            <form
                className="space-y-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/organizations');
                }}
            >
                <Field label="Organization name" error={form.errors.name} htmlFor="name">
                    <TextInput
                        id="name"
                        required
                        autoFocus
                        placeholder="Acme Inc."
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                    />
                </Field>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.processing}>
                    Create organization
                </Button>
            </form>
        </AuthLayout>
    );
}
