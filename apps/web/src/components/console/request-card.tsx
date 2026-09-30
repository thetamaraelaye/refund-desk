import { cn } from '@/components/ui/cn';
import { statusLabel } from '@/components/ui/status-badge';
import { formatAge, formatMoney } from '@/lib/format';
import { FLAG_LABELS, REASON_LABELS } from '@/lib/labels';
import type { RequestStatus, StaffListItem } from '@/lib/types';

// Linear-style status marks: each status has its own shape as well as its own tone.
export function StatusIcon({ status, className }: { status: RequestStatus; className?: string }) {
  const common = 'size-4 shrink-0';
  switch (status) {
    case 'ESCALATED':
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cn(common, 'text-escalated', className)}
        >
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.5v4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="11.2" r="0.95" fill="currentColor" />
        </svg>
      );
    case 'NEEDS_INFO':
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cn(common, 'text-waiting', className)}
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="2.6 2"
          />
          <path
            d="M6.3 6.4a1.8 1.8 0 113 1.3c-.7.4-1.3.8-1.3 1.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="8" cy="11.3" r="0.85" fill="currentColor" />
        </svg>
      );
    case 'APPROVED':
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cn(common, 'text-approved', className)}
        >
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="M5 8.2l2 2 4-4.3"
            fill="none"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={cn(common, 'text-denied', className)}
        >
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path
            d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

// One request as a card: status, reference and what happened on the first line; who, which order,
// which item and why on the second; flags, the amount from the order and its age on the right.
export function RequestCard({
  request,
  selected,
  onOpen,
}: {
  request: StaffListItem;
  selected: boolean;
  onOpen: () => void;
}) {
  const facts = [
    request.customer.name,
    request.orderNumber,
    request.orderItem?.name,
    request.reasonCategory ? REASON_LABELS[request.reasonCategory] : null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group flex w-full items-start gap-3 rounded-[10px] border bg-surface px-4 py-3 text-left transition-[border-color,box-shadow,background-color] duration-150 ease-in-out',
        selected
          ? 'border-ink/70 shadow-sm'
          : 'border-line hover:border-line-strong hover:bg-paper/40',
      )}
    >
      <StatusIcon status={request.status} className="mt-0.5" />
      <span className="sr-only">{statusLabel(request.status)}.</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs text-muted">#{request.reference}</span>
          <span className="truncate text-[13.5px] font-medium text-ink">
            {request.summary ?? 'Asked for a person before describing the problem'}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </span>
        {request.flags.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {request.flags.map((flag) => (
              <span
                key={flag}
                className="rounded-full border border-line px-2 py-px text-[11px] font-medium text-ink-soft"
              >
                {FLAG_LABELS[flag] ?? flag}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
        {request.amountMinor !== null && request.currency && (
          <span className="font-medium text-ink tabular-nums">
            {formatMoney(request.amountMinor, request.currency)}
          </span>
        )}
        <span className="text-muted" title={new Date(request.createdAt).toLocaleString('en-GB')}>
          {formatAge(request.createdAt)}
        </span>
      </span>
    </button>
  );
}
