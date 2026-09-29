import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-soft active:bg-ink',
  secondary: 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-sunken',
  ghost: 'text-ink-soft hover:bg-sunken hover:text-ink',
  destructive: 'border border-denied/40 bg-surface text-denied hover:bg-denied-tint',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

// While loading, the label stays (so the button doesn't jump) and aria-busy tells assistive tech.
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-button font-medium whitespace-nowrap',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {isLoading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none',
        className,
      )}
    />
  );
}
