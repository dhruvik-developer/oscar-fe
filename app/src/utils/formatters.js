import { formatCurrency } from './currencyUtils';

/**
 * Format number in Indian numeral system (lakhs, crores).
 */
export const numIN = (n, decimals = 2) => {
  const num = Number(n);
  if (Number.isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
};

export const toDDMMYYYY = (isoDate) => {
  if (!isoDate) return '—';
  const parts = String(isoDate).slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(isoDate);
};

export { formatCurrency };
