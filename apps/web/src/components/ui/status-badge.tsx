import type { RequestStatus } from '@/lib/types';
import { cn } from './cn';

interface Tone {
  className: string;
  glyph: string;
  staff: string;
  customer: string;
}

// One tone map for every status. The glyph and the words carry the meaning; colour only reinforces it.
const TONES: Record<RequestStatus, Tone> = {
  APPROVED: {
    className: 'bg-approved-tint text-approved',
    glyph: '✓',
    staff: 'Approved',
    customer: 'Refund approved',
  },
  DENIED: {
    className: 'bg-denied-tint text-denied',
    glyph: '✕',
    staff: 'Denied',
    customer: 'Not refunded',
  },
  ESCALATED: {
    className: 'bg-escalated-tint text-escalated',
    glyph: '!',
    staff: 'Escalated',
    customer: 'With our support team',
  },
  NEEDS_INFO: {
    className: 'bg-waiting-tint text-waiting',
    glyph: '?',
    staff: 'Needs info',
    customer: 'Waiting for your reply',
  },
};

const NEUTRAL: Tone = { className: 'bg-sunken text-ink-soft', glyph: '·', staff: '', customer: '' };

export function StatusBadge({
  status,
  audience = 'staff',
  className,
}: {
  status: RequestStatus | string;
  audience?: 'staff' | 'customer';
  className?: string;
}) {
  const tone = TONES[status as RequestStatus] ?? NEUTRAL;
  const label = tone[audience] || status;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
        tone.className,
        className,
      )}
    >
      <span aria-hidden="true" className="text-[11px] leading-none">
        {tone.glyph}
      </span>
      {label}
    </span>
  );
}

export function statusLabel(status: RequestStatus, audience: 'staff' | 'customer' = 'staff') {
  return TONES[status]?.[audience] ?? status;
}
