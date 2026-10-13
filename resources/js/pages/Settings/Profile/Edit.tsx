import { Button, Field, Modal, ModalFooter, SettingsCard, SettingsRow, SettingsRows, TextInput } from '@/components/rc/settings-ui';
import SettingsLayout from '@/layouts/settings-layout';
import type { PageProps } from '@/types/raccoon';
import { useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function Edit() {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user!;
    const name = useForm({ name: user.name });
    const email = useForm({ email: user.email, password: '' });
    const password = useForm({ current_password: '', password: '', password_confirmation: '' });
    const remove = useForm({ password: '' });
    const [dialog, setDialog] = useState<'email' | 'password' | 'delete' | null>(null);

    const close = () => {
        setDialog(null);
        email.reset();
        email.clearErrors();
        password.reset();
        password.clearErrors();
        remove.reset();
        remove.clearErrors();
    };

    const saveName = () => {
        if (name.data.name.trim() !== user.name) name.patch('/settings/profile', { preserveScroll: true });
    };

    return (
        <SettingsLayout title="Profile" description="Your personal information and preferences.">
            <SettingsCard title="General">
                <SettingsRows>
                    <SettingsRow title="Full name" description={name.errors.name && <span className="text-rose-600">{name.errors.name}</span>}>
                        <form
                            className="w-[440px]"
                            onSubmit={(e) => {
                                e.preventDefault();
                                saveName();
                            }}
                        >
                            <TextInput
                                value={name.data.name}
                                onChange={(e) => name.setData('name', e.target.value)}
                                onBlur={saveName}
                                aria-label="Full name"
                            />
                        </form>
                    </SettingsRow>
                    <SettingsRow title="Email address">
                        <span className="text-sm text-zinc-700">{user.email}</span>
                        <Button size="sm" onClick={() => setDialog('email')}>
                            Update
                        </Button>
                    </SettingsRow>
                </SettingsRows>
            </SettingsCard>

            <SettingsCard title="Security">
                <SettingsRows>
                    <SettingsRow title="Password">
                        <Button size="sm" onClick={() => setDialog('password')}>
                            Update password
                        </Button>
                    </SettingsRow>
                </SettingsRows>
            </SettingsCard>

            <SettingsCard title="Danger Zone">
                <SettingsRows>
                    <SettingsRow title="Delete Account" description="This action will immediately delete your account.">
                        <Button size="sm" onClick={() => setDialog('delete')}>
                            Delete
                        </Button>
                    </SettingsRow>
                </SettingsRows>
            </SettingsCard>

            <Modal open={dialog === 'email'} onOpenChange={(open) => !open && close()} title="Update email address">
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        email.put('/settings/profile/email', { preserveScroll: true, onSuccess: close });
                    }}
                >
                    <Field label="New email address" error={email.errors.email} htmlFor="new_email">
                        <TextInput
                            id="new_email"
                            type="email"
                            autoFocus
                            value={email.data.email}
                            onChange={(e) => email.setData('email', e.target.value)}
                            autoComplete="email"
                        />
                    </Field>
                    <Field label="Current password" error={email.errors.password} htmlFor="email_password">
                        <TextInput
                            id="email_password"
                            type="password"
                            value={email.data.password}
                            onChange={(e) => email.setData('password', e.target.value)}
                            autoComplete="current-password"
                        />
                    </Field>
                    <ModalFooter>
                        <Button onClick={close}>Cancel</Button>
                        <Button type="submit" variant="primary" loading={email.processing}>
                            Update email
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            <Modal open={dialog === 'password'} onOpenChange={(open) => !open && close()} title="Update password">
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        password.put('/settings/password', { preserveScroll: true, onSuccess: close });
                    }}
                >
                    <Field label="Current password" error={password.errors.current_password} htmlFor="current_password">
                        <TextInput
                            id="current_password"
                            type="password"
                            autoFocus
                            value={password.data.current_password}
                            onChange={(e) => password.setData('current_password', e.target.value)}
                            autoComplete="current-password"
                        />
                    </Field>
                    <Field label="New password" error={password.errors.password} htmlFor="new_password">
                        <TextInput
                            id="new_password"
                            type="password"
                            value={password.data.password}
                            onChange={(e) => password.setData('password', e.target.value)}
                            autoComplete="new-password"
                        />
                    </Field>
                    <Field label="Confirm new password" error={password.errors.password_confirmation} htmlFor="password_confirmation">
                        <TextInput
                            id="password_confirmation"
                            type="password"
                            value={password.data.password_confirmation}
                            onChange={(e) => password.setData('password_confirmation', e.target.value)}
                            autoComplete="new-password"
                        />
                    </Field>
                    <ModalFooter>
                        <Button onClick={close}>Cancel</Button>
                        <Button type="submit" variant="primary" loading={password.processing}>
                            Update password
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            <Modal
                open={dialog === 'delete'}
                onOpenChange={(open) => !open && close()}
                title="Delete account"
                description="Your account and memberships are deleted immediately. Organizations you own alone stay behind without you."
            >
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        remove.delete('/settings/profile', { preserveScroll: true });
                    }}
                >
                    <Field label="Password" error={remove.errors.password} htmlFor="delete_password">
                        <TextInput
                            id="delete_password"
                            type="password"
                            autoFocus
                            value={remove.data.password}
                            onChange={(e) => remove.setData('password', e.target.value)}
                            autoComplete="current-password"
                        />
                    </Field>
                    <ModalFooter>
                        <Button onClick={close}>Cancel</Button>
                        <Button type="submit" variant="danger" loading={remove.processing}>
                            Delete account
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>
        </SettingsLayout>
    );
}
