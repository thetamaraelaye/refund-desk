const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    formatters.set(currency, formatter);
  }
  return formatter;
}

// Minor units per the currency's own exponent: 12900 USD is $129.00, 12900 JPY is ¥12,900.
export function formatMoney(amountMinor: number, currency: string): string {
  const formatter = formatterFor(currency);
  const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** exponent);
}
