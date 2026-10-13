import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { envUrl } from '@/lib/rc';
import { router } from '@inertiajs/react';
import { CircleCheck, UserRound, X } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { AssigneePicker, type Member, PRIORITIES, PrioritySymbol } from './issues-controls';
import { EnvironmentSelect, type IssueEnvironment } from './issues-status';

export type BulkAction = 'status' | 'assignee' | 'priority';

/** Floating bar shown while issues are selected in the list. */
export function IssueSelectionBar({ count, onClear, onAction }: { count: number; onClear: () => void; onAction: (action: BulkAction) => void }) {
    if (count === 0) return null;

    return (
        <div className="fixed bottom-8 left-1/2 z-40 flex h-10 w-1/2 min-w-96 -translate-x-1/2 items-center justify-between rounded-full border border-blue-500 bg-blue-600 pr-1 pl-2 shadow-lg">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onClear}
                    title="Clear"
                    className="flex size-6 items-center justify-center rounded-full border border-white/5 bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                >
                    <X className="size-3" />
                </button>
                <p className="text-sm font-semibold text-white">
                    {count} <span className="text-blue-200">{count === 1 ? 'issue' : 'issues'} selected</span>
                </p>
            </div>
            <div className="flex items-center gap-1">
                <BarButton icon={<CircleCheck className="size-3.5 text-blue-200" />} label="Status" onClick={() => onAction('status')} />
                <BarButton icon={<UserRound className="size-3.5 text-blue-200" />} label="Assign" onClick={() => onAction('assignee')} />
                <BarButton
                    icon={<PrioritySymbol priority={3} className="size-3 [&_rect]:fill-blue-200" />}
                    label="Priority"
                    onClick={() => onAction('priority')}
                />
            </div>
        </div>
    );
}

function BarButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-sm text-white hover:bg-white/20"
        >
            {icon}
            {label}
        </button>
    );
}

/** "Update Issues" dialog applying status, assignee and/or priority to the selection. */
export function IssueBulkActionsModal({
    action,
    selected,
    users,
    environments,
    currentEnvironmentId,
    onClose,
    onSuccess,
}: {
    action: BulkAction | null;
    selected: number[];
    users: Member[];
    environments: IssueEnvironment[];
    currentEnvironmentId: string;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [enabled, setEnabled] = useState<BulkAction[]>([]);
    const [status, setStatus] = useState<string>('');
    const [environmentId, setEnvironmentId] = useState(currentEnvironmentId);
    const [comment, setComment] = useState('');
    const [assignee, setAssignee] = useState<number | null>(null);
    const [priority, setPriority] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (action) {
            setEnabled([action]);
            setStatus('');
            setEnvironmentId(currentEnvironmentId);
            setComment('');
            setAssignee(null);
            setPriority(0);
            setError(null);
        }
    }, [action, currentEnvironmentId]);

    const toggle = (key: BulkAction, on: boolean) => setEnabled((current) => (on ? [...current, key] : current.filter((k) => k !== key)));

    const submit = () => {
        if (enabled.includes('status') && !status) {
            setError('Status is required');

            return;
        }

        router.post(
            envUrl(currentEnvironmentId, 'issues/bulk-update'),
            {
                issues: selected,
                ...(enabled.includes('status') &&
                    (status === 'resolve_on_deploy' ? { resolve_on_deploy_environment_id: environmentId } : { status })),
                ...(enabled.includes('status') && comment.trim() ? { comment } : {}),
                ...(enabled.includes('assignee') ? { user_id: assignee } : {}),
                ...(enabled.includes('priority') ? { priority } : {}),
            },
            { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false), onSuccess },
        );
    };

    return (
        <Dialog open={action !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="gap-0 p-0">
                <DialogHeader className="p-6">
                    <DialogTitle>Update Issues</DialogTitle>
                    <DialogDescription>Choose properties to apply across all {selected.length} selected issues</DialogDescription>
                </DialogHeader>

                <Section label="Status" checked={enabled.includes('status')} onChange={(on) => toggle('status', on)}>
                    <Select
                        value={status}
                        onValueChange={(value) => {
                            setStatus(value);
                            setError(null);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="resolve_on_deploy">Resolved on next deploy</SelectItem>
                            <SelectItem value="ignored">Ignored</SelectItem>
                        </SelectContent>
                    </Select>
                    {error && <p className="text-sm text-rose-600">{error}</p>}
                    {status === 'resolve_on_deploy' && (
                        <EnvironmentSelect environments={environments} value={environmentId} onChange={setEnvironmentId} />
                    )}
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        placeholder="Add comment"
                        className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    />
                </Section>

                <Section label="Assignee" checked={enabled.includes('assignee')} onChange={(on) => toggle('assignee', on)}>
                    <AssigneePicker
                        value={assignee}
                        users={users}
                        onChange={setAssignee}
                        className="h-10 w-full rounded-md border border-zinc-200 px-3"
                    />
                </Section>

                <Section label="Priority" checked={enabled.includes('priority')} onChange={(on) => toggle('priority', on)}>
                    <Select value={String(priority)} onValueChange={(value) => setPriority(Number(value))}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PRIORITIES.map((p) => (
                                <SelectItem key={p.value} value={String(p.value)}>
                                    <span className="flex items-center gap-3">
                                        <PrioritySymbol priority={p.value} />
                                        {p.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Section>

                <div className="flex justify-end gap-3 border-t border-zinc-200 px-8 py-6">
                    <button type="button" onClick={onClose} className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={enabled.length === 0 || processing}
                        className="h-9 rounded-md bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                    >
                        Update {selected.length} {selected.length === 1 ? 'issue' : 'issues'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Section({
    label,
    checked,
    onChange,
    children,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    children: ReactNode;
}) {
    const id = `issue-bulk-${label.toLowerCase()}`;

    return (
        <div className="flex flex-col gap-3 border-t border-zinc-200 px-8 py-6">
            <div className="flex items-center gap-3">
                <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
                <label htmlFor={id} className="cursor-pointer text-base font-semibold">
                    {label}
                </label>
            </div>
            {checked && <div className="flex flex-col gap-2.5">{children}</div>}
        </div>
    );
}
