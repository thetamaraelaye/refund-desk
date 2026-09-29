import { Button, Spinner } from './button';
import { cn } from './cn';

export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <p role="status" className={cn('flex items-center gap-2 p-6 text-sm text-muted', className)}>
      <Spinner />
      {label}
    </p>
  );
}

// A failed load says what failed and offers the one fix that usually works.
export function ErrorState({
  title,
  message,
  onRetry,
  className,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-start gap-3 p-6', className)}>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-muted">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  className,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3 p-6', className)}>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-prose text-sm text-muted">{message}</p>
      </div>
      {action}
    </div>
  );
}
