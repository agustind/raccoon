import { Button, Field, TextInput } from '@/components/rc/settings-ui';
import AuthLayout from '@/layouts/auth-layout';
import { useForm } from '@inertiajs/react';

export default function ResetPassword({ token, email }: { token: string; email: string }) {
    const form = useForm({ token, email, password: '', password_confirmation: '' });

    return (
        <AuthLayout title="Reset password" description="Choose a new password for your account.">
            <form
                className="space-y-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/reset-password', { onFinish: () => form.reset('password', 'password_confirmation') });
                }}
            >
                <Field label="Email" error={form.errors.email} htmlFor="email">
                    <TextInput id="email" type="email" readOnly autoComplete="email" value={form.data.email} />
                </Field>
                <Field label="New password" error={form.errors.password} htmlFor="password">
                    <TextInput
                        id="password"
                        type="password"
                        required
                        autoFocus
                        autoComplete="new-password"
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
                        value={form.data.password_confirmation}
                        onChange={(e) => form.setData('password_confirmation', e.target.value)}
                    />
                </Field>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.processing}>
                    Reset password
                </Button>
            </form>
        </AuthLayout>
    );
}
