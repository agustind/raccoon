import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Check, Copy, LoaderCircle, Plus } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, useState } from 'react';

export const ENV_DOT_COLORS: Record<string, string> = {
    blue: 'bg-blue-600',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    yellow: 'bg-amber-400',
    purple: 'bg-violet-500',
    orange: 'bg-orange-500',
    gray: 'bg-zinc-400',
    pink: 'bg-pink-500',
};

/** Outer settings card: title, description, optional "+" action and rows. */
export function SettingsCard({
    title,
    description,
    onAdd,
    addLabel = 'Add',
    actions,
    children,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    onAdd?: () => void;
    addLabel?: string;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('rounded-xl border border-zinc-200/80 bg-white/70', className)}>
            <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
                <div className="min-w-0">
                    <h2 className="text-lg leading-6 font-semibold text-zinc-900">{title}</h2>
                    {description && <p className="mt-0.5 text-sm text-zinc-600">{description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {actions}
                    {onAdd && (
                        <button
                            type="button"
                            onClick={onAdd}
                            title={addLabel}
                            aria-label={addLabel}
                            className="flex size-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-xs hover:text-zinc-900"
                        >
                            <Plus className="size-4" />
                        </button>
                    )}
                </div>
            </div>
            {children}
        </section>
    );
}

/** White box of rows separated by dividers, inset inside a SettingsCard. */
export function SettingsRows({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('mx-1.5 mb-1.5 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-xs', className)}>{children}</div>
    );
}

export function SettingsRow({
    title,
    description,
    children,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex min-h-[60px] items-center justify-between gap-6 px-4 py-3', className)}>
            <div className="min-w-0">
                <div className="text-sm text-zinc-900">{title}</div>
                {description && <div className="mt-0.5 text-xs text-zinc-500">{description}</div>}
            </div>
            {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
        </div>
    );
}

/** Dashed box with a single centered button, e.g. "Add threshold". */
export function SettingsEmpty({ label, onClick, message }: { label?: string; onClick?: () => void; message?: string }) {
    return (
        <div className="mx-1.5 mb-1.5 flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-sm text-zinc-500">
            {message && <p>{message}</p>}
            {onClick && label && (
                <Button variant="secondary" size="sm" onClick={onClick}>
                    <Plus className="size-3.5" /> {label}
                </Button>
            )}
        </div>
    );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'secondary', size = 'md', loading, className, children, disabled, type = 'button', ...props }, ref) => (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-md text-sm whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                size === 'sm' && 'h-8 px-3',
                size === 'md' && 'h-9 px-3.5',
                size === 'lg' && 'h-11 px-5 font-medium',
                variant === 'primary' && 'bg-zinc-900 text-white shadow-xs hover:bg-zinc-800',
                variant === 'secondary' && 'border border-zinc-200 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50',
                variant === 'danger' && 'bg-rose-600 text-white shadow-xs hover:bg-rose-500',
                variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                className,
            )}
            {...props}
        >
            {loading && <LoaderCircle className="size-4 animate-spin" />}
            {children}
        </button>
    ),
);
Button.displayName = 'Button';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
    <input
        ref={ref}
        className={cn(
            'h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-xs outline-none placeholder:text-zinc-400 read-only:bg-zinc-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60',
            className,
        )}
        {...props}
    />
));
TextInput.displayName = 'TextInput';

export function SelectInput({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={cn(
                'h-11 w-full appearance-none rounded-lg border border-zinc-200 bg-white bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2016%2016%27%20fill%3D%27none%27%20stroke%3D%27%2371717a%27%20stroke-width%3D%271.5%27%3E%3Cpath%20d%3D%27m4%206%204%204%204-4%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9 pl-3 text-sm text-zinc-900 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60',
                className,
            )}
            {...props}
        >
            {children}
        </select>
    );
}

export function Field({
    label,
    hint,
    error,
    htmlFor,
    children,
    className,
}: {
    label: ReactNode;
    hint?: ReactNode;
    error?: string;
    htmlFor?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <label htmlFor={htmlFor} className="text-sm text-zinc-900">
                {label} {hint && <span className="text-zinc-500">{hint}</span>}
            </label>
            {children}
            {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
    );
}

export function Switch({
    checked,
    onChange,
    disabled,
    label,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-blue-600' : 'bg-zinc-200')}
        >
            <span
                className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform', checked && 'translate-x-4')}
            />
        </button>
    );
}

export function CopyButton({ value, className }: { value: string; className?: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
            title="Copy"
            aria-label="Copy"
            className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
                className,
            )}
            onClick={() => {
                void navigator.clipboard?.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            }}
        >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        </button>
    );
}

export function EnvironmentDot({ color, className }: { color: string; className?: string }) {
    return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', ENV_DOT_COLORS[color] ?? 'bg-zinc-400', className)} />;
}

export function Initial({ name, className }: { name: string; className?: string }) {
    return (
        <span
            className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-700',
                className,
            )}
        >
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

export function Modal({
    open,
    onOpenChange,
    title,
    description,
    children,
    className,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn('gap-5 rounded-xl border-zinc-200 bg-white text-zinc-900 sm:rounded-xl', className)}>
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
                    {description && <DialogDescription className="text-sm text-zinc-600">{description}</DialogDescription>}
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}

export function ModalFooter({ children }: { children: ReactNode }) {
    return <div className="flex justify-end gap-2 pt-1">{children}</div>;
}

/** Yes/no dialog for destructive actions. */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    onConfirm,
    processing,
    destructive = true,
    children,
    disabled,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
    processing?: boolean;
    destructive?: boolean;
    children?: ReactNode;
    disabled?: boolean;
}) {
    return (
        <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
            {children}
            <ModalFooter>
                <Button onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button variant={destructive ? 'danger' : 'primary'} loading={processing} disabled={disabled} onClick={onConfirm}>
                    {confirmLabel}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
