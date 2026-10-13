import { CircleCheck } from 'lucide-react';

export default function NoActions() {
    return (
        <div className="flex items-center gap-2">
            <CircleCheck className="size-[18px] text-emerald-500" />
            <span className="font-mono text-[13px] font-medium text-emerald-700 uppercase">No Actions</span>
        </div>
    );
}
