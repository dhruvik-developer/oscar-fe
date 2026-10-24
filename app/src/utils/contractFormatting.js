export function formatContractMoney(value) {
  return `₹ ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatContractDate(value) {
  if (!value) return '—';
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

