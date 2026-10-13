import { Check, ClipboardCopy } from 'lucide-react';
import { useState } from 'react';

/**
 * Copies Markdown built on click (so large pages only pay for it when used).
 * Falls back to downloading a .md file when the clipboard is unavailable.
 */
export default function CopyMarkdownButton({ build, filename, label = 'Copy for AI' }: { build: () => string; filename: string; label?: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        const markdown = build();

        try {
            await navigator.clipboard.writeText(markdown);
        } catch {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
        }

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            type="button"
            onClick={copy}
            title="Copy everything on this page as Markdown, to paste into an AI assistant"
            className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 shadow-xs hover:bg-zinc-50 hover:text-zinc-900"
        >
            {copied ? <Check className="size-4 text-emerald-600" /> : <ClipboardCopy className="size-4 text-zinc-500" />}
            {copied ? 'Copied' : label}
        </button>
    );
}
