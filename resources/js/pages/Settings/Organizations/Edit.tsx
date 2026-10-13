import {
    Button,
    ConfirmDialog,
    Field,
    Initial,
    Modal,
    ModalFooter,
    SelectInput,
    SettingsCard,
    SettingsRow,
    SettingsRows,
    TextInput,
} from '@/components/rc/settings-ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SettingsLayout from '@/layouts/settings-layout';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/rc';
import type { PageProps } from '@/types/raccoon';
import { router, useForm, usePage } from '@inertiajs/react';
import { Copy, LogOut, Mail, MoreVertical, Send, Trash2, UserMinus } from 'lucide-react';
import { useState } from 'react';

type Role = 'owner' | 'admin' | 'member';

interface Member {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
    role: Role;
}

interface Invite {
    id: string;
    email: string;
    role: Role;
    expires_at: string;
    url: string | null;
}

interface Props {
    organization: { id: string; name: string; avatar_url: string | null };
    users: Member[];
    invites: Invite[];
    roles: { value: Role; label: string; description: string }[];
}

export default function Edit({ organization, users, invites, roles }: Props) {
    const { auth, errors } = usePage<PageProps>().props;
    const base = `/settings/organizations/${organization.id}`;
    const me = users.find((user) => user.id === auth.user?.id);
    const myRole = me?.role ?? 'member';
    const canEditOrg = can(auth.permissions, 'organization.edit');
    const canInvite = can(auth.permissions, 'organization_invite.create');
    const ownerCount = users.filter((user) => user.role === 'owner').length;
    const lastOwner = myRole === 'owner' && ownerCount === 1;

    const name = useForm({ name: organization.name });
    const invite = useForm<{ email: string; role: Role }>({ email: '', role: 'member' });
    const remove = useForm({ name: '' });
    const [inviting, setInviting] = useState(false);
    const [removing, setRemoving] = useState<Member | null>(null);
    const [deleting, setDeleting] = useState(false);

    const saveName = () => {
        if (name.data.name.trim() !== organization.name) name.patch(base, { preserveScroll: true });
    };

    const roleOptions = roles.filter((role) => myRole === 'owner' || role.value !== 'owner');

    return (
        <SettingsLayout
            title={`${organization.name} settings`}
            heading={`${organization.name} Settings`}
            description="Update your organization or invite new members"
        >
            <SettingsCard title="General" description="General settings for your organization">
                <SettingsRows>
                    <SettingsRow
                        title="Organization name"
                        description={name.errors.name ? <span className="text-rose-600">{name.errors.name}</span> : 'Shown in the app and in invites'}
                    >
                        <form
                            className="w-[440px]"
                            onSubmit={(e) => {
                                e.preventDefault();
                                saveName();
                            }}
                        >
                            <TextInput
                                value={name.data.name}
                                readOnly={!canEditOrg}
                                onChange={(e) => name.setData('name', e.target.value)}
                                onBlur={saveName}
                                aria-label="Organization name"
                            />
                        </form>
                    </SettingsRow>
                </SettingsRows>
            </SettingsCard>

            <SettingsCard
                title={`${users.length} ${users.length === 1 ? 'member' : 'members'}`}
                onAdd={canInvite ? () => setInviting(true) : undefined}
                addLabel="Invite member"
            >
                <div className="space-y-1.5 px-1.5 pb-1.5">
                    {users.map((user) => (
                        <div key={user.id} className="grid grid-cols-[minmax(0,1fr)_250px_44px] gap-1.5">
                            <div className="flex h-11 min-w-0 items-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 shadow-xs">
                                <Initial name={user.name} />
                                <span className="truncate text-base text-zinc-900">{user.name}</span>
                                <span className="truncate text-base text-zinc-500">{user.email}</span>
                            </div>
                            <SelectInput
                                aria-label={`Role of ${user.name}`}
                                value={user.role}
                                disabled={
                                    !can(auth.permissions, 'membership.edit') ||
                                    (myRole !== 'owner' && user.role === 'owner') ||
                                    (user.id === me?.id && lastOwner)
                                }
                                onChange={(e) => router.patch(`${base}/users/${user.id}`, { role: e.target.value }, { preserveScroll: true })}
                            >
                                {roles.map((role) => (
                                    <option key={role.value} value={role.value} disabled={myRole !== 'owner' && role.value === 'owner'}>
                                        {role.label}
                                    </option>
                                ))}
                            </SelectInput>
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    className="flex size-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-xs hover:text-zinc-900"
                                    aria-label={`Actions for ${user.name}`}
                                >
                                    <MoreVertical className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    {user.id === me?.id ? (
                                        <DropdownMenuItem disabled={lastOwner} onSelect={() => setRemoving(user)}>
                                            <LogOut className="size-3.5 text-zinc-500" /> Leave organization
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            disabled={!can(auth.permissions, 'membership.delete') || (myRole !== 'owner' && user.role === 'owner')}
                                            onSelect={() => setRemoving(user)}
                                        >
                                            <UserMinus className="size-3.5 text-zinc-500" /> Remove member
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}

                    {invites.map((pending) => (
                        <div key={pending.id} className="grid grid-cols-[minmax(0,1fr)_250px_44px] gap-1.5">
                            <div className="flex h-11 min-w-0 items-center gap-2.5 rounded-lg border border-dashed border-zinc-300 bg-white/60 px-3">
                                <Mail className="size-4 shrink-0 text-zinc-400" />
                                <span className="truncate text-base text-zinc-700">{pending.email}</span>
                                <span className="shrink-0 text-xs text-zinc-500">
                                    Invited, expires {formatDate(pending.expires_at).split(',').slice(0, 2).join(',')}
                                </span>
                            </div>
                            <SelectInput aria-label={`Role for ${pending.email}`} value={pending.role} disabled>
                                {roles.map((role) => (
                                    <option key={role.value} value={role.value}>
                                        {role.label}
                                    </option>
                                ))}
                            </SelectInput>
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    className="flex size-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-xs hover:text-zinc-900"
                                    aria-label={`Actions for ${pending.email}`}
                                >
                                    <MoreVertical className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    {pending.url && (
                                        <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(pending.url!)}>
                                            <Copy className="size-3.5 text-zinc-500" /> Copy invite link
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                        disabled={!can(auth.permissions, 'organization_invite.edit')}
                                        onSelect={() => router.post(`${base}/invites/${pending.id}/resend`, {}, { preserveScroll: true })}
                                    >
                                        <Send className="size-3.5 text-zinc-500" /> Resend invite
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={!can(auth.permissions, 'organization_invite.delete')}
                                        onSelect={() => router.delete(`${base}/invites/${pending.id}`, { preserveScroll: true })}
                                    >
                                        <Trash2 className="size-3.5 text-zinc-500" /> Revoke invite
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ))}
                    {errors.role && <p className="px-2 py-1 text-sm text-rose-600">{errors.role}</p>}
                </div>
            </SettingsCard>

            <SettingsCard title="Danger zone">
                <SettingsRows>
                    <SettingsRow
                        title="Leave organization"
                        description={
                            lastOwner
                                ? 'Make someone else an owner before leaving'
                                : `This action will immediately remove you from ${organization.name}`
                        }
                    >
                        <Button disabled={lastOwner || !me} onClick={() => me && setRemoving(me)}>
                            Leave
                        </Button>
                    </SettingsRow>
                    {can(auth.permissions, 'organization.delete') && (
                        <SettingsRow
                            title="Delete organization"
                            description="Permanently delete the organization with all its applications and settings"
                        >
                            <Button onClick={() => setDeleting(true)}>Delete</Button>
                        </SettingsRow>
                    )}
                </SettingsRows>
            </SettingsCard>

            <Modal
                open={inviting}
                onOpenChange={setInviting}
                title="Invite member"
                description="They'll get an email with a link to join. The link expires in 7 days."
            >
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        invite.post(`${base}/invites`, { preserveScroll: true, onSuccess: () => (setInviting(false), invite.reset()) });
                    }}
                >
                    <Field label="Email" error={invite.errors.email} htmlFor="invite_email">
                        <TextInput
                            id="invite_email"
                            type="email"
                            autoFocus
                            placeholder="name@example.com"
                            value={invite.data.email}
                            onChange={(e) => invite.setData('email', e.target.value)}
                        />
                    </Field>
                    <Field label="Role" error={invite.errors.role} htmlFor="invite_role">
                        <SelectInput id="invite_role" value={invite.data.role} onChange={(e) => invite.setData('role', e.target.value as Role)}>
                            {roleOptions.map((role) => (
                                <option key={role.value} value={role.value}>
                                    {role.label}: {role.description}
                                </option>
                            ))}
                        </SelectInput>
                    </Field>
                    <ModalFooter>
                        <Button onClick={() => setInviting(false)}>Cancel</Button>
                        <Button type="submit" variant="primary" loading={invite.processing}>
                            Send invite
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            <ConfirmDialog
                open={removing !== null}
                onOpenChange={(open) => !open && setRemoving(null)}
                title={removing?.id === me?.id ? 'Leave organization' : `Remove ${removing?.name ?? ''}`}
                description={
                    removing?.id === me?.id
                        ? `You will lose access to ${organization.name}.`
                        : `${removing?.name ?? ''} will lose access to ${organization.name}.`
                }
                confirmLabel={removing?.id === me?.id ? 'Leave' : 'Remove'}
                onConfirm={() => router.delete(`${base}/users/${removing!.id}`, { preserveScroll: true, onFinish: () => setRemoving(null) })}
            />
            <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                title="Delete organization"
                description="This permanently deletes the organization, its applications, environments, issues and settings."
                confirmLabel="Delete organization"
                processing={remove.processing}
                disabled={remove.data.name !== organization.name}
                onConfirm={() => remove.delete(base)}
            >
                <Field label={`Type "${organization.name}" to confirm`} error={remove.errors.name} htmlFor="confirm-org-name">
                    <TextInput
                        id="confirm-org-name"
                        value={remove.data.name}
                        onChange={(e) => remove.setData('name', e.target.value)}
                        autoComplete="off"
                    />
                </Field>
            </ConfirmDialog>
        </SettingsLayout>
    );
}
