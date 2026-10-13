import { cn } from '@/lib/utils';
import { useMemo } from 'react';

/** Monospace block. Pretty-prints JSON strings when json is set. */
export default function CodeBlock({ code, json = false, className }: { code: string | null | undefined; json?: boolean; className?: string }) {
    const text = useMemo(() => {
        if (!code) return '';

        if (json) {
            try {
                return JSON.stringify(JSON.parse(code), null, 2);
            } catch {
                return code;
            }
        }

        return code;
    }, [code, json]);

    if (!text) {
        return <div className={cn('rounded-lg bg-zinc-50 p-4 font-mono text-xs text-zinc-400', className)}>Empty</div>;
    }

    return <pre className={cn('overflow-x-auto rounded-lg bg-zinc-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-800', className)}>{text}</pre>;
}
