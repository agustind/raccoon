import { Button, Field, TextInput } from '@/components/rc/settings-ui';
import { Checkbox } from '@/components/ui/checkbox';
import AuthLayout, { AuthLink } from '@/layouts/auth-layout';
import { useForm } from '@inertiajs/react';

interface Props {
    status: string | null;
    canResetPassword: boolean;
    canRegister: boolean;
    organization_invite: { email: string; organization_name: string } | null;
}

export default function SignIn({ status, canResetPassword, canRegister, organization_invite }: Props) {
    const form = useForm({ email: organization_invite?.email ?? '', password: '', remember: false });

    return (
        <AuthLayout
            title="Sign in"
            description={
                organization_invite ? `You are invited to join ${organization_invite.organization_name}` : 'Welcome back. Sign in to your account.'
            }
            footer={
                canRegister && (
                    <>
                        Don't have an account? <AuthLink href="/register">Sign up</AuthLink>
                    </>
                )
            }
        >
            {status && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</div>}
            <form
                className="space-y-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/login', { onFinish: () => form.reset('password') });
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
                <Field
                    label={
                        <span className="flex w-full items-center justify-between">
                            Password
                            {canResetPassword && (
                                <AuthLink href="/forgot-password" className="font-normal">
                                    Forgot password?
                                </AuthLink>
                            )}
                        </span>
                    }
                    error={form.errors.password}
                    htmlFor="password"
                >
                    <TextInput
                        id="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="Enter password"
                        value={form.data.password}
                        onChange={(e) => form.setData('password', e.target.value)}
                    />
                </Field>
                <label htmlFor="remember" className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700">
                    <Checkbox
                        id="remember"
                        className="size-4 border-zinc-300 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                        checked={form.data.remember}
                        onCheckedChange={(checked) => form.setData('remember', checked === true)}
                    />
                    Remember me
                </label>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.processing}>
                    Sign in
                </Button>
            </form>
        </AuthLayout>
    );
}
