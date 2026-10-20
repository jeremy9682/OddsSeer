export function probability(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}
export function gammaPrices(value: unknown) {
  let values: unknown = value;
  try { if (typeof values === 'string') values = JSON.parse(values); } catch { values = []; }
  const prices = Array.isArray(values) ? values : [];
  return { yesPrice: probability(prices[0]), noPrice: probability(prices[1]) };
}
export function kalshiPrices(market: Record<string, any>) {
  // Ask quotes on both sides, matching the public backend; never invent a midpoint.
  return {
    yesPrice: probability(market.yes_ask_dollars ?? (market.yes_ask == null ? null : market.yes_ask / 100)),
    noPrice: probability(market.no_ask_dollars ?? (market.no_ask == null ? null : market.no_ask / 100))
  };
}
