import { Button, Initial } from '@/components/rc/settings-ui';
import AuthLayout, { AuthLink } from '@/layouts/auth-layout';
import type { PageProps } from '@/types/raccoon';
import { router, usePage } from '@inertiajs/react';

export default function EmailMismatch({ invite_email }: { invite_email: string }) {
    const { auth } = usePage<PageProps>().props;

    return (
        <AuthLayout
            title="Email mismatch"
            description={`This invitation was sent to ${invite_email}, a different address than your account's. Sign out and continue with that address, or ask the sender to invite this one.`}
            footer={<AuthLink href="/">Continue to dashboard</AuthLink>}
        >
            <div className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 py-4">
                <Initial name={auth.user?.name ?? '?'} className="size-8 rounded-full" />
                <p className="text-sm">{auth.user?.name}</p>
                <p className="text-xs text-zinc-500">{auth.user?.email}</p>
            </div>
            <Button size="lg" className="mt-4 w-full" onClick={() => router.post('/logout')}>
                Sign out
            </Button>
        </AuthLayout>
    );
}
