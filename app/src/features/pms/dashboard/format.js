/** Number formatting shared by the PMS overview dashboard (Indian grouping). */

const qtyFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const formatQty = (value) => qtyFormatter.format(Number(value) || 0);
export const formatMeters = (value) => `${formatQty(value)} m`;
export const formatMoney = (value) => `₹ ${moneyFormatter.format(Number(value) || 0)}`;

/** Compact axis label: 12,400 -> 12.4K, 1,20,000 -> 1.2L. */
export function formatAxis(value) {
  const n = Number(value) || 0;
  if (n >= 1e7) return `${+(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${+(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(+n.toFixed(1));
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
