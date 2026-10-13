import { visitWithQuery } from '@/lib/rc';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Debounced search bound to a query param (default ?search=). */
export default function SearchInput({ value, placeholder, param = 'search' }: { value?: string | null; placeholder: string; param?: string }) {
    const [text, setText] = useState(value ?? '');
    const first = useRef(true);

    useEffect(() => {
        if (first.current) {
            first.current = false;

            return;
        }

        const timer = setTimeout(() => visitWithQuery({ [param]: text || null }), 300);

        return () => clearTimeout(timer);
    }, [text, param]);

    return (
        <label className="flex h-9 w-56 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm shadow-xs focus-within:border-zinc-400">
            <Search className="size-4 text-zinc-400" />
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-transparent outline-none placeholder:text-zinc-400"
            />
        </label>
    );
}
