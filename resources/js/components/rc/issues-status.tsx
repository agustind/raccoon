import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { envUrl } from '@/lib/rc';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { Ban, CircleCheck, CircleDot, Hourglass } from 'lucide-react';
import { useEffect, useState } from 'react';

export type StatusAction = 'open' | 'resolve' | 'ignore' | 'resolve_on_deploy';

export interface IssueEnvironment {
    id: string;
    name: string;
    color: string;
}

const ACTION_STATUS: Record<Exclude<StatusAction, 'resolve_on_deploy'>, string> = { open: 'open', resolve: 'resolved', ignore: 'ignored' };

export function issueUrl(environmentId: string, ref: number | string, suffix = ''): string {
    return envUrl(environmentId, `issues/${ref}${suffix}`);
}

export function IssueStatusIcon({ status, pendingDeploy = false, className }: { status: string; pendingDeploy?: boolean; className?: string }) {
    if (pendingDeploy) return <Hourglass className={cn('size-4 text-emerald-500', className)} />;
    if (status === 'resolved') return <CircleCheck className={cn('size-4 text-emerald-500', className)} />;
    if (status === 'ignored') return <Ban className={cn('size-4 text-zinc-400', className)} />;

    return <CircleDot className={cn('size-4 text-blue-600', className)} />;
}

export function EnvironmentDot({ color }: { color: string }) {
    const colors: Record<string, string> = {
        blue: 'bg-blue-500',
        green: 'bg-emerald-500',
        emerald: 'bg-emerald-500',
        red: 'bg-rose-500',
        rose: 'bg-rose-500',
        orange: 'bg-orange-500',
        amber: 'bg-amber-500',
        yellow: 'bg-yellow-400',
        purple: 'bg-violet-500',
        violet: 'bg-violet-500',
        pink: 'bg-pink-500',
        gray: 'bg-zinc-400',
    };

    return <span className={cn('inline-block size-2 shrink-0 rounded-full', colors[color] ?? 'bg-zinc-400')} />;
}

/** Dropdown items for the status control. */
export function StatusMenuItems({
    status,
    pendingDeploy,
    onAction,
}: {
    status: string;
    pendingDeploy: boolean;
    onAction: (action: StatusAction) => void;
}) {
    return (
        <>
            {(status !== 'open' || pendingDeploy) && (
                <StatusItem
                    icon={<CircleDot className="size-3.5 text-blue-600" />}
                    label="Open"
                    description="Active issue affecting users"
                    onClick={() => onAction('open')}
                />
            )}
            {status !== 'resolved' && (
                <StatusItem
                    icon={<CircleCheck className="size-3.5 text-emerald-500" />}
                    label="Resolve now"
                    description="Reopen on reoccurrence"
                    onClick={() => onAction('resolve')}
                />
            )}
            {status === 'open' && !pendingDeploy && (
                <StatusItem
                    icon={<Hourglass className="size-3.5 text-emerald-500" />}
                    label="Resolve on next deploy"
                    description="Automatically resolve on next deployment"
                    onClick={() => onAction('resolve_on_deploy')}
                />
            )}
            {status !== 'ignored' && (
                <StatusItem
                    icon={<Ban className="size-3.5 text-zinc-400" />}
                    label="Ignore"
                    description="Resolve and ignore all future reoccurrences"
                    onClick={() => onAction('ignore')}
                    muted
                />
            )}
        </>
    );
}

function StatusItem({
    icon,
    label,
    description,
    onClick,
    muted = false,
}: {
    icon: React.ReactNode;
    label: string;
    description: string;
    onClick: () => void;
    muted?: boolean;
}) {
    return (
        <DropdownMenuItem onSelect={onClick} className="flex items-start gap-3 p-3">
            <span className="mt-0.5">{icon}</span>
            <span className="flex flex-col gap-1.5">
                <span className={cn('text-sm leading-none', muted ? 'text-zinc-500' : 'text-zinc-900')}>{label}</span>
                <span className="text-xs leading-none text-zinc-500">{description}</span>
            </span>
        </DropdownMenuItem>
    );
}

const DESCRIPTIONS: Record<StatusAction, string> = {
    open: 'This will reopen the issue for your team.',
    resolve: 'This will close the issue for your team. If new occurrences happen, the issue will automatically reopen.',
    ignore: 'This will close the issue and disable all new notifications and alerts on future occurrences for your team.',
    resolve_on_deploy: 'This issue will be automatically resolved when the next deploy is recorded for the selected environment.',
};

/** Confirmation dialog for a status change, with an optional comment. */
export function StatusModal({
    issueRef,
    action,
    onClose,
    environments,
    currentEnvironmentId,
}: {
    issueRef: number;
    action: StatusAction | null;
    onClose: () => void;
    environments: IssueEnvironment[];
    currentEnvironmentId: string;
}) {
    const [comment, setComment] = useState('');
    const [environmentId, setEnvironmentId] = useState(currentEnvironmentId);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (action) {
            setComment('');
            setEnvironmentId(currentEnvironmentId);
        }
    }, [action, currentEnvironmentId]);

    const submit = () => {
        if (!action) return;

        const change = action === 'resolve_on_deploy' ? { resolve_on_deploy_environment_id: environmentId } : { status: ACTION_STATUS[action] };
        const options = { preserveScroll: true, onStart: () => setProcessing(true), onFinish: () => setProcessing(false), onSuccess: onClose };

        if (comment.trim()) {
            router.post(issueUrl(currentEnvironmentId, issueRef, '/comments'), { comment, ...change }, options);
        } else {
            router.patch(issueUrl(currentEnvironmentId, issueRef), change, options);
        }
    };

    const title = action === 'resolve_on_deploy' ? 'Resolve on next deploy' : action ? `${action[0].toUpperCase()}${action.slice(1)} issue` : '';

    return (
        <Dialog open={action !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {action && (
                            <IssueStatusIcon
                                status={action === 'resolve' ? 'resolved' : action === 'ignore' ? 'ignored' : 'open'}
                                pendingDeploy={action === 'resolve_on_deploy'}
                                className="size-5"
                            />
                        )}
                        {title}
                    </DialogTitle>
                    <DialogDescription>{action ? DESCRIPTIONS[action] : ''}</DialogDescription>
                </DialogHeader>

                {action === 'resolve_on_deploy' && (
                    <EnvironmentSelect environments={environments} value={environmentId} onChange={setEnvironmentId} />
                )}

                <label className="block">
                    <span className="mb-2 flex items-center justify-between text-sm font-medium">
                        Add comment <span className="font-normal text-zinc-500">Optional</span>
                    </span>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={4}
                        placeholder="Add a comment..."
                        className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    />
                </label>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={processing}
                        className="h-9 rounded-md bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                    >
                        {title}
                        {comment.trim() ? ' with comment' : ''}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function EnvironmentSelect({
    environments,
    value,
    onChange,
}: {
    environments: IssueEnvironment[];
    value: string;
    onChange: (id: string) => void;
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-sm font-medium">Environment</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {environments.map((environment) => (
                        <SelectItem key={environment.id} value={environment.id}>
                            <span className="flex items-center gap-2">
                                <EnvironmentDot color={environment.color} />
                                {environment.name}
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </label>
    );
}
