import { ProductArt } from '@/components/product-art';
import { formatDay, formatMoney } from '@/lib/format';
import type { CustomerOrder } from '@/lib/types';
import { DeliveryTimeline } from './delivery-timeline';

// One order, as a shop's order-status page shows it: when it was placed, where it is, and every item
// with its picture, price and a way to get help with exactly that item.
export function OrderCard({
  order,
  onGetHelp,
}: {
  order: CustomerOrder;
  onGetHelp: (orderNumber: string, itemName: string) => void;
}) {
  const total = order.items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);
  return (
    <article
      aria-labelledby={`order-${order.orderNumber}`}
      className="rounded-[14px] border border-line bg-surface"
    >
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-5 py-4">
        <h3 id={`order-${order.orderNumber}`} className="text-[15px] font-semibold text-ink">
          {order.orderNumber}
        </h3>
        <p className="text-[13px] text-muted">Placed {formatDay(order.placedAt)}</p>
        <p className="ml-auto text-[13px] text-ink-soft">
          Total <span className="font-medium text-ink">{formatMoney(total, order.currency)}</span>
        </p>
      </header>

      <div className="px-5 pt-4 pb-2">
        <DeliveryTimeline order={order} />
      </div>

      <ul className="divide-y divide-line">
        {order.items.map((item) => (
          <li key={item.sku} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <ProductArt sku={item.sku} className="w-16 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-ink">{item.name}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] text-muted">
                <span>{formatMoney(item.unitPriceMinor * item.quantity, order.currency)}</span>
                {item.quantity > 1 && <span>Quantity {item.quantity}</span>}
                {item.finalSale && <span className="text-escalated">Final sale</span>}
                {item.refund && (
                  <span className="text-approved">Refunded {formatDay(item.refund.issuedAt)}</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onGetHelp(order.orderNumber, item.name)}
              aria-label={`Get help with the ${item.name} from ${order.orderNumber}`}
              className="rounded-button border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink hover:border-moss hover:text-moss"
            >
              Get help with this item
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}
