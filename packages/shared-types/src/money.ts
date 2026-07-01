/**
 * Money is always an integer number of the currency's minor unit (cents),
 * never a float. See docs/README.md — "Non-negotiable engineering rules".
 */
export type MoneyCents = number;

export function toMoneyCents(amount: number): MoneyCents {
  return Math.round(amount * 100);
}

export function formatMoneyCents(cents: MoneyCents, currencySymbol = ""): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const value = (abs / 100).toFixed(2);
  return `${sign}${currencySymbol}${value}`;
}
