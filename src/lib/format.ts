// Number formatting helpers. No calculation logic lives here — pure presentation.

/** Format hours as "7d 23h" / "23h 45m" / "12m". Days only appear when >= 1 day. */
export function formatDuration(hours: number): string {
  if (!isFinite(hours) || hours < 0) return '—';
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const h = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const m = Math.round(totalMinutes - days * 60 * 24 - h * 60);
  if (days > 0) return `${days}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Format a USD amount, e.g. $1,612,800 or $3,911.55. */
export function formatUSD(amount: number): string {
  if (!isFinite(amount)) return '—';
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: amount >= 1000 ? 0 : 2 });
}

/** Format a fraction (0..1) as a percentage with the given decimals, e.g. 94.0%. */
export function formatPercent(fraction: number, decimals = 1): string {
  if (!isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Format a plain number with thousands separators, optional decimals. */
export function formatNumber(value: number, decimals = 0): string {
  if (!isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

/** Format a USD per-unit rate, e.g. "$5.40 / GPU-hour". */
export function formatRate(amount: number, unit: string): string {
  if (!isFinite(amount)) return '—';
  return `${formatUSD(amount)} / ${unit}`;
}
