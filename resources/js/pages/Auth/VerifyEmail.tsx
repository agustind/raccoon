import { Button } from '@/components/rc/settings-ui';
import AuthLayout from '@/layouts/auth-layout';
import { router, useForm } from '@inertiajs/react';

export default function VerifyEmail({ status }: { status?: string }) {
    const form = useForm({});

    return (
        <AuthLayout title="Verify email" description="Verify your email address by clicking the link we just emailed to you.">
            {status === 'verification-link-sent' && (
                <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    A new verification link has been sent to your email address.
                </div>
            )}
            <div className="space-y-3">
                <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={form.processing}
                    onClick={() => form.post('/email/verification-notification')}
                >
                    Resend verification email
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => router.post('/logout')}>
                    Sign out
                </Button>
            </div>
        </AuthLayout>
    );
}
