/** Faded cards peeking out under a list, hinting that it has more rows. */
export default function CardStack({ count }: { count: number }) {
    return (
        <div className="relative z-0">
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="absolute h-8 rounded-lg border border-zinc-200/60 bg-zinc-50"
                    style={{ bottom: `-${(index + 1) * 8}px`, left: `${(index + 1) * 8}px`, right: `${(index + 1) * 8}px`, zIndex: 1 - index }}
                />
            ))}
        </div>
    );
}
