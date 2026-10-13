import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { envUrl } from '@/lib/rc';
import type { PageProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, Radio } from 'lucide-react';
import { IssueStatusIcon } from './issues-status';

export interface RelatedIssue {
    ref: number;
    title: string;
    status: string;
    priority?: number;
}

/** "1 issue" dropdown in detail page headers, linking to the issues for this group. */
export default function RelatedIssuesButton({ issues }: { issues: RelatedIssue[] }) {
    const { auth } = usePage<PageProps>().props;

    if (issues.length === 0) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-xs hover:bg-zinc-50">
                <Radio className="size-4 text-zinc-500" />
                {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
                <ChevronDown className="size-3.5 text-zinc-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                {issues.map((issue) => (
                    <DropdownMenuItem key={issue.ref} asChild>
                        <Link href={envUrl(auth.env!.id, `issues/${issue.ref}`)} className="flex items-center gap-2">
                            <IssueStatusIcon status={issue.status} />
                            <span className="font-mono text-xs text-zinc-500">#{issue.ref}</span>
                            <span className="truncate">{issue.title}</span>
                        </Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
