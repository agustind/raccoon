import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ReactNode } from 'react';

/** Right-side details drawer used by list pages (route/job/query details). */
export default function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
    return (
        <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
            <SheetContent className="w-[560px] overflow-y-auto sm:max-w-[560px]">
                <SheetHeader>
                    <SheetTitle className="font-mono text-sm break-all">{title}</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-6">{children}</div>
            </SheetContent>
        </Sheet>
    );
}
