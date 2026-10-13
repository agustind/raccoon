import { ReactNode } from 'react';

/** Dashed check mark shown when a card has nothing to report. */
export default function EmptyState({ children }: { children?: ReactNode }) {
    return (
        <div className="relative flex grow flex-col items-center justify-end pb-8">
            <svg
                viewBox="0 0 202 202"
                fill="none"
                className="size-[160px] text-emerald-500/80 [mask-image:linear-gradient(to_top,rgba(0,0,0,0.2),black)]"
            >
                <path
                    d="M53.0146 107.96L80.4348 135.799L148.985 66.2017"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeMiterlimit="10"
                    strokeLinecap="square"
                />
                <path
                    d="M101 201C156.228 201 201 156.228 201 101C201 45.7715 156.228 1 101 1C45.7715 1 1 45.7715 1 101C1 156.228 45.7715 201 101 201Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeMiterlimit="10"
                    strokeLinecap="round"
                    strokeDasharray="4 7"
                    strokeDashoffset="11"
                />
            </svg>
            {children && <div className="z-10 mt-4">{children}</div>}
        </div>
    );
}
