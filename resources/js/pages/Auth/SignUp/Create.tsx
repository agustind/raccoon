import { Button, Field, TextInput } from '@/components/rc/settings-ui';
import AuthLayout, { AuthLink } from '@/layouts/auth-layout';
import { useForm } from '@inertiajs/react';

interface Props {
    first_user: boolean;
    organization_invite: { email: string; organization_name: string; token: string } | null;
}

export default function Create({ first_user, organization_invite }: Props) {
    const form = useForm({
        name: '',
        email: organization_invite?.email ?? '',
        password: '',
        password_confirmation: '',
        organization: '',
        invite: organization_invite?.token ?? '',
    });

    return (
        <AuthLayout
            title="Sign up"
            header={first_user ? 'Set up Raccoon' : 'Create your account'}
            description={
                organization_invite
                    ? `Create an account to join ${organization_invite.organization_name}`
                    : first_user
                      ? 'Create the first account. You will own a new organization and can invite your team afterwards.'
                      : 'Create an account to start monitoring your applications.'
            }
            footer={
                <>
                    Already have an account? <AuthLink href="/login">Sign in</AuthLink>
                </>
            }
        >
            <form
                className="space-y-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/register', { onFinish: () => form.reset('password', 'password_confirmation') });
                }}
            >
                <Field label="Name" error={form.errors.name} htmlFor="name">
                    <TextInput
                        id="name"
                        required
                        autoFocus
                        autoComplete="name"
                        placeholder="Full name"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                    />
                </Field>
                <Field label="Email" error={form.errors.email} htmlFor="email">
                    <TextInput
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="email@example.com"
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                    />
                </Field>
                {first_user && !organization_invite && (
                    <Field label="Organization name" error={form.errors.organization} htmlFor="organization">
                        <TextInput
                            id="organization"
                            required
                            placeholder="Acme Inc."
                            value={form.data.organization}
                            onChange={(e) => form.setData('organization', e.target.value)}
                        />
                    </Field>
                )}
                <Field label="Password" error={form.errors.password} htmlFor="password">
                    <TextInput
                        id="password"
                        type="password"
                        required
                        autoComplete="new-password"
                        placeholder="Password"
                        value={form.data.password}
                        onChange={(e) => form.setData('password', e.target.value)}
                    />
                </Field>
                <Field label="Confirm password" error={form.errors.password_confirmation} htmlFor="password_confirmation">
                    <TextInput
                        id="password_confirmation"
                        type="password"
                        required
                        autoComplete="new-password"
                        placeholder="Confirm password"
                        value={form.data.password_confirmation}
                        onChange={(e) => form.setData('password_confirmation', e.target.value)}
                    />
                </Field>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.processing}>
                    {organization_invite ? 'Create account and join' : 'Create account'}
                </Button>
            </form>
        </AuthLayout>
    );
}
