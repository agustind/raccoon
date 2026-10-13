import { MethodBadge } from '@/components/rc/badges';
import SettingsApplicationTabs from '@/components/rc/settings-tabs';
import { Button, ConfirmDialog, Field, Modal, ModalFooter, SettingsCard, SettingsEmpty, SettingsRows, TextInput } from '@/components/rc/settings-ui';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import SettingsLayout from '@/layouts/settings-layout';
import { formatNumber } from '@/lib/format';
import { can } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { PageProps, Paginator } from '@/types/raccoon';
import { router, useForm, usePage } from '@inertiajs/react';
import { Check, LoaderCircle, MoreHorizontal, Pencil, Search, Timer, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type ThresholdType = 'route' | 'job' | 'command' | 'scheduled_task';

interface Threshold {
    id: number;
    type: ThresholdType;
    group: string;
    name: string;
    duration: number;
}

interface Candidate {
    group: string;
    label: string;
    name?: string;
    methods?: string[];
    domain?: string;
    path?: string;
    cron?: string;
}

interface Props {
    organization: { id: string; name: string };
    application: { id: string; name: string };
    thresholds: Record<ThresholdType, Threshold[]>;
    routes: Paginator<Candidate>;
    jobs: Paginator<Candidate>;
    commands: Paginator<Candidate>;
    scheduled_tasks: Paginator<Candidate>;
}

const SECTIONS: { type: ThresholdType; title: string; prop: 'routes' | 'jobs' | 'commands' | 'scheduled_tasks'; noun: string }[] = [
    { type: 'route', title: 'Routes', prop: 'routes', noun: 'route' },
    { type: 'job', title: 'Jobs', prop: 'jobs', noun: 'job' },
    { type: 'command', title: 'Commands', prop: 'commands', noun: 'command' },
    { type: 'scheduled_task', title: 'Scheduled Tasks', prop: 'scheduled_tasks', noun: 'scheduled task' },
];

export default function Thresholds(props: Props) {
    const { organization, application, thresholds } = props;
    const { auth } = usePage<PageProps>().props;
    const base = `/settings/organizations/${organization.id}/applications/${application.id}/thresholds`;
    const [adding, setAdding] = useState<(typeof SECTIONS)[number] | null>(null);
    const canCreate = can(auth.permissions, 'threshold.create');

    return (
        <SettingsLayout
            title={`${application.name} thresholds`}
            heading={application.name}
            tabs={<SettingsApplicationTabs organizationId={organization.id} applicationId={application.id} />}
        >
            <SettingsCard title="Setting up thresholds">
                <p className="-mt-2 px-5 pb-5 text-base text-zinc-700">
                    Monitor application-wide performance by setting custom duration thresholds. Executions running longer than your thresholds open
                    performance issues and trigger notifications.
                </p>
            </SettingsCard>

            {SECTIONS.map((section) => {
                const rows = thresholds[section.type] ?? [];

                return (
                    <SettingsCard
                        key={section.type}
                        title={section.title}
                        onAdd={canCreate && rows.length > 0 ? () => setAdding(section) : undefined}
                        addLabel="Add threshold"
                    >
                        {rows.length === 0 ? (
                            <SettingsEmpty
                                label="Add threshold"
                                onClick={canCreate ? () => setAdding(section) : undefined}
                                message={canCreate ? undefined : 'No thresholds'}
                            />
                        ) : (
                            <SettingsRows>
                                {rows.map((threshold) => (
                                    <ThresholdRow key={threshold.id} threshold={threshold} url={`${base}/${threshold.id}`} />
                                ))}
                            </SettingsRows>
                        )}
                    </SettingsCard>
                );
            })}

            {adding && (
                <AddThresholdDialog
                    key={adding.type}
                    section={adding}
                    url={base}
                    paginator={props[adding.prop]}
                    existing={(thresholds[adding.type] ?? []).map((t) => t.group)}
                    onClose={() => setAdding(null)}
                />
            )}
        </SettingsLayout>
    );
}

function TargetLabel({ type, name }: { type: ThresholdType; name: string }) {
    // Route names are stored as "GET|POST /path"; older rows may be just the path.
    const match = type === 'route' ? name.match(/^([A-Z|]+) (.*)$/) : null;

    if (!match) return <span className="truncate font-mono text-sm">{name}</span>;

    const [, methods, ...rest] = match;

    return (
        <span className="flex min-w-0 items-center gap-2">
            <MethodBadge methods={methods.split('|')} />
            <span className="truncate font-mono text-sm">{rest.join(' ')}</span>
        </span>
    );
}

function ThresholdRow({ threshold, url }: { threshold: Threshold; url: string }) {
    const { auth } = usePage<PageProps>().props;
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [processing, setProcessing] = useState(false);
    const form = useForm({ duration: String(threshold.duration) });
    const canEdit = can(auth.permissions, 'threshold.edit');
    const canDelete = can(auth.permissions, 'threshold.delete');

    return (
        <div className="flex h-12 items-center gap-4 px-4">
            <div className="min-w-0 flex-1">
                <TargetLabel type={threshold.type} name={threshold.name} />
            </div>
            <span className="flex items-center gap-1.5 font-mono text-sm text-zinc-700">
                <Timer className="size-3.5 text-zinc-400" />
                {formatNumber(threshold.duration)}ms
            </span>
            {(canEdit || canDelete) && (
                <DropdownMenu>
                    <DropdownMenuTrigger
                        className="flex size-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-900"
                        aria-label="Threshold actions"
                    >
                        <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {canEdit && (
                            <DropdownMenuItem onSelect={() => setEditing(true)}>
                                <Pencil className="size-3.5 text-zinc-500" /> Edit
                            </DropdownMenuItem>
                        )}
                        {canDelete && (
                            <DropdownMenuItem onSelect={() => setDeleting(true)}>
                                <Trash2 className="size-3.5 text-zinc-500" /> Delete
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            <Modal open={editing} onOpenChange={setEditing} title="Edit threshold" description={threshold.name}>
                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.patch(url, { preserveScroll: true, onSuccess: () => setEditing(false) });
                    }}
                >
                    <DurationField value={form.data.duration} onChange={(value) => form.setData('duration', value)} error={form.errors.duration} />
                    <ModalFooter>
                        <Button onClick={() => setEditing(false)}>Cancel</Button>
                        <Button type="submit" variant="primary" loading={form.processing}>
                            Save threshold
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>
            <ConfirmDialog
                open={deleting}
                onOpenChange={setDeleting}
                title="Delete threshold"
                description="This action cannot be undone."
                confirmLabel="Delete"
                processing={processing}
                onConfirm={() => {
                    setProcessing(true);
                    router.delete(url, { preserveScroll: true, onFinish: () => (setProcessing(false), setDeleting(false)) });
                }}
            />
        </div>
    );
}

function DurationField({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
    return (
        <Field label="Duration" error={error} htmlFor="duration">
            <div className="relative">
                <TextInput
                    id="duration"
                    type="number"
                    min={1}
                    max={3600000}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="pr-10"
                />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-zinc-500">ms</span>
            </div>
        </Field>
    );
}

function AddThresholdDialog({
    section,
    url,
    paginator,
    existing,
    onClose,
}: {
    section: (typeof SECTIONS)[number];
    url: string;
    paginator: Paginator<Candidate>;
    existing: string[];
    onClose: () => void;
}) {
    const form = useForm({ type: section.type, group: '', duration: '1000' });
    const [selected, setSelected] = useState<Candidate | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const first = useRef(true);

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }

        const timer = setTimeout(() => {
            setLoading(true);
            router.reload({
                only: [section.prop],
                data: { [`${section.prop}_search`]: search || undefined, [section.prop]: undefined },
                onFinish: () => setLoading(false),
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [search, section.prop]);

    return (
        <Modal
            open
            onOpenChange={(open) => !open && onClose()}
            title={`Add ${section.noun} threshold`}
            description="Executions that meet or exceed the threshold open a performance issue and trigger notifications."
            className="max-w-xl"
        >
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post(url, { preserveScroll: true, onSuccess: onClose });
                }}
            >
                <Field label={section.title.replace(/s$/, '')} error={form.errors.group}>
                    <div className="rounded-lg border border-zinc-200 bg-white shadow-xs">
                        <div className="flex items-center gap-2 border-b border-zinc-200 px-3">
                            <Search className="size-4 text-zinc-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={`Search ${section.noun}s`}
                                className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                                aria-label={`Search ${section.noun}s`}
                            />
                            {loading && <LoaderCircle className="size-4 animate-spin text-zinc-400" />}
                        </div>
                        <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
                            {paginator.data.length === 0 && (
                                <li className="px-3 py-6 text-center text-sm text-zinc-500">No {section.noun}s seen in the last 30 days.</li>
                            )}
                            {paginator.data.map((candidate) => {
                                const added = existing.includes(candidate.group);
                                const active = selected?.group === candidate.group;

                                return (
                                    <li key={candidate.group}>
                                        <button
                                            type="button"
                                            disabled={added}
                                            role="option"
                                            aria-selected={active}
                                            onClick={() => {
                                                setSelected(candidate);
                                                form.setData('group', candidate.group);
                                            }}
                                            className={cn(
                                                'flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50',
                                                active && 'bg-blue-50',
                                            )}
                                        >
                                            <Check className={cn('size-3.5 shrink-0 text-blue-600', !active && 'invisible')} />
                                            <span className="min-w-0 flex-1">
                                                {section.type === 'route' ? (
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <MethodBadge methods={(candidate.methods ?? []).filter((m) => m !== 'HEAD')} />
                                                        <span className="truncate font-mono text-sm">
                                                            {(candidate.domain ?? '') + (candidate.path ?? '')}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="block truncate font-mono text-sm">{candidate.name}</span>
                                                )}
                                            </span>
                                            {added && <span className="text-xs text-zinc-400">Added</span>}
                                            {candidate.cron && !added && <span className="font-mono text-xs text-zinc-400">{candidate.cron}</span>}
                                        </button>
                                    </li>
                                );
                            })}
                            {paginator.total > paginator.data.length && (
                                <li className="px-3 py-2 text-xs text-zinc-500">
                                    Showing {paginator.data.length} of {formatNumber(paginator.total)}. Search to narrow down.
                                </li>
                            )}
                        </ul>
                    </div>
                </Field>
                <DurationField value={form.data.duration} onChange={(value) => form.setData('duration', value)} error={form.errors.duration} />
                <ModalFooter>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="primary" loading={form.processing} disabled={!selected}>
                        Add threshold
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
