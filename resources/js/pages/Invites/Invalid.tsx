import AuthLayout, { AuthLink } from '@/layouts/auth-layout';

export default function Invalid() {
    return (
        <AuthLayout title="Invite not found" description="This invite has expired, has been accepted, or does not exist.">
            <div className="text-center">
                <AuthLink href="/">Go to homepage</AuthLink>
            </div>
        </AuthLayout>
    );
}
