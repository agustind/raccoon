import { Pill } from '@/components/rc/badges';
import { Card } from '@/components/rc/section';
import { cn } from '@/lib/utils';
import { ChevronsDownUp, ChevronsUpDown, Copy, Folder, FolderOpen } from 'lucide-react';
import { Fragment, ReactNode, useMemo, useState } from 'react';

export interface TraceFrame {
    /** "path/to/file.php:123" */
    file: string;
    /** The call made at this file and line, e.g. "App\\Foo->bar()". */
    source: string;
    /** Source lines around the frame, keyed by line number. */
    code: Record<string, string> | null;
}

export interface ExceptionDetails {
    class: string;
    code: string;
    file: string;
    line: number;
    message: string;
    handled: boolean;
    trace: TraceFrame[];
    php_version: string | null;
    laravel_version: string | null;
}

interface IndexedFrame extends TraceFrame {
    index: number;
}

/**
 * Exception header (class, message, versions) and its stack trace. Vendor
 * frames collapse into groups; app frames with source code expand to show it,
 * the first one open by default.
 *
 * A frame's "source" is the call made from that line, so the function a frame
 * runs in is the next frame's source.
 */
export default function ExceptionCard({ exception, className }: { exception: ExceptionDetails; className?: string }) {
    const [copied, setCopied] = useState(false);
    const trace = useMemo(() => {
        const frames = [...exception.trace];

        if (frames[0] && frames[0].source !== '' && !frames.some((frame) => frame.file === `${exception.file}:${exception.line}`)) {
            frames.unshift({ file: `${exception.file}:${exception.line}`, source: '', code: null });
        }

        return frames;
    }, [exception]);

    const groups = useMemo(() => {
        const result: { vendor: boolean; frames: IndexedFrame[] }[] = [];

        trace.forEach((frame, index) => {
            const vendor = isVendor(frame.file);
            const last = result[result.length - 1];

            if (!last || last.vendor !== vendor) {
                result.push({ vendor, frames: [] });
            }

            result[result.length - 1].frames.push({ ...frame, index });
        });

        return result;
    }, [trace]);

    const firstWithCode = trace.findIndex((frame) => frame.code && Object.keys(frame.code).length > 0);

    const copy = async () => {
        await navigator.clipboard.writeText(exceptionToMarkdown(exception, trace));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className={cn('overflow-hidden', className)}>
            <div className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                'rounded px-1.5 py-0.5 font-mono text-xs text-white uppercase',
                                exception.handled ? 'bg-amber-600' : 'bg-rose-600',
                            )}
                        >
                            {exception.handled ? 'Handled' : 'Unhandled'}
                        </span>
                        {exception.code !== '0' && <Pill>{exception.code}</Pill>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={copy}
                            className="flex h-6 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                            <Copy className="size-3.5 text-zinc-500" />
                            {copied ? 'Copied' : 'Copy as Markdown'}
                        </button>
                        {(exception.laravel_version || exception.php_version) && (
                            <div className="flex h-6 items-center divide-x divide-zinc-200 rounded-sm border border-zinc-200 bg-white font-mono text-xs">
                                {exception.laravel_version && (
                                    <span className="flex items-center gap-2 px-2">
                                        <span className="text-zinc-500 uppercase">Laravel</span>
                                        {exception.laravel_version}
                                    </span>
                                )}
                                {exception.php_version && (
                                    <span className="flex items-center gap-2 px-2">
                                        <span className="text-zinc-500 uppercase">PHP</span>
                                        {exception.php_version}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-1 text-2xl/none font-semibold break-all">{exception.class}</div>
                <div className="max-h-48 overflow-y-auto tracking-tight whitespace-pre-wrap text-zinc-600">{exception.message}</div>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-zinc-200 bg-zinc-50 p-2.5">
                {groups.length === 0 ? (
                    <div className="flex h-11 items-center justify-between gap-6 rounded-lg border border-zinc-200 bg-white pr-2.5 pl-4">
                        <span className="truncate font-mono text-[13px] text-zinc-700">Stack trace not available</span>
                        <FileName file={`${exception.file}:${exception.line}`} />
                    </div>
                ) : (
                    groups.map((group, index) =>
                        group.vendor ? (
                            <VendorFrames key={index} frames={group.frames} trace={trace} />
                        ) : (
                            <Fragment key={index}>
                                {group.frames.map((frame) => (
                                    <AppFrame
                                        key={frame.index}
                                        frame={frame}
                                        caller={trace[frame.index + 1]}
                                        defaultExpanded={frame.index === firstWithCode}
                                    />
                                ))}
                            </Fragment>
                        ),
                    )
                )}
            </div>
        </Card>
    );
}

function isVendor(file: string): boolean {
    return file.startsWith('vendor/') || file.startsWith('[');
}

function splitFile(file: string): [string, string | null] {
    const index = file.lastIndexOf(':');

    return index > 0 && /^\d+$/.test(file.slice(index + 1)) ? [file.slice(0, index), file.slice(index + 1)] : [file, null];
}

function AppFrame({ frame, caller, defaultExpanded }: { frame: IndexedFrame; caller?: TraceFrame; defaultExpanded: boolean }) {
    const hasCode = frame.code !== null && Object.keys(frame.code).length > 0;
    const [expanded, setExpanded] = useState(defaultExpanded && hasCode);
    const [, line] = splitFile(frame.file);

    return (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div
                className={cn('flex h-11 items-center gap-2.5 pr-2.5 pl-4', hasCode && 'cursor-pointer hover:bg-zinc-50/60')}
                onClick={hasCode ? () => setExpanded(!expanded) : undefined}
            >
                <span className={cn('size-2 shrink-0 rounded-full', expanded ? 'bg-zinc-400' : 'bg-zinc-300')} />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-6">
                    {caller ? (
                        <Source source={caller.source} className="text-[13px]" />
                    ) : (
                        <span className="font-mono text-[13px] text-zinc-500">Entrypoint</span>
                    )}
                    <FileName file={frame.file} />
                </div>
                {hasCode && <ToggleButton expanded={expanded} />}
            </div>
            {expanded && frame.code && <CodeSnippet code={frame.code} highlight={line ? Number(line) : 0} />}
        </div>
    );
}

function VendorFrames({ frames, trace }: { frames: IndexedFrame[]; trace: TraceFrame[] }) {
    const [open, setOpen] = useState(false);

    return (
        <div className={cn('group rounded-lg border', open ? 'border-zinc-200 bg-white' : 'border-dashed border-zinc-300 bg-zinc-50')}>
            <div className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg pr-2.5 pl-4 hover:bg-white/60" onClick={() => setOpen(!open)}>
                {open ? <FolderOpen className="size-3 text-emerald-500" /> : <Folder className="size-3 text-zinc-400 group-hover:text-emerald-500" />}
                <span className="flex-1 font-mono text-xs text-zinc-600">
                    {frames.length.toLocaleString()} vendor {frames.length === 1 ? 'frame' : 'frames'}
                </span>
                <ToggleButton expanded={open} />
            </div>
            {open && (
                <div className="flex flex-col divide-y divide-zinc-100 border-t border-zinc-100">
                    {frames.map((frame) => {
                        const caller = trace[frame.index + 1];

                        return (
                            <div key={frame.index} className="flex h-11 items-center justify-between gap-6 px-3">
                                {caller ? (
                                    <Source source={caller.source} className="text-xs" />
                                ) : (
                                    <span className="font-mono text-xs text-zinc-500">Entrypoint</span>
                                )}
                                <FileName file={frame.file} />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ToggleButton({ expanded }: { expanded: boolean }) {
    return (
        <span
            className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white',
                expanded ? 'text-emerald-500' : 'text-zinc-500',
            )}
        >
            {expanded ? <ChevronsDownUp className="size-3" /> : <ChevronsUpDown className="size-3" />}
        </span>
    );
}

/** "App\\Foo->bar(args)" with dimmed separators and orange arguments. */
function Source({ source, className }: { source: string; className?: string }) {
    const open = source.indexOf('(');
    const callee = open >= 0 ? source.slice(0, open) : source;
    const args = open >= 0 ? source.slice(open + 1, source.endsWith(')') ? -1 : undefined) : null;

    return (
        <span className={cn('truncate font-mono', className)} title={source}>
            <span className="text-violet-600">{dim(callee, /(\\|::|->)/)}</span>
            {args !== null && (
                <span className="text-orange-500">
                    <span className="opacity-50">(</span>
                    {dim(args, /(\\|, )/)}
                    <span className="opacity-50">)</span>
                </span>
            )}
        </span>
    );
}

function dim(text: string, separator: RegExp): ReactNode[] {
    return text.split(separator).map((part, index) =>
        separator.test(part) && index % 2 === 1 ? (
            <span key={index} className="opacity-50">
                {part}
            </span>
        ) : (
            part
        ),
    );
}

function FileName({ file }: { file: string }) {
    const [path, line] = splitFile(file);

    return (
        <span className="flex max-w-[50%] min-w-0 shrink-0 font-mono text-xs text-zinc-700" title={file}>
            <span dir="rtl" className="truncate">
                <span dir="ltr">{path}</span>
            </span>
            {line && <span className="shrink-0 text-zinc-500">:{line}</span>}
        </span>
    );
}

function CodeSnippet({ code, highlight }: { code: Record<string, string>; highlight: number }) {
    const lines = Object.entries(code)
        .map(([number, text]) => [Number(number), text] as const)
        .sort((a, b) => a[0] - b[0]);
    const first = lines[0]?.[0] ?? 0;

    return (
        <div className="overflow-x-auto border-t border-zinc-100 bg-zinc-50 font-mono text-[13px]">
            {lines.map(([number, text]) => (
                <div
                    key={number}
                    className={cn(
                        'flex min-w-max px-4 py-1.5',
                        number === highlight ? 'bg-rose-100' : (number - first) % 2 === 0 ? 'bg-white' : 'bg-zinc-50',
                    )}
                >
                    <span className={cn('w-12 shrink-0 select-none', number === highlight ? 'text-zinc-900' : 'text-zinc-400')}>{number}</span>
                    <span className="whitespace-pre">{highlightPhp(text)}</span>
                </div>
            ))}
        </div>
    );
}

const PHP_TOKENS =
    /(\/\/.*$|#.*$|\/\*.*?\*\/|^\s*\*.*$|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\$[A-Za-z_][A-Za-z0-9_]*|\b(?:function|fn|return|if|else|elseif|foreach|for|while|try|catch|finally|throw|new|class|public|protected|private|static|use|namespace|array|null|true|false|match|default|case|switch|break|continue|instanceof|as|void|string|int|bool|float|callable|self|parent)\b|\b\d+\b)/g;

/** Small PHP highlighter: comments, strings, variables, keywords, numbers. */
function highlightPhp(text: string): ReactNode[] {
    return text.split(PHP_TOKENS).map((part, index) => {
        if (index % 2 === 0 || !part) return part;

        const className =
            part.startsWith('//') || part.startsWith('#') || part.startsWith('/*') || part.trim().startsWith('*')
                ? 'text-zinc-400 italic'
                : part.startsWith("'") || part.startsWith('"')
                  ? 'text-emerald-700'
                  : part.startsWith('$')
                    ? 'text-blue-600'
                    : /^\d+$/.test(part)
                      ? 'text-orange-600'
                      : 'text-violet-600';

        return (
            <span key={index} className={className}>
                {part}
            </span>
        );
    });
}

export function exceptionToMarkdown(exception: ExceptionDetails, trace: TraceFrame[]): string {
    const lines = [`# ${exception.class}`, '', exception.message, '', `${exception.file}:${exception.line}`, ''];

    if (exception.laravel_version || exception.php_version) {
        lines.push(`Laravel ${exception.laravel_version ?? '?'}, PHP ${exception.php_version ?? '?'}`, '');
    }

    lines.push('## Stack trace', '', '```');
    let vendorRun = 0;
    const flushVendor = () => {
        if (vendorRun > 0) lines.push(`... ${vendorRun} vendor ${vendorRun === 1 ? 'frame' : 'frames'}`);
        vendorRun = 0;
    };
    trace.forEach((frame, index) => {
        // App frames matter for debugging; collapse framework internals.
        if (frame.file.startsWith('vendor/') && index > 0) {
            vendorRun++;

            return;
        }

        flushVendor();
        lines.push(`#${index} ${frame.file}${trace[index + 1]?.source ? ` ${trace[index + 1].source}` : ''}`);
    });
    flushVendor();
    lines.push('```');

    const withCode = trace.find((frame) => frame.code && Object.keys(frame.code).length > 0);

    if (withCode?.code) {
        lines.push('', `## ${withCode.file}`, '', '```php', ...Object.entries(withCode.code).map(([number, text]) => `${number}: ${text}`), '```');
    }

    return lines.join('\n');
}
