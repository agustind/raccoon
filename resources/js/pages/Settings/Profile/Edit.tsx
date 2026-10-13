import {
    Button,
    ConfirmDialog,
    CopyButton,
    Field,
    Modal,
    ModalFooter,
    SettingsCard,
    SettingsEmpty,
    SettingsRow,
    SettingsRows,
    Switch,
    TextInput,
} from '@/components/rc/settings-ui';
import SettingsLayout from '@/layouts/settings-layout';
import { timeAgo } from '@/lib/format';
import type { PageProps } from '@/types/raccoon';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

interface ApiToken {
    id: number;
    name: string;
    write: boolean;
    last_used_at: string | null;
    created_at: string;
}

export default function Edit() {
    const { auth, tokens, newToken, mcpUrl } = usePage<PageProps & { tokens: ApiToken[]; newToken: string | null; mcpUrl: string }>().props;
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

            <ApiTokens tokens={tokens} newToken={newToken} mcpUrl={mcpUrl} />

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

/** Personal tokens for the MCP server, so AI agents can query this app's data. */
function ApiTokens({ tokens, newToken, mcpUrl }: { tokens: ApiToken[]; newToken: string | null; mcpUrl: string }) {
    const form = useForm({ name: '', write: false });
    const [creating, setCreating] = useState(false);
    const [shownToken, setShownToken] = useState<string | null>(null);
    const [revoking, setRevoking] = useState<ApiToken | null>(null);
    const command = shownToken ? `claude mcp add --transport http raccoon ${mcpUrl} --header "Authorization: Bearer ${shownToken}"` : '';

    const create = () =>
        form.post('/settings/api-tokens', {
            preserveScroll: true,
            onSuccess: (page) => {
                setCreating(false);
                form.reset();
                setShownToken((page.props as { newToken?: string | null }).newToken ?? newToken);
            },
        });

    return (
        <>
            <SettingsCard
                title="API tokens"
                description={
                    <>
                        Let AI agents such as Claude Code query this data through the MCP server at{' '}
                        <code className="font-mono text-xs">{mcpUrl}</code>. A token sees the same organizations you do.
                    </>
                }
                onAdd={() => setCreating(true)}
                addLabel="New token"
            >
                {tokens.length === 0 ? (
                    <SettingsEmpty message="No tokens yet." label="Create a token" onClick={() => setCreating(true)} />
                ) : (
                    <SettingsRows>
                        {tokens.map((token) => (
                            <SettingsRow
                                key={token.id}
                                title={
                                    <span className="flex items-center gap-2">
                                        {token.name}
                                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 uppercase">
                                            {token.write ? 'read + write' : 'read'}
                                        </span>
                                    </span>
                                }
                                description={`Created ${timeAgo(token.created_at)} · ${token.last_used_at ? `last used ${timeAgo(token.last_used_at)}` : 'never used'}`}
                            >
                                <Button size="sm" onClick={() => setRevoking(token)}>
                                    Revoke
                                </Button>
                            </SettingsRow>
                        ))}
                    </SettingsRows>
                )}
            </SettingsCard>

            <Modal open={creating} onOpenChange={(open) => !open && setCreating(false)} title="New API token">
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        create();
                    }}
                >
                    <Field label="Name" error={form.errors.name} htmlFor="token-name">
                        <TextInput
                            id="token-name"
                            autoFocus
                            placeholder="Claude Code on my laptop"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                        />
                    </Field>
                    <Switch
                        checked={form.data.write}
                        onChange={(value) => form.setData('write', value)}
                        label="Write access: agents can resolve, ignore and comment on issues"
                    />
                    <ModalFooter>
                        <Button onClick={() => setCreating(false)}>Cancel</Button>
                        <Button type="submit" variant="primary" loading={form.processing}>
                            Create token
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            <Modal
                open={shownToken !== null}
                onOpenChange={(open) => !open && setShownToken(null)}
                title="Your new token"
                description="Copy it now. It won't be shown again."
            >
                <div className="min-w-0 space-y-4 text-sm">
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap">{shownToken}</code>
                        <CopyButton value={shownToken ?? ''} />
                    </div>
                    <div>
                        <p className="mb-2 text-zinc-600">Add it to Claude Code:</p>
                        <div className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                            <code className="min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap">{command}</code>
                            <CopyButton value={command} />
                        </div>
                    </div>
                    <ModalFooter>
                        <Button variant="primary" onClick={() => setShownToken(null)}>
                            Done
                        </Button>
                    </ModalFooter>
                </div>
            </Modal>

            <ConfirmDialog
                open={revoking !== null}
                onOpenChange={(open) => !open && setRevoking(null)}
                title={`Revoke "${revoking?.name}"?`}
                description="Agents using this token lose access immediately."
                confirmLabel="Revoke"
                destructive
                onConfirm={() =>
                    revoking && router.delete(`/settings/api-tokens/${revoking.id}`, { preserveScroll: true, onSuccess: () => setRevoking(null) })
                }
            />
        </>
    );
}
