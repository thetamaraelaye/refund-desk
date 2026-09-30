import { cn } from '@/components/ui/cn';
import { formatDay } from '@/lib/format';
import type { CustomerOrder } from '@/lib/types';

const STEPS = [
  { key: 'ORDERED', label: 'Ordered' },
  { key: 'IN_TRANSIT', label: 'Shipped' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
] as const;

// The order's journey from the carrier's scans, like an order-status page: done steps filled in moss,
// the current one ringed, the rest waiting. A cancelled order has no journey, so it says so instead.
export function DeliveryTimeline({ order }: { order: CustomerOrder }) {
  if (order.status === 'CANCELLED') {
    return (
      <p className="text-[13px] text-muted">
        Cancelled{order.cancelledAt ? ` on ${formatDay(order.cancelledAt)}` : ''}, before it
        shipped.
      </p>
    );
  }

  const dateOf = (key: (typeof STEPS)[number]['key']) =>
    key === 'ORDERED'
      ? order.placedAt
      : order.shipmentEvents.find((event) => event.status === key)?.occurredAt;
  const reached = STEPS.map((step) => Boolean(dateOf(step.key)));
  const current = reached.lastIndexOf(true);

  return (
    <ol className="grid grid-cols-4" aria-label="Delivery progress">
      {STEPS.map((step, index) => {
        const done = reached[index];
        const date = dateOf(step.key);
        return (
          <li key={step.key} className="relative flex flex-col gap-1.5">
            {/* The connector runs from this step's dot to the next. */}
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-[5px] left-3 h-0.5 w-[calc(100%-12px)] rounded-full',
                  reached[index + 1] ? 'bg-moss' : 'bg-line',
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 size-3 rounded-full border-2 transition-colors duration-300 ease-in-out',
                done ? 'border-moss bg-moss' : 'border-line-strong bg-surface',
                index === current && 'ring-4 ring-moss-tint',
              )}
            />
            <span className={cn('text-xs', done ? 'font-medium text-ink' : 'text-muted')}>
              {step.label}
              <span className="sr-only">{done ? ', done' : ', not yet'}</span>
            </span>
            {date && <span className="text-xs text-muted">{formatDay(date)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
