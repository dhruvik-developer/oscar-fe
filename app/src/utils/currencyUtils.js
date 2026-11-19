// ── Universal Indian Rupee (INR / ₹) Currency Utilities for Evenmore & OSCAR ERP ─────

export const DEFAULT_RATES = {
  INR: 1.0,
};

export const CURRENCY_CONFIGS = {
  INR: { symbol: '₹', rate: 1.0, label: 'INR (₹) - Indian Rupee', locale: 'en-IN', code: 'INR' },
};

// Live external exchange rate fetching disabled; uses default rates
export async function fetchLiveExchangeRates() {
  return DEFAULT_RATES;
}

// ── Base currency ────────────────────────────────────────────────────────────
export function setBaseCurrency() {
  // Always locked to Indian Rupee (INR)
}

export function getBaseCurrency() {
  return 'INR';
}

export function getCurrencyConfig() {
  return { ...CURRENCY_CONFIGS.INR };
}

export function getCurrencySymbol() {
  return '₹';
}

// Indian compact scale steps: Crore → Lakh → Thousand.
const COMPACT_STEPS = [
  { limit: 10000000, divisor: 10000000, suffix: 'Cr' },
  { limit: 100000, divisor: 100000, suffix: 'L' },
  { limit: 1000, divisor: 1000, suffix: 'K' },
];

export function formatCurrency(amount, currencyStr = 'INR (₹)', options = {}) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const isNegative = num < 0;
  const absVal = Math.abs(num);

  const minDecimals = options.minDecimals !== undefined ? options.minDecimals : (options.noDecimals ? 0 : 2);
  const maxDecimals = options.maxDecimals !== undefined ? options.maxDecimals : (options.noDecimals ? 0 : 2);

  // Compact Indian scale: ₹51.30L / ₹66.00K / ₹1.25Cr (opt-in via `compact`).
  const step = options.compact ? COMPACT_STEPS.find((s) => absVal >= s.limit) : null;
  const scaledVal = step ? absVal / step.divisor : absVal;

  const formattedNumber = scaledVal.toLocaleString('en-IN', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
  const suffix = step ? step.suffix : '';

  if (options.symbolSuffix) {
    return `${isNegative ? '-' : ''}${formattedNumber}${suffix} ₹`;
  }

  return `${isNegative ? '-' : ''}₹${formattedNumber}${suffix}`;
}

/**
 * Compact Indian currency helper: ₹51.30L, ₹5.20L, ₹66.00K, ₹1.10L, ₹22.00K.
 * Thin wrapper over formatCurrency so both share symbol, rate and decimals.
 */
export function formatCompactCurrency(amount, currencyStr = 'INR (₹)', options = {}) {
  return formatCurrency(amount, currencyStr, { ...options, compact: true });
}
