const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    formatters.set(currency, formatter);
  }
  return formatter;
}

// Digits after the decimal point: 2 for USD, 0 for JPY.
export function currencyExponent(currency: string): number {
  return formatterFor(currency).resolvedOptions().maximumFractionDigits ?? 2;
}

// Minor units per the currency's own exponent: 12900 USD is $129.00, 12900 JPY is ¥12,900.
export function formatMoney(amountMinor: number, currency: string): string {
  return formatterFor(currency).format(amountMinor / 10 ** currencyExponent(currency));
}

// An amount a customer typed ("129.99"), in minor units; the model's number is never trusted as-is.
export function toMinorUnits(amount: number, currency: string): number | null {
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return null;
  return Math.round(amount * 10 ** currencyExponent(currency));
}
