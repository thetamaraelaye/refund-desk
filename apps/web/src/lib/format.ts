// One formatter per kind of value, used everywhere.
const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amountMinor: number, currency: string): string {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    moneyFormatters.set(currency, formatter);
  }
  const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** exponent);
}

const dayFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDay = (iso: string) => dayFormatter.format(new Date(iso));
export const formatDateTime = (iso: string) => timeFormatter.format(new Date(iso));

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86_400), 'day');
}

const elapsed = (iso: string, now: number) => Math.max(0, now - new Date(iso).getTime());

// Compact, Linear-style age for list cards: "now", "18m", "3h", "2d".
export function formatAge(iso: string, now = Date.now()): string {
  const minutes = Math.floor(elapsed(iso, now) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}

// A waiting time in words for headline numbers: "4 min", "3 h 20 min", "2 days".
export function formatDuration(sinceIso: string, now = Date.now()): string {
  const minutes = Math.floor(elapsed(sinceIso, now) / 60_000);
  if (minutes < 1) return 'Under 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
