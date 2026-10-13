import { Button } from '@/components/rc/settings-ui';
import AuthLayout, { AuthLink } from '@/layouts/auth-layout';
import { router } from '@inertiajs/react';
import { useState } from 'react';

interface Props {
    organization: { id: string; name: string; avatar_url: string | null };
    organization_invite: { id: string; email: string; role: string; token: string };
    inviter: string | null;
    can_accept_invite: boolean;
    has_account: boolean;
}

export default function Show({ organization, organization_invite, inviter, can_accept_invite, has_account }: Props) {
    const [processing, setProcessing] = useState(false);

    return (
        <AuthLayout
            title="You've been invited to join an organization"
            header="Join the team"
            description={`${inviter ? `${inviter} invited you` : 'You have been invited'} to join the ${organization.name} organization with ${organization_invite.role} access.`}
            footer={<AuthLink href="/">Maybe later</AuthLink>}
        >
            {can_accept_invite ? (
                <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={processing}
                    onClick={() => {
                        setProcessing(true);
                        router.post(`/invites/${organization_invite.token}/accept`, {}, { onFinish: () => setProcessing(false) });
                    }}
                >
                    Accept invite
                </Button>
            ) : (
                <div className="space-y-3">
                    <p className="text-center text-sm text-zinc-600">
                        The invite was sent to <span className="text-zinc-900">{organization_invite.email}</span>.
                    </p>
                    <Button variant={has_account ? 'primary' : 'secondary'} size="lg" className="w-full" onClick={() => router.visit('/login')}>
                        Sign in to accept
                    </Button>
                    <Button
                        variant={has_account ? 'secondary' : 'primary'}
                        size="lg"
                        className="w-full"
                        onClick={() => router.visit(`/register?invite=${organization_invite.token}`)}
                    >
                        Create an account
                    </Button>
                </div>
            )}
        </AuthLayout>
    );
}
