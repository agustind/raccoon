import DataTable from '@/components/rc/data-table';
import ShortTimeAgo from '@/components/rc/exceptions-time-ago';
import FilterTabs from '@/components/rc/filter-tabs';
import { type BulkAction, IssueBulkActionsModal, IssueSelectionBar } from '@/components/rc/issues-bulk';
import { AssigneePicker, type Member, PriorityPicker, PrioritySymbol } from '@/components/rc/issues-controls';
import { issueUrl } from '@/components/rc/issues-status';
import { Pagination } from '@/components/rc/pagination';
import SearchInput from '@/components/rc/search-input';
import { Checkbox } from '@/components/ui/checkbox';
import EnvironmentLayout from '@/layouts/environment-layout';
import { formatCompact, formatNumber } from '@/lib/format';
import { envUrl } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { PageProps, Paginator } from '@/types/raccoon';
import { Link, router, usePage } from '@inertiajs/react';
import { Hourglass } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface IssueRow {
    type: 'exception' | 'alert';
    ref: number;
    priority: number;
    title: string;
    subtitle: string | null;
    status: string;
    issueable_type: string;
    first_seen_at: string;
    last_seen_at: string;
    user: Member | null;
    occurrences: number;
    impacted_users: number;
    resolve_on_deploy_environment_id: string | null;
}

interface Props {
    type: 'exception' | 'alert';
    filter: string;
    search: string | null;
    sortBy: string;
    sortDirection: string;
    issues: Paginator<IssueRow>;
    users: Member[];
    filterStats: Record<'unassigned' | 'mine' | 'open' | 'resolved' | 'ignored' | 'exception' | 'alert', number>;
}

const TYPE_LABELS: Record<string, string> = { route: 'Route', job: 'Job', command: 'Command', scheduled_task: 'Scheduled Task' };

export default function IssuesIndex(props: Props) {
    const { auth } = usePage<PageProps>().props;
    const env = auth.env!;
    const [selected, setSelected] = useState<number[]>([]);
    const [anchor, setAnchor] = useState<number | null>(null);
    const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
    const refs = useMemo(() => props.issues.data.map((issue) => issue.ref), [props.issues.data]);
    const environments = useMemo(
        () =>
            auth.user?.organizations
                .flatMap((org) => org.applications)
                .find((app) => app.id === auth.app?.id)
                ?.environments.map((e) => ({ id: e.id, name: e.name, color: e.color })) ?? [],
        [auth.user, auth.app],
    );

    // A different page of results drops the selection.
    useEffect(() => setSelected((current) => current.filter((ref) => refs.includes(ref))), [refs]);

    const toggle = (ref: number, range: boolean) => {
        let affected = [ref];

        if (range && anchor !== null) {
            const [from, to] = [refs.indexOf(anchor), refs.indexOf(ref)].sort((a, b) => a - b);
            affected = refs.slice(from, to + 1);
        }

        setSelected((current) => (current.includes(ref) ? current.filter((r) => !affected.includes(r)) : [...new Set([...current, ...affected])]));
        setAnchor(ref);
    };

    const patch = (ref: number, data: Record<string, number | null>) => router.patch(issueUrl(env.id, ref), data, { preserveScroll: true, preserveState: true });
    const allChecked = selected.length === 0 ? false : selected.length < refs.length ? 'indeterminate' : true;
    const query = typeof window !== 'undefined' ? window.location.search : '';

    return (
        <EnvironmentLayout
            title="Issues"
            heading={
                <span className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 align-middle text-sm font-normal tracking-normal">
                    <TypeTab href={envUrl(env.id, 'issues/exceptions') + query} active={props.type === 'exception'} label="Exceptions" count={props.filterStats.exception} />
                    <TypeTab href={envUrl(env.id, 'issues/performance') + query} active={props.type === 'alert'} label="Performance" count={props.filterStats.alert} />
                </span>
            }
            actions={
                <>
                    <SearchInput value={props.search} placeholder="Search" />
                    <FilterTabs
                        param="filter"
                        value={props.filter === 'open' ? null : props.filter}
                        options={[
                            { value: null, label: 'Open', count: props.filterStats.open },
                            { value: 'unassigned', label: 'Unassigned', count: props.filterStats.unassigned },
                            { value: 'mine', label: 'Mine', count: props.filterStats.mine },
                            { value: 'resolved', label: 'Resolved' },
                            { value: 'ignored', label: 'Ignored' },
                        ]}
                    />
                </>
            }
        >
            <DataTable<IssueRow>
                rows={props.issues.data}
                rowKey={(row) => String(row.ref)}
                sortBy={props.sortBy}
                sortDirection={props.sortDirection}
                rowHref={(row) => issueUrl(env.id, row.ref)}
                empty="No issues found"
                columns={[
                    {
                        key: 'select',
                        label: <Checkbox checked={allChecked} onCheckedChange={() => setSelected(allChecked ? [] : refs)} aria-label="Select all" />,
                        width: '20px',
                        render: (row) => (
                            <span
                                className="relative z-10 flex items-center"
                                onClick={(event) => {
                                    event.preventDefault();
                                    toggle(row.ref, event.shiftKey);
                                }}
                            >
                                <Checkbox checked={selected.includes(row.ref)} aria-label={`Select issue ${row.ref}`} />
                            </span>
                        ),
                    },
                    { key: 'ref', label: 'ID', width: '50px', sortable: true, render: (row) => <span className="font-sans text-sm">{row.ref}</span> },
                    {
                        key: 'priority',
                        label: <PrioritySymbol priority={props.sortBy === 'priority' && props.sortDirection === 'desc' ? 3 : 0} />,
                        width: '40px',
                        sortable: true,
                        render: (row) => <PriorityPicker value={row.priority} showLabel={false} onChange={(priority) => patch(row.ref, { priority })} className="relative z-10 p-1" />,
                    },
                    {
                        key: 'title',
                        label: 'Issue',
                        sortable: true,
                        render: (row) => (
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className={cn('flex items-center gap-1.5 truncate font-sans text-sm', row.resolve_on_deploy_environment_id && 'text-zinc-500')}>
                                    {row.resolve_on_deploy_environment_id && <Hourglass className="size-3.5 shrink-0 text-emerald-500" />}
                                    <span className="truncate">{row.title}</span>
                                </span>
                                {row.subtitle && <span className="truncate text-xs tracking-tight text-zinc-500">{row.subtitle}</span>}
                            </div>
                        ),
                    },
                    ...(props.type === 'exception'
                        ? [
                              {
                                  key: 'count',
                                  label: 'Count',
                                  width: '60px',
                                  align: 'right' as const,
                                  sortable: true,
                                  render: (row: IssueRow) => <span className="text-zinc-600" title={`${formatNumber(row.occurrences)} occurrences in the last ${auth.org?.lookback_period ?? 30} days`}>{formatCompact(row.occurrences)}</span>,
                              },
                              {
                                  key: 'users',
                                  label: 'Users',
                                  width: '60px',
                                  align: 'right' as const,
                                  sortable: true,
                                  render: (row: IssueRow) => <span className="text-zinc-600" title={`${formatNumber(row.impacted_users)} users impacted in the last ${auth.org?.lookback_period ?? 30} days`}>{formatCompact(row.impacted_users)}</span>,
                              },
                          ]
                        : [{ key: 'type', label: 'Type', width: '120px', sortable: true, render: (row: IssueRow) => <span className="text-zinc-600">{TYPE_LABELS[row.issueable_type] ?? row.issueable_type}</span> }]),
                    { key: 'first_seen', label: <span className="whitespace-nowrap">First seen</span>, width: '100px', align: 'right', sortable: true, render: (row) => <ShortTimeAgo value={row.first_seen_at} className="text-zinc-600" /> },
                    { key: 'last_seen', label: <span className="whitespace-nowrap">Last seen</span>, width: '100px', align: 'right', sortable: true, render: (row) => <ShortTimeAgo value={row.last_seen_at} className="text-zinc-600" /> },
                    {
                        key: 'assigned',
                        label: 'Assigned',
                        width: '80px',
                        align: 'center',
                        sortable: true,
                        render: (row) => <AssigneePicker value={row.user?.id ?? null} users={props.users} showName={false} onChange={(user_id) => patch(row.ref, { user_id })} className="relative z-10 p-1" />,
                    },
                ]}
            />
            <Pagination paginator={props.issues} />

            <IssueSelectionBar count={selected.length} onClear={() => setSelected([])} onAction={setBulkAction} />
            <IssueBulkActionsModal
                action={bulkAction}
                selected={selected}
                users={props.users}
                environments={environments}
                currentEnvironmentId={env.id}
                onClose={() => setBulkAction(null)}
                onSuccess={() => {
                    setSelected([]);
                    setBulkAction(null);
                }}
            />
        </EnvironmentLayout>
    );
}

function TypeTab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
    return (
        <Link href={href} replace preserveScroll className={cn('flex h-full items-center gap-2 rounded-md px-3 text-zinc-600 hover:text-zinc-900', active && 'bg-white text-zinc-900 shadow-xs')}>
            {label}
            <span className={cn('rounded px-1 font-mono text-[10px]', active ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-600')}>{count}</span>
        </Link>
    );
}
