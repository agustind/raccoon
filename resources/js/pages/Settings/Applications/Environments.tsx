import SettingsSetupSnippet from '@/components/rc/settings-setup-snippet';
import SettingsApplicationTabs from '@/components/rc/settings-tabs';
import {
    Button,
    ConfirmDialog,
    CopyButton,
    ENV_DOT_COLORS,
    EnvironmentDot,
    Field,
    Modal,
    ModalFooter,
    SelectInput,
    SettingsCard,
    TextInput,
} from '@/components/rc/settings-ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SettingsLayout from '@/layouts/settings-layout';
import { timeAgo } from '@/lib/format';
import { can } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { router, useForm, usePage } from '@inertiajs/react';
import { Eye, EyeOff, MoreVertical, RefreshCw, Terminal, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Environment {
    id: string;
    name: string;
    token: string;
    color: string;
    url: string | null;
    last_ingested_at: string | null;
}

interface Props {
    organization: { id: string; name: string };
    application: { id: string; name: string };
    environments: Environment[];
    colors: string[];
    base_url: string;
    created_environment_id: string | null;
}

export default function Environments({ organization, application, environments, colors, base_url, created_environment_id }: Props) {
    const { auth } = usePage<PageProps>().props;
    const base = `/settings/organizations/${organization.id}/applications/${application.id}/environments`;
    const [adding, setAdding] = useState(false);
    const [setupFor, setSetupFor] = useState<Environment | null>(null);
    const form = useForm({ name: '', color: 'green', url: '' });

    useEffect(() => {
        const created = environments.find((environment) => environment.id === created_environment_id);
        if (created) setSetupFor(created);
        // Only when the server flashes a newly created environment.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [created_environment_id]);

    return (
        <SettingsLayout
            title={`${application.name} environments`}
            heading={application.name}
            tabs={<SettingsApplicationTabs organizationId={organization.id} applicationId={application.id} />}
        >
            <SettingsCard
                title={`${environments.length} ${environments.length === 1 ? 'environment' : 'environments'}`}
                description="Manage your application environments"
                onAdd={can(auth.permissions, 'environment.create') ? () => setAdding(true) : undefined}
                addLabel="Add environment"
            >
                {environments.length > 0 && (
                    <div className="px-4 pb-4">
                        <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_140px_200px_minmax(0,1.6fr)_44px] gap-1.5 text-sm text-zinc-900">
                            <span>Name</span>
                            <span />
                            <span>
                                URL <span className="text-zinc-500">(Optional)</span>
                            </span>
                            <span>Token</span>
                        </div>
                        <div className="space-y-1.5">
                            {environments.map((environment) => (
                                <EnvironmentRow
                                    key={environment.id}
                                    url={`${base}/${environment.id}`}
                                    environment={environment}
                                    colors={colors}
                                    canEdit={can(auth.permissions, 'environment.edit')}
                                    canDelete={can(auth.permissions, 'environment.delete')}
                                    onSetup={() => setSetupFor(environment)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </SettingsCard>

            <Modal open={adding} onOpenChange={setAdding} title="Add environment">
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.post(base, { preserveScroll: true, onSuccess: () => (setAdding(false), form.reset()) });
                    }}
                >
                    <Field label="Environment name" error={form.errors.name} htmlFor="environment_name">
                        <div className="grid grid-cols-[1fr_140px] gap-2">
                            <TextInput
                                id="environment_name"
                                value={form.data.name}
                                placeholder="Staging"
                                autoFocus
                                onChange={(e) => form.setData('name', e.target.value)}
                            />
                            <ColorSelect value={form.data.color} colors={colors} onChange={(color) => form.setData('color', color)} />
                        </div>
                    </Field>
                    <Field label="Environment URL" hint="(Optional)" error={form.errors.url} htmlFor="environment_url">
                        <TextInput
                            id="environment_url"
                            value={form.data.url}
                            placeholder="https://example.com"
                            onChange={(e) => form.setData('url', e.target.value)}
                        />
                    </Field>
                    <ModalFooter>
                        <Button onClick={() => setAdding(false)}>Cancel</Button>
                        <Button type="submit" variant="primary" loading={form.processing}>
                            Add environment
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            <Modal
                open={setupFor !== null}
                onOpenChange={(open) => !open && setSetupFor(null)}
                title={`Connect ${setupFor?.name ?? ''}`}
                description="Configure the agent in your Laravel application to send data to this server."
                className="max-w-2xl"
            >
                {setupFor && <SettingsSetupSnippet token={setupFor.token} baseUrl={base_url} />}
            </Modal>
        </SettingsLayout>
    );
}

function ColorSelect({
    value,
    colors,
    onChange,
    disabled,
}: {
    value: string;
    colors: string[];
    onChange: (color: string) => void;
    disabled?: boolean;
}) {
    return (
        <div className="relative">
            <span
                className={cn('pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 rounded', ENV_DOT_COLORS[value] ?? 'bg-zinc-400')}
            />
            <SelectInput value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="pl-9 capitalize" aria-label="Color">
                {colors.map((color) => (
                    <option key={color} value={color}>
                        {color}
                    </option>
                ))}
            </SelectInput>
        </div>
    );
}

function EnvironmentRow({
    url,
    environment,
    colors,
    canEdit,
    canDelete,
    onSetup,
}: {
    url: string;
    environment: Environment;
    colors: string[];
    canEdit: boolean;
    canDelete: boolean;
    onSetup: () => void;
}) {
    const form = useForm({ name: environment.name, color: environment.color, url: environment.url ?? '' });
    const [revealed, setRevealed] = useState(false);
    const [confirm, setConfirm] = useState<'rotate' | 'delete' | null>(null);
    const [processing, setProcessing] = useState(false);

    const save = (data: Partial<typeof form.data> = {}) => {
        const next = { ...form.data, ...data };
        if (next.name === environment.name && next.color === environment.color && next.url === (environment.url ?? '')) return;
        form.transform(() => next);
        form.patch(url, { preserveScroll: true });
    };

    const run = (action: () => void) => {
        setProcessing(true);
        action();
    };

    return (
        <div>
            <div className="grid grid-cols-[minmax(0,1fr)_140px_200px_minmax(0,1.6fr)_44px] gap-1.5">
                <TextInput
                    value={form.data.name}
                    readOnly={!canEdit}
                    onChange={(e) => form.setData('name', e.target.value)}
                    onBlur={() => save()}
                    aria-label="Name"
                />
                <ColorSelect
                    value={form.data.color}
                    colors={colors}
                    disabled={!canEdit}
                    onChange={(color) => {
                        form.setData('color', color);
                        save({ color });
                    }}
                />
                <TextInput
                    value={form.data.url}
                    readOnly={!canEdit}
                    placeholder="https://example.com"
                    onChange={(e) => form.setData('url', e.target.value)}
                    onBlur={() => save()}
                    aria-label="URL"
                />
                <div className="flex h-11 items-center gap-0.5 rounded-lg border border-zinc-200 bg-white pr-1 pl-3 shadow-xs">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-800" data-testid="environment-token">
                        {revealed ? environment.token : `${environment.token.slice(0, 6)}${'•'.repeat(20)}`}
                    </span>
                    <button
                        type="button"
                        title={revealed ? 'Hide token' : 'Reveal token'}
                        aria-label={revealed ? 'Hide token' : 'Reveal token'}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                        onClick={() => setRevealed(!revealed)}
                    >
                        {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                    <CopyButton value={environment.token} />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        className="flex size-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-xs hover:text-zinc-900"
                        aria-label="Environment actions"
                    >
                        <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onSelect={onSetup}>
                            <Terminal className="size-3.5 text-zinc-500" /> Setup instructions
                        </DropdownMenuItem>
                        {canEdit && (
                            <DropdownMenuItem onSelect={() => setConfirm('rotate')}>
                                <RefreshCw className="size-3.5 text-zinc-500" /> Regenerate token
                            </DropdownMenuItem>
                        )}
                        {canDelete && (
                            <DropdownMenuItem onSelect={() => setConfirm('delete')}>
                                <Trash2 className="size-3.5 text-zinc-500" /> Delete
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="mt-1 flex items-center gap-2 px-1 text-xs text-zinc-500">
                <EnvironmentDot color={environment.last_ingested_at ? 'green' : 'gray'} className="size-1.5" />
                {environment.last_ingested_at ? `Last event ${timeAgo(environment.last_ingested_at)}` : 'No events received yet'}
                {Object.values(form.errors).map((error) => (
                    <span key={error} className="text-rose-600">
                        {error}
                    </span>
                ))}
            </div>

            <ConfirmDialog
                open={confirm === 'rotate'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Regenerate token"
                description="The current token stops working right away for new agent sessions. Update NIGHTWATCH_TOKEN wherever this environment's agent runs and restart it."
                confirmLabel="Regenerate"
                processing={processing}
                onConfirm={() =>
                    run(() =>
                        router.post(
                            `${url}/refresh-token`,
                            {},
                            { preserveScroll: true, onFinish: () => (setProcessing(false), setConfirm(null), setRevealed(true)) },
                        ),
                    )
                }
            />
            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title={`Delete ${environment.name}`}
                description="This deletes the environment and its token. Its agent will be rejected. Add NIGHTWATCH_ENABLED=false to that application to stop it from trying."
                confirmLabel="Delete"
                processing={processing}
                onConfirm={() => run(() => router.delete(url, { preserveScroll: true, onFinish: () => (setProcessing(false), setConfirm(null)) }))}
            />
        </div>
    );
}
