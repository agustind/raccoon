import { formatCompact } from '@/lib/format';
import { Paperclip, User } from 'lucide-react';

export interface MailCounts {
    to: number;
    cc: number;
    bcc: number;
    attachments: number;
}

/** Recipient and attachment counts badge; the tooltip splits to/cc/bcc. */
export default function Recipients({ values }: { values: MailCounts }) {
    return (
        <span
            className="inline-flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-zinc-700"
            title={`To: ${values.to}\nCc: ${values.cc}\nBcc: ${values.bcc}\nAttachments: ${values.attachments}`}
        >
            <span className="flex items-center gap-1">
                <User className="size-3 text-zinc-400" />
                {formatCompact(values.to + values.cc + values.bcc)}
            </span>
            <span className="flex items-center gap-1">
                <Paperclip className="size-3 text-zinc-400" />
                {formatCompact(values.attachments)}
            </span>
        </span>
    );
}
