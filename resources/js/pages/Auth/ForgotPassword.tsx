import { Button, Field, TextInput } from '@/components/rc/settings-ui';
import AuthLayout, { AuthLink } from '@/layouts/auth-layout';
import { useForm } from '@inertiajs/react';

export default function ForgotPassword({ status }: { status?: string }) {
    const form = useForm({ email: '' });

    return (
        <AuthLayout
            title="Forgot password"
            description="Enter your email and we'll send you a link to reset your password."
            footer={
                <>
                    Remembered it? <AuthLink href="/login">Sign in</AuthLink>
                </>
            }
        >
            {status && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</div>}
            <form
                className="space-y-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/forgot-password');
                }}
            >
                <Field label="Email" error={form.errors.email} htmlFor="email">
                    <TextInput
                        id="email"
                        type="email"
                        required
                        autoFocus
                        autoComplete="email"
                        placeholder="Enter email"
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                    />
                </Field>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.processing}>
                    Email reset link
                </Button>
            </form>
        </AuthLayout>
    );
}
