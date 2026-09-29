import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const CONTROL =
  'w-full rounded-input border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted hover:border-line-strong aria-invalid:border-denied';

interface FieldShell {
  label: string;
  hint?: string;
  error?: string | null;
}

function Shell({
  id,
  label,
  hint,
  error,
  children,
}: FieldShell & { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-denied">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string | null) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL, 'h-10', className)}
        {...props}
      />
    </Shell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  className,
  ...props
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL, 'min-h-20 py-2 leading-relaxed', className)}
        {...props}
      />
    </Shell>
  );
}
