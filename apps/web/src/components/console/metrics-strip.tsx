import { formatDuration, formatMoney } from '@/lib/format';
import type { ConsoleMetrics } from '@/lib/types';

// The console's headline numbers as one strip of stat tiles: sentence-case label, value in the same
// sans as everything else (never the store's serif), proportional figures. No sparklines: there is
// no history to plot yet, and an empty trend line would say nothing.
export function MetricsStrip({ metrics }: { metrics: ConsoleMetrics | undefined }) {
  const tiles = [
    {
      label: 'Needs attention',
      value: metrics ? String(metrics.needsAttention) : '–',
      note: 'Escalated or waiting on the customer',
    },
    {
      label: 'Oldest waiting',
      value: metrics?.oldestWaitingSince ? formatDuration(metrics.oldestWaitingSince) : '–',
      note: metrics?.oldestWaitingSince ? 'Since the customer wrote in' : 'Nothing waiting',
    },
    {
      label: 'Refunds approved today',
      value: metrics ? String(metrics.approvedToday) : '–',
      note: 'Automatic and by specialists',
    },
    {
      label: 'Refunded today',
      value: metrics ? formatMoney(metrics.refundedTodayMinor, metrics.currency) : '–',
      note: 'Back to customers’ cards',
    },
  ];

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-line bg-surface lg:grid-cols-4">
      {tiles.map((tile, index) => (
        <div
          key={tile.label}
          className={
            'px-5 py-4 ' +
            (index % 2 === 1 ? 'border-l border-line ' : '') +
            (index >= 2 ? 'border-t border-line lg:border-t-0 ' : '') +
            (index === 2 ? 'lg:border-l ' : '')
          }
        >
          <dt className="text-[13px] text-muted">{tile.label}</dt>
          <dd className="mt-1 text-[26px] leading-tight font-semibold tracking-tight text-ink">
            {tile.value}
          </dd>
          <dd className="mt-0.5 text-xs text-muted">{tile.note}</dd>
        </div>
      ))}
    </dl>
  );
}
