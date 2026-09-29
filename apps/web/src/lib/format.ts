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
