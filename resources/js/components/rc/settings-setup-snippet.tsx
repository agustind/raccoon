import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { CopyButton } from './settings-ui';

/**
 * How to point the stock laravel/nightwatch agent at this server for one
 * environment. The token is masked until revealed; copying always copies it.
 */
export default function SettingsSetupSnippet({ token, baseUrl, className }: { token: string; baseUrl: string; className?: string }) {
    const [revealed, setRevealed] = useState(false);
    const env = `NIGHTWATCH_TOKEN=${token}\nNIGHTWATCH_BASE_URL=${baseUrl}`;
    const masked = `NIGHTWATCH_TOKEN=${revealed ? token : `${token.slice(0, 6)}${'•'.repeat(24)}`}\nNIGHTWATCH_BASE_URL=${baseUrl}`;

    return (
        <ol className={cn('space-y-4 text-sm text-zinc-700', className)}>
            <Step number={1} title="Install the agent package">
                <Snippet text="composer require laravel/nightwatch" />
            </Step>
            <Step number={2} title="Add these to your .env">
                <Snippet
                    text={env}
                    display={masked}
                    extra={
                        <button
                            type="button"
                            title={revealed ? 'Hide token' : 'Reveal token'}
                            aria-label={revealed ? 'Hide token' : 'Reveal token'}
                            className="flex size-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                            onClick={() => setRevealed(!revealed)}
                        >
                            {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                    }
                />
            </Step>
            <Step number={3} title="Start the agent and keep it running">
                <Snippet text="php artisan nightwatch:agent" />
            </Step>
        </ol>
    );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
    return (
        <li className="flex gap-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white font-mono text-[11px] text-zinc-600">
                {number}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
                <div className="text-zinc-900">{title}</div>
                {children}
            </div>
        </li>
    );
}

function Snippet({ text, display, extra }: { text: string; display?: string; extra?: React.ReactNode }) {
    return (
        <div className="flex items-start gap-1 rounded-lg border border-zinc-200 bg-zinc-50 py-2 pr-1.5 pl-3">
            <pre className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-xs leading-relaxed text-zinc-800">{display ?? text}</pre>
            {extra}
            <CopyButton value={text} />
        </div>
    );
}
