import { Pill } from '@/components/rc/badges';
import CodeBlock from '@/components/rc/code-block';
import Drawer from '@/components/rc/drawer';
import LevelFilter from '@/components/rc/logs-level-filter';
import SourceLink, { type ExecutionSource } from '@/components/rc/source-link';
import PeriodPicker from '@/components/rc/period-picker';
import SearchInput from '@/components/rc/search-input';
import { Card, Label } from '@/components/rc/section';
import Timestamp from '@/components/rc/timestamp';
import UserFilter from '@/components/rc/user-filter';
import EnvironmentLayout from '@/layouts/environment-layout';
import { envUrl } from '@/lib/rc';
import { cn } from '@/lib/utils';
import type { CursorPaginator, PageProps, PeriodProps } from '@/types/raccoon';
import { Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, Braces, PanelRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface LogEntry extends ExecutionSource {
    timestamp: string;
    user: string;
    level: string;
    message: string;
    context: string;
    extra: string;
}

interface Props extends PeriodProps {
    activeUserFilter: string | null;
    search: string | null;
    levels: string[];
    now: string;
    logs: CursorPaginator<LogEntry>;
}

export default function LogsIndex(props: Props) {
    const [entries, setEntries] = useState(props.logs.data);
    const [nextUrl, setNextUrl] = useState(props.logs.next_page_url);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<LogEntry | null>(null);
    const top = useRef<HTMLDivElement>(null);
    const bottom = useRef<HTMLDivElement>(null);
    // Page height before prepending older entries, to keep the viewport in place.
    const heightBeforeLoad = useRef<number | null>(null);

    // New filters or period: start over from the newest entries, scrolled to the bottom.
    useLayoutEffect(() => {
        setEntries(props.logs.data);
        setNextUrl(props.logs.next_page_url);
        heightBeforeLoad.current = null;
        requestAnimationFrame(() => bottom.current?.scrollIntoView({ block: 'end' }));
    }, [props.logs]);

    useLayoutEffect(() => {
        if (heightBeforeLoad.current !== null) {
            window.scrollBy({ top: document.body.scrollHeight - heightBeforeLoad.current, behavior: 'instant' });
            heightBeforeLoad.current = null;
        }
    }, [entries]);

    // Scrolling to the top loads older entries.
    useEffect(() => {
        const element = top.current;

        if (!element || !nextUrl) return;

        const observer = new IntersectionObserver(
            (observed) => {
                if (!observed[0].isIntersecting || loading) return;

                setLoading(true);
                fetch(nextUrl, { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
                    .then((response) => (response.ok ? response.json() : Promise.reject(response)))
                    .then((page: CursorPaginator<LogEntry>) => {
                        heightBeforeLoad.current = document.body.scrollHeight;
                        setEntries((current) => [...current, ...page.data]);
                        setNextUrl(page.next_page_url);
                    })
                    .finally(() => setLoading(false));
            },
            { rootMargin: '400px' },
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, [nextUrl, loading]);

    return (
        <EnvironmentLayout
            title="Logs"
            actions={
                <>
                    <SearchInput value={props.search} placeholder="Search logs" />
                    <LevelFilter active={props.levels} />
                    <UserFilter active={props.activeUserFilter} />
                    <PeriodPicker period={props.period} />
                </>
            }
        >
            <div ref={top} className="flex min-h-12 items-center justify-center">
                {loading && <span className="animate-pulse rounded-lg bg-white px-3 py-1 font-mono text-sm uppercase">Loading...</span>}
                {!loading && !nextUrl && <div className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-center font-mono text-sm uppercase">End of logs</div>}
            </div>

            <div className="mt-1.5 grid grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] gap-x-4 gap-y-1">
                {[...entries].reverse().map((entry, index) => (
                    <LogLine key={`${entry.timestamp}:${index}`} entry={entry} active={selected === entry} onSelect={() => setSelected(entry)} />
                ))}
            </div>

            <div ref={bottom} className="pt-16 pb-24 text-center font-mono text-sm text-zinc-600 uppercase">
                Latest as of <Timestamp value={props.now} />
            </div>

            <Drawer open={selected !== null} onClose={() => setSelected(null)} title={selected ? <Timestamp value={selected.timestamp} /> : ''}>
                {selected && <LogDetails entry={selected} />}
            </Drawer>
        </EnvironmentLayout>
    );
}

function hasData(json: string): boolean {
    return Boolean(json) && json !== '[]' && json !== '{}';
}

function LogLine({ entry, active, onSelect }: { entry: LogEntry; active: boolean; onSelect: () => void }) {
    const withData = hasData(entry.context) || hasData(entry.extra);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(event) => event.key === 'Enter' && onSelect()}
            className={cn(
                'group col-span-full grid cursor-pointer grid-cols-subgrid items-start rounded-md border bg-white text-left',
                active ? 'border-zinc-400 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50',
                entry.level === 'emergency' && 'bg-rose-100 hover:bg-rose-200',
            )}
        >
            <div className="py-1.5 pl-3 font-mono text-xs leading-loose whitespace-nowrap text-zinc-600">{entry.timestamp.slice(0, 23)}</div>
            <div className="py-1.5" onClick={(event) => event.stopPropagation()}>
                <SourceLink row={entry} />
            </div>
            <div className="py-1.5 text-xs leading-loose">
                <LevelLabel level={entry.level} />
            </div>
            <div className="line-clamp-3 py-1.5 font-mono text-xs leading-loose break-all whitespace-pre-wrap">{entry.message}</div>
            <div className="relative m-1.5 flex size-6 items-center justify-center">
                <PanelRight className="hidden size-3.5 text-zinc-500 group-hover:block" />
                {withData && (
                    <>
                        <Braces className="absolute top-0 right-0 hidden size-3 text-blue-600 group-hover:block" />
                        <span className="size-[5px] rounded-full bg-zinc-400 group-hover:hidden" />
                    </>
                )}
            </div>
        </div>
    );
}

function LevelLabel({ level }: { level: string }) {
    const colors: Record<string, string> = {
        debug: 'text-zinc-600',
        info: 'text-blue-600',
        notice: 'text-emerald-500',
        warning: 'text-orange-400',
        error: 'text-rose-500',
    };

    if (level === 'critical') return <Pill tone="warning">Critical</Pill>;
    if (level === 'alert') return <Pill className="bg-amber-500 text-white">Alert</Pill>;
    if (level === 'emergency') return <Pill className="bg-rose-600 text-white">Emergency</Pill>;

    return <span className={cn('font-mono uppercase', colors[level] ?? 'text-zinc-600')}>[{level}]</span>;
}

function LogDetails({ entry }: { entry: LogEntry }) {
    const { auth } = usePage<PageProps>().props;

    return (
        <div className="mt-2 space-y-4">
            <div className="font-mono text-sm leading-6">
                <LevelLabel level={entry.level} /> <span className="break-all whitespace-pre-wrap">{entry.message}</span>
            </div>

            <Card>
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
                    <span className="text-sm font-medium">Source</span>
                    {entry.execution_url && (
                        <Link href={envUrl(auth.env!.id, entry.execution_url)} className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 font-mono text-xs uppercase hover:bg-zinc-50">
                            {entry.execution_source} <ArrowUpRight className="size-3.5 text-emerald-500" />
                        </Link>
                    )}
                </div>
                <div className="p-4 font-mono text-xs leading-6">{entry.execution_preview || entry.execution_source || 'Unknown'}</div>
            </Card>

            {entry.user && (
                <Card className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-medium">User</span>
                    <Link href={envUrl(auth.env!.id, `users/${entry.user}`)} className="flex items-center gap-1 font-mono text-xs hover:underline">
                        {entry.user} <ArrowUpRight className="size-3.5" />
                    </Link>
                </Card>
            )}

            {hasData(entry.context) && (
                <div>
                    <Label>Log context</Label>
                    <CodeBlock code={entry.context} json className="mt-2" />
                </div>
            )}

            {hasData(entry.extra) && (
                <div>
                    <Label>Extra</Label>
                    <CodeBlock code={entry.extra} json className="mt-2" />
                </div>
            )}
        </div>
    );
}
