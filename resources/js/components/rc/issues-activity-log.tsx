import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PageProps } from '@/types/raccoon';
import { router, usePage } from '@inertiajs/react';
import { Ban, CircleCheck, CircleDot, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Avatar, type Member, PRIORITIES } from './issues-controls';
import { issueUrl } from './issues-status';

export interface ActivityLog {
    id: number;
    event: string;
    payload: Record<string, unknown> & {
        comment?: string;
        new_status?: string;
        new_priority?: number;
        new_assignee?: { id: number; name: string } | null;
        marked?: boolean;
        environment_name?: string | null;
        deploy_ref?: string | null;
    };
    user_id: number | null;
    user: Member | null;
    timestamp: string;
    created_at: string;
}

const STATUS = {
    open: { label: 'Open', verb: 'opened', icon: CircleDot },
    resolved: { label: 'Resolved', verb: 'resolved', icon: CircleCheck },
    ignored: { label: 'Ignored', verb: 'ignored', icon: Ban },
} as const;

type Status = keyof typeof STATUS;

const COMMENT_EVENTS = ['comment_added', 'comment_updated', 'status_updated_with_comment', 'status_update_comment_updated'];

function describe(log: ActivityLog): string {
    const p = log.payload;
    const status = STATUS[(p.new_status as Status) ?? 'open'] ?? STATUS.open;

    switch (log.event) {
        case 'issue_created':
            return 'created the issue';
        case 'resolved_on_deploy':
            return p.deploy_ref ? `auto-resolved the issue on release ${p.deploy_ref}` : 'auto-resolved the issue on release';
        case 'marked_for_resolve_on_deploy':
            if (!p.marked) return 'unmarked the issue from being resolved on next release';

            return `marked the issue to be resolved on next ${p.environment_name ? `${p.environment_name} ` : ''}release${p.deploy_ref ? ` (after release ${p.deploy_ref})` : ''}`;
        case 'status_updated':
            return `updated the status to ${status.label}`;
        case 'priority_updated':
            return p.new_priority === 0 ? 'removed the priority' : `updated the priority to ${PRIORITIES[p.new_priority ?? 0]?.label}`;
        case 'assignee_updated':
            if (!p.new_assignee) return 'unassigned the issue';

            return p.new_assignee.id === log.user?.id ? 'self-assigned the issue' : `assigned the issue to ${p.new_assignee.name}`;
        case 'comment_added':
        case 'comment_updated':
        case 'comment_deleted':
            return 'added a comment';
        case 'status_updated_with_comment':
        case 'status_update_comment_updated':
        case 'status_update_comment_deleted':
            return `added a comment and ${status.verb} the issue`;
        default:
            return log.event.replace(/_/g, ' ');
    }
}

/** One activity entry: actor, what happened, when, and the comment if any. */
export default function ActivityLogItem({ log, environmentId, issueRef }: { log: ActivityLog; environmentId: string; issueRef: number }) {
    const { auth } = usePage<PageProps>().props;
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [comment, setComment] = useState(log.payload.comment ?? '');
    const own = log.user !== null && log.user.id === auth.user?.id;
    const url = issueUrl(environmentId, issueRef, `/comments/${log.id}`);
    const status = log.payload.new_status as Status | undefined;
    const StatusIcon = status ? STATUS[status]?.icon : null;

    const save = () => router.patch(url, { comment }, { preserveScroll: true, onSuccess: () => setEditing(false) });

    return (
        <div className="overflow-x-hidden">
            <div className="flex gap-1.5 text-sm">
                {log.user ? (
                    <Avatar user={log.user} className="size-6" />
                ) : (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <span className="size-2 rounded-full bg-blue-600" />
                    </span>
                )}
                <div className="ml-2 leading-6">
                    <span className="text-zinc-900">{log.user?.name ?? (log.user_id ? '[Deleted User]' : 'Raccoon')} </span>
                    <span className="text-zinc-600">{describe(log)}</span>
                    <span className="text-zinc-400"> • </span>
                    <span className="text-zinc-600" title={log.timestamp}>
                        {timeAgo(log.timestamp)}
                    </span>
                </div>
            </div>

            {COMMENT_EVENTS.includes(log.event) && (
                <div className="group relative mt-3 ml-10">
                    <div
                        className={cn(
                            'flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700',
                            log.event.startsWith('status_update') && status === 'resolved' && 'border-emerald-400 bg-emerald-50',
                            log.event.startsWith('status_update') && status === 'ignored' && 'border-blue-300 bg-blue-50',
                        )}
                    >
                        {log.event.startsWith('status_update') && StatusIcon && (
                            <div className="flex items-center gap-2 text-sm font-semibold capitalize">
                                <StatusIcon className="size-4" />
                                {status}
                            </div>
                        )}
                        {editing ? (
                            <div>
                                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded-md border border-zinc-200 px-3 py-2 outline-none" />
                                <div className="mt-2 flex justify-end gap-2">
                                    <button type="button" onClick={() => setEditing(false)} className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-sm">
                                        Cancel
                                    </button>
                                    <button type="button" onClick={save} className="h-8 rounded-md bg-zinc-900 px-3 text-sm text-white">
                                        Save changes
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap">{log.payload.comment}</p>
                        )}
                    </div>
                    {own && !editing && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-1 py-0.5 opacity-0 shadow-sm transition group-hover:opacity-100">
                            {confirming ? (
                                <>
                                    <span className="px-1 text-xs">Are you sure?</span>
                                    <button type="button" onClick={() => setConfirming(false)} className="rounded-full px-2 py-0.5 text-xs hover:bg-zinc-100">
                                        Cancel
                                    </button>
                                    <button type="button" onClick={() => router.delete(url, { preserveScroll: true })} className="rounded-full bg-rose-600 px-2 py-0.5 text-xs text-white">
                                        Delete
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" title="Edit" onClick={() => setEditing(true)} className="flex size-6 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100">
                                        <Pencil className="size-3" />
                                    </button>
                                    <button type="button" title="Delete" onClick={() => setConfirming(true)} className="flex size-6 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100">
                                        <Trash2 className="size-3" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {['comment_deleted', 'status_update_comment_deleted'].includes(log.event) && (
                <div className="mt-3 ml-10 rounded-lg border border-zinc-200 bg-white/50 p-3 text-sm text-zinc-500 italic">This comment was deleted</div>
            )}
        </div>
    );
}
