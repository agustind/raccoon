import { Button, Field, TextInput } from '@/components/rc/settings-ui';
import AuthLayout from '@/layouts/auth-layout';
import { useForm } from '@inertiajs/react';

export default function ConfirmPassword() {
    const form = useForm({ password: '' });

    return (
        <AuthLayout title="Confirm password" description="This is a secure area. Confirm your password to continue.">
            <form
                className="space-y-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/confirm-password', { onFinish: () => form.reset('password') });
                }}
            >
                <Field label="Password" error={form.errors.password} htmlFor="password">
                    <TextInput
                        id="password"
                        type="password"
                        required
                        autoFocus
                        autoComplete="current-password"
                        value={form.data.password}
                        onChange={(e) => form.setData('password', e.target.value)}
                    />
                </Field>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.processing}>
                    Confirm
                </Button>
            </form>
        </AuthLayout>
    );
}
